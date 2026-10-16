import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fetchManifest } from "../scripts/fetch-manifest.mjs";
import { planSync } from "../scripts/plan-sync.mjs";

const env = {
  CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_API_TOKEN: "test-token",
  R2_BUCKET: "sarasa-fonts", R2_PREFIX: "static/fonts",
};
const config = JSON.parse(readFileSync(new URL("../fonts.config.json", import.meta.url)));
const sources = { sarasa: { tag: "v1" }, nerdFonts: { tag: "v2" } };
const manifest = {
  schemaVersion: 2, sources,
  files: [
    ...config.sarasa.families.flatMap(family => config.sarasa.styles.map(style => ({ name: `${family}-${style}.woff2` }))),
    ...config.nerdFonts.files.map(file => ({ name: file.replace(/\.ttf$/i, ".woff2") })),
  ],
};

test("authenticated R2 manifest skips conversion for unchanged complete releases", async () => {
  const remote = await fetchManifest(env, async (url, options) => {
    assert.equal(url, "https://api.cloudflare.com/client/v4/accounts/account/r2/buckets/sarasa-fonts/objects/static/fonts/manifest.json");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    assert.equal(options.redirect, "error");
    return Response.json(manifest);
  });
  assert.equal(planSync(config, { sources }, remote).any_update, false);
});

test("missing R2 object permits initial sync", async () => {
  const remote = await fetchManifest(env, async () => new Response(null, { status: 404 }));
  assert.deepEqual(remote, {});
  assert.equal(planSync(config, { sources }, remote).any_update, true);
});

for (const status of [401, 403, 429, 500, 503]) {
  test(`HTTP ${status} stops sync instead of returning empty state`, async () => {
    await assert.rejects(fetchManifest(env, async () => new Response(null, { status })), /refusing to rebuild/);
  });
}

test("network and timeout failures stop sync", async () => {
  for (const error of [new TypeError("fetch failed"), new DOMException("Timed out", "TimeoutError")]) {
    await assert.rejects(fetchManifest(env, async () => { throw error; }), error);
  }
});

test("invalid JSON and malformed manifests stop sync", async () => {
  await assert.rejects(fetchManifest(env, async () => new Response("not JSON")), SyntaxError);
  for (const value of [null, {}, [], { schemaVersion: 2, sources: {}, files: [] }, { ...manifest, files: [null] }]) {
    await assert.rejects(fetchManifest(env, async () => Response.json(value)), /Invalid deployed manifest/);
  }
});

test("legacy Sarasa manifest remains supported", async () => {
  const legacy = { tag: "v1", files: manifest.files };
  assert.deepEqual(await fetchManifest(env, async () => Response.json(legacy)), legacy);
});

test("missing credentials fail before making a request", async () => {
  await assert.rejects(fetchManifest({ ...env, CLOUDFLARE_API_TOKEN: "" }, async () => {
    assert.fail("must not fetch without credentials");
  }), /Missing required environment variable/);
});
