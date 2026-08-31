import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== null) return fallback;
    throw error;
  }
}

export function normalizeManifest(input) {
  if (input?.schemaVersion === 2) {
    return {
      schemaVersion: 2,
      sources: { ...input.sources },
      files: [...(input.files ?? [])],
    };
  }

  // Migrate manifests created by the original Sarasa-only implementation.
  if (input?.tag && Array.isArray(input.files)) {
    return {
      schemaVersion: 2,
      sources: {
        sarasa: {
          tag: input.tag,
          version: input.version,
          upstream: input.upstream,
        },
      },
      files: input.files.map((file) => ({
        ...file,
        source: "sarasa",
        key: `releases/${input.tag}/${file.name}`,
      })),
    };
  }

  return { schemaVersion: 2, sources: {}, files: [] };
}

export function applyPartial(manifest, partial) {
  manifest.sources[partial.source] = partial.release;
  manifest.files = [
    ...manifest.files.filter((file) => file.source !== partial.source),
    ...partial.files,
  ].sort((left, right) => left.name.localeCompare(right.name));
  return manifest;
}

const [remoteArg, outputArg, ...partialArgs] = process.argv.slice(2);
if (remoteArg && outputArg) {
  const remotePath = resolve(remoteArg);
  const outputPath = resolve(outputArg);
  const manifest = normalizeManifest(await readJson(remotePath, {}));
  for (const partialPath of partialArgs) {
    applyPartial(manifest, await readJson(resolve(partialPath)));
  }
  manifest.updatedAt = new Date().toISOString();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Merged ${manifest.files.length} files from ${Object.keys(manifest.sources).join(", ")}`,
  );
}
