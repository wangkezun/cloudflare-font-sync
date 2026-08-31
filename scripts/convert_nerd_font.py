#!/usr/bin/env python3
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "fonts.config.json"
RELEASE_PATH = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "build/release.json")
INPUT_DIR = Path(sys.argv[2] if len(sys.argv) > 2 else ROOT / "build/nerd-fonts")
OUTPUT_DIR = Path(sys.argv[3] if len(sys.argv) > 3 else ROOT / "build/woff2/nerd-fonts")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text())
    release = json.loads(RELEASE_PATH.read_text())
    source_release = release["sources"]["nerdFonts"]
    expected = config["nerdFonts"]["files"]
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    files = []

    for ttf_name in expected:
        matches = list(INPUT_DIR.rglob(ttf_name))
        if len(matches) != 1:
            raise RuntimeError(f"Expected exactly one {ttf_name}, found {len(matches)}")

        output = OUTPUT_DIR / f"{Path(ttf_name).stem}.woff2"
        font = TTFont(matches[0], recalcTimestamp=False)
        font.flavor = "woff2"
        font.save(output, reorderTables=False)
        font.close()
        files.append(
            {
                "name": output.name,
                "source": "nerdFonts",
                "key": f"releases/nerd-fonts/{source_release['tag']}/{output.name}",
                "sha256": sha256(output),
                "size": output.stat().st_size,
            }
        )
        print(f"Converted {ttf_name} -> {output.name}")

    partial = {
        "source": "nerdFonts",
        "release": {
            "tag": source_release["tag"],
            "version": source_release["version"],
            "upstream": source_release["releaseUrl"],
        },
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "files": files,
    }
    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(partial, indent=2) + "\n")


if __name__ == "__main__":
    main()
