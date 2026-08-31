import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { resolveNerdFontsRelease, resolveSarasaRelease } from "./release-lib.mjs";

const outputPath = resolve(process.argv[2] ?? "build/release.json");
const config = JSON.parse(await readFile(new URL("../fonts.config.json", import.meta.url), "utf8"));
const headers = {
  accept: "application/vnd.github+json",
  "user-agent": "cloudflare-font-sync",
  "x-github-api-version": "2022-11-28",
};
if (process.env.SARASA_GITHUB_TOKEN) {
  headers.authorization = `Bearer ${process.env.SARASA_GITHUB_TOKEN}`;
}

async function fetchLatestRelease(upstream) {
  const response = await fetch(`https://api.github.com/repos/${upstream}/releases/latest`, { headers });
  if (!response.ok) {
    throw new Error(
      `GitHub Releases API for ${upstream} returned ${response.status}: ${await response.text()}`,
    );
  }
  return response.json();
}

const [sarasaRelease, nerdFontsRelease] = await Promise.all([
  fetchLatestRelease(config.sarasa.upstream),
  fetchLatestRelease(config.nerdFonts.upstream),
]);
const result = {
  sources: {
    sarasa: resolveSarasaRelease(sarasaRelease, config.sarasa),
    nerdFonts: resolveNerdFontsRelease(nerdFontsRelease, config.nerdFonts),
  },
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `Resolved Sarasa ${result.sources.sarasa.tag} and Nerd Fonts ${result.sources.nerdFonts.tag}`,
);
