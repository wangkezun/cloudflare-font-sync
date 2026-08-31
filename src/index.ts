interface FontFile {
  name: string;
  sha256: string;
  size: number;
}

interface FontManifest {
  tag: string;
  version: string;
  files: FontFile[];
  updatedAt: string;
}

const MANIFEST_NAME = "manifest.json";
const FONT_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400";

function responseHeaders(object: R2Object): Headers {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("access-control-allow-origin", "*");
  headers.set("cross-origin-resource-policy", "cross-origin");
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

async function readManifest(env: Env): Promise<FontManifest | null> {
  const object = await env.FONTS.get(`${env.FONT_PREFIX}/${MANIFEST_NAME}`);
  if (!object) return null;

  try {
    return await object.json<FontManifest>();
  } catch {
    return null;
  }
}

function safeFilename(pathname: string): string | null {
  const prefix = "/static/fonts/";
  if (!pathname.startsWith(prefix)) return null;

  let filename: string;
  try {
    filename = decodeURIComponent(pathname.slice(prefix.length));
  } catch {
    return null;
  }

  if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return null;
  }
  return filename;
}

async function serveManifest(request: Request, env: Env): Promise<Response> {
  const object = await env.FONTS.get(`${env.FONT_PREFIX}/${MANIFEST_NAME}`);
  if (!object) return new Response("Manifest not found", { status: 404 });

  const headers = responseHeaders(object);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-cache");
  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

async function serveFont(
  request: Request,
  env: Env,
  context: ExecutionContext,
  filename: string,
): Promise<Response> {
  const manifest = await readManifest(env);
  const managed = manifest?.files.some((file) => file.name === filename) ?? false;
  const objectKey = managed
    ? `${env.FONT_PREFIX}/releases/${manifest!.tag}/${filename}`
    : `${env.FONT_PREFIX}/${filename}`;

  // The version is deliberately part of the edge cache key. The public URL stays
  // stable, while a manifest switch immediately selects a fresh cached object.
  const cacheUrl = new URL(request.url);
  cacheUrl.searchParams.set("sarasa-version", managed ? manifest!.tag : "legacy");
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cache = caches.default;

  if (request.method === "GET") {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const object = await env.FONTS.get(objectKey);
  if (!object) return new Response("Font not found", { status: 404 });

  if (request.headers.get("if-none-match") === object.httpEtag) {
    return new Response(null, { status: 304, headers: { etag: object.httpEtag } });
  }

  const headers = responseHeaders(object);
  headers.set("content-type", "font/woff2");
  headers.set("cache-control", FONT_CACHE_CONTROL);
  const response = new Response(request.method === "HEAD" ? null : object.body, { headers });

  if (request.method === "GET") context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export default {
  async fetch(request, env, context): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }

    const url = new URL(request.url);
    if (url.pathname === "/static/fonts/manifest.json") {
      return serveManifest(request, env);
    }

    const filename = safeFilename(url.pathname);
    if (!filename) return new Response("Not found", { status: 404 });
    return serveFont(request, env, context, filename);
  },
} satisfies ExportedHandler<Env>;
