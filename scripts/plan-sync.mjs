import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function planSync(config, latest, remote, force = false) {
  const files = new Set((remote.files ?? []).map(file => file.name));
  const sarasaMissing = config.sarasa.families.some(family =>
    config.sarasa.styles.some(style => !files.has(`${family}-${style}.woff2`)));
  const nerdMissing = config.nerdFonts.files.some(file =>
    !files.has(file.replace(/\.ttf$/i, ".woff2")));
  const sarasa_update = force || sarasaMissing ||
    latest.sources.sarasa.tag !== (remote.sources?.sarasa?.tag ?? remote.tag);
  const nerd_update = force || nerdMissing ||
    latest.sources.nerdFonts.tag !== remote.sources?.nerdFonts?.tag;
  return { sarasa_update, nerd_update, any_update: sarasa_update || nerd_update,
    latest_sarasa: latest.sources.sarasa.tag, latest_nerd: latest.sources.nerdFonts.tag };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const readJSON = async path => JSON.parse(await readFile(path, "utf8"));
  const [config, latest, remote] = await Promise.all([
    readJSON(new URL("../fonts.config.json", import.meta.url)),
    readJSON(process.argv[2] ?? "build/release.json"),
    readJSON(process.argv[3] ?? "build/remote-manifest.json"),
  ]);
  for (const [key, value] of Object.entries(planSync(config, latest, remote, process.env.FORCE === "true"))) {
    console.log(`${key}=${value}`);
  }
}
