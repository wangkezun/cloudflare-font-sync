#!/usr/bin/env python3
import hashlib
import json
import os
from concurrent.futures import ProcessPoolExecutor
from itertools import repeat
import sys
from datetime import datetime, timezone
from pathlib import Path

from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "fonts.config.json"
RELEASE_PATH = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "build/release.json")
INPUT_DIR = Path(sys.argv[2] if len(sys.argv) > 2 else ROOT / "build/ttf")
OUTPUT_DIR = Path(sys.argv[3] if len(sys.argv) > 3 else ROOT / "build/woff2/sarasa")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def convert_font(input_path: Path, output_dir: Path) -> dict:
    output = output_dir / f"{input_path.stem}.woff2"
    with TTFont(input_path, recalcTimestamp=False) as font:
        font.flavor = "woff2"
        font.save(output, reorderTables=False)
    print(f"Converted {input_path.name} -> {output.name}", flush=True)
    return {"name": output.name, "sha256": sha256(output), "size": output.stat().st_size}


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text())
    release = json.loads(RELEASE_PATH.read_text())
    sarasa_config = config["sarasa"]
    expected = [
        f"{family}-{style}.ttf"
        for family in sarasa_config["families"]
        for style in sarasa_config["styles"]
    ]

    found = {}
    for path in INPUT_DIR.rglob("*.ttf"):
        if path.name in expected:
            if path.name in found:
                raise RuntimeError(f"Duplicate input font: {path.name}")
            found[path.name] = path

    missing = sorted(set(expected) - set(found))
    if missing:
        raise RuntimeError(f"Missing expected TTF files: {', '.join(missing)}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    workers = max(1, min(4, os.cpu_count() or 1))
    print(f"Converting {len(expected)} fonts with {workers} workers", flush=True)
    with ProcessPoolExecutor(max_workers=workers) as pool:
        files = list(pool.map(convert_font, [found[name] for name in expected], repeat(OUTPUT_DIR)))

    source_release = release["sources"]["sarasa"]
    for file in files:
        file["source"] = "sarasa"
        file["key"] = f"releases/sarasa/{source_release['tag']}/{file['name']}"

    manifest = {
        "source": "sarasa",
        "release": {
            "tag": source_release["tag"],
            "version": source_release["version"],
            "upstream": source_release["releaseUrl"],
        },
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "files": files,
    }
    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
