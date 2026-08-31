import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { resolveRelease } from "./release-lib.mjs";

const outputPath = resolve(process.argv[2] ?? "build/release.json");
const config = JSON.parse(await readFile(new URL("../fonts.config.json", import.meta.url), "utf8"));
const headers = {
  accept: "application/vnd.github+json",
  "user-agent": "sarasa-fonts-cf",
  "x-github-api-version": "2022-11-28",
};
if (process.env.SARASA_GITHUB_TOKEN) {
  headers.authorization = `Bearer ${process.env.SARASA_GITHUB_TOKEN}`;
}

const response = await fetch(`https://api.github.com/repos/${config.upstream}/releases/latest`, {
  headers,
});
if (!response.ok) {
  throw new Error(`GitHub Releases API returned ${response.status}: ${await response.text()}`);
}

const result = resolveRelease(await response.json(), config);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Resolved ${result.tag}: ${result.assets.map((asset) => asset.name).join(", ")}`);
