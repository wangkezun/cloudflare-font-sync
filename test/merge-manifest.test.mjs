import assert from "node:assert/strict";
import test from "node:test";
import { applyPartial, normalizeManifest } from "../scripts/merge-manifest.mjs";

test("migrates the original Sarasa-only manifest", () => {
  const result = normalizeManifest({
    tag: "v1.0.41",
    version: "1.0.41",
    upstream: "https://example.test/sarasa",
    files: [{ name: "SarasaFixedSC-Regular.woff2", sha256: "old", size: 1 }],
  });

  assert.equal(result.schemaVersion, 2);
  assert.equal(result.sources.sarasa.tag, "v1.0.41");
  assert.equal(result.files[0].key, "releases/v1.0.41/SarasaFixedSC-Regular.woff2");
});

test("updates one source without replacing files from the other", () => {
  const manifest = normalizeManifest({
    schemaVersion: 2,
    sources: { sarasa: { tag: "v1.0.41" }, nerdFonts: { tag: "v3.5.0" } },
    files: [
      { name: "SarasaFixedSC-Regular.woff2", source: "sarasa", key: "sarasa-old" },
      { name: "SymbolsNerdFontMono-Regular.woff2", source: "nerdFonts", key: "nerd-old" },
    ],
  });

  applyPartial(manifest, {
    source: "nerdFonts",
    release: { tag: "v3.5.1" },
    files: [
      { name: "SymbolsNerdFontMono-Regular.woff2", source: "nerdFonts", key: "nerd-new" },
    ],
  });

  assert.equal(manifest.sources.sarasa.tag, "v1.0.41");
  assert.equal(manifest.sources.nerdFonts.tag, "v3.5.1");
  assert.deepEqual(
    manifest.files.map((file) => file.key).sort(),
    ["nerd-new", "sarasa-old"],
  );
});
