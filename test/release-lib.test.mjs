import assert from "node:assert/strict";
import test from "node:test";
import { resolveRelease } from "../scripts/release-lib.mjs";

const config = { families: ["SarasaFixedSC", "SarasaUiSC"] };

test("resolves the two required family assets", () => {
  const result = resolveRelease(
    {
      tag_name: "v1.0.41",
      html_url: "https://github.com/be5invis/Sarasa-Gothic/releases/tag/v1.0.41",
      draft: false,
      prerelease: false,
      assets: [
        {
          name: "SarasaFixedSC-TTF-1.0.41.7z",
          size: 10,
          browser_download_url: "https://example.test/fixed.7z",
        },
        {
          name: "SarasaUiSC-TTF-1.0.41.7z",
          size: 11,
          browser_download_url: "https://example.test/ui.7z",
        },
      ],
    },
    config,
  );

  assert.equal(result.tag, "v1.0.41");
  assert.equal(result.version, "1.0.41");
  assert.deepEqual(
    result.assets.map((asset) => asset.name),
    ["SarasaFixedSC-TTF-1.0.41.7z", "SarasaUiSC-TTF-1.0.41.7z"],
  );
});

test("fails closed when an upstream asset was renamed", () => {
  assert.throws(
    () =>
      resolveRelease(
        {
          tag_name: "v2.0.0",
          draft: false,
          prerelease: false,
          assets: [],
        },
        config,
      ),
    /Required release asset is missing/,
  );
});
