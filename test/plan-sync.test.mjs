import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { planSync } from "../scripts/plan-sync.mjs";
import { resolveSarasaRelease } from "../scripts/release-lib.mjs";

const config = JSON.parse(readFileSync(new URL("../fonts.config.json", import.meta.url)));
const sources = { sarasa: { tag: "v1.0.41" }, nerdFonts: { tag: "v3.5.1" } };
const files = config.sarasa.families.flatMap(family => config.sarasa.styles.map(style => ({ name: `${family}-${style}.woff2` })));
files.push({name: "SymbolsNerdFontMono-Regular.woff2"});
const remote = { sources, files };

test("five regions contain UI and Fixed with all ten styles", () => {
  assert.equal(files.length, 101);
  for (const region of ["SC", "TC", "HC", "J", "K"]) {
    for (const family of ["Ui", "Fixed"]) assert(config.sarasa.families.includes(`Sarasa${family}${region}`));
  }
  const result = resolveSarasaRelease({ tag_name: "v1.0.41", assets: config.sarasa.families.map(family => ({ name: `${family}-TTF-1.0.41.7z`, browser_download_url: `https://example.test/${family}.7z` })) }, config.sarasa);
  assert.equal(result.assets.length, 10);
});
test("complete current release does not rebuild", () => {
  assert.equal(planSync(config, {sources}, remote).any_update, false);
});
test("same release with missing regional fonts rebuilds Sarasa only", () => {
  const oldFiles = files.filter(file => !/Sarasa(?:Ui|Fixed)(?:TC|HC|J|K)-/.test(file.name));
  const plan = planSync(config, {sources}, { sources, files: oldFiles });
  assert.equal(plan.sarasa_update, true);
  assert.equal(plan.nerd_update, false);
});
test("missing Nerd font is independent", () => {
  const plan = planSync(config, {sources}, {sources, files: files.slice(0, -1)});
  assert.equal(plan.sarasa_update, false);
  assert.equal(plan.nerd_update, true);
});
test("new release, first run and force rebuild", () => {
  assert.equal(planSync(config, {sources: {...sources, sarasa: {tag: "v2"}}}, remote).sarasa_update, true);
  assert.equal(planSync(config, {sources}, {}).any_update, true);
  const forced = planSync(config, {sources}, remote, true);
  assert(forced.sarasa_update && forced.nerd_update);
});
