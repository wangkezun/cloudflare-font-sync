import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function fetchManifest(env = process.env, fetchImpl = fetch) {
  for (const key of ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "R2_BUCKET", "R2_PREFIX"]) {
    if (!env[key]) throw new Error(`Missing required environment variable: ${key}`);
  }
  const account = encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID);
  const bucket = encodeURIComponent(env.R2_BUCKET);
  const key = `${env.R2_PREFIX.replace(/\/$/, "")}/manifest.json`
    .split("/").map(encodeURIComponent).join("/");
  const response = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucket}/objects/${key}`,
    {
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    },
  );
  // The workflow verifies the bucket exists before reading this object.
  // Match Wrangler's R2 object API behavior: only 404 means a missing object.
  if (response.status === 404) return {};
  if (!response.ok) {
    throw new Error(`R2 manifest read failed (HTTP ${response.status}); refusing to rebuild without deployed state.`);
  }
  const manifest = await response.json();
  const validFiles = Array.isArray(manifest?.files) && manifest.files.every(
    file => file && typeof file.name === "string",
  );
  const validSource = source => source && typeof source.tag === "string" && source.tag.length > 0;
  const validSources = manifest?.schemaVersion === 2 && manifest.sources &&
    typeof manifest.sources === "object" && !Array.isArray(manifest.sources) &&
    Object.keys(manifest.sources).length > 0 && Object.values(manifest.sources).every(validSource);
  const validLegacy = typeof manifest?.tag === "string" && manifest.tag.length > 0;
  if (!validFiles || (!validSources && !validLegacy)) {
    throw new Error("Invalid deployed manifest; refusing to rebuild without valid deployed state.");
  }
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = await fetchManifest();
  const output = resolve(process.argv[2] ?? "build/remote-manifest.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(Object.keys(manifest).length ? "Read deployed manifest from R2." : "No R2 manifest found; initial sync required.");
}
