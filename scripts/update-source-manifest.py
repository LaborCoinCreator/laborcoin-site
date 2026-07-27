#!/usr/bin/env python3
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs" / "CURRENT-SOURCE-MANIFEST.json"

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

data = json.loads(MANIFEST.read_text(encoding="utf-8"))
for entry in data["files"]:
    path = ROOT / entry["path"]
    if not path.is_file():
        raise SystemExit(f"Missing manifest file: {entry['path']}")
    entry["size_bytes"] = path.stat().st_size
    entry["sha256"] = sha256(path)
MANIFEST.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8", newline="\n")
print(f"Updated {MANIFEST.relative_to(ROOT)} for {len(data['files'])} deployable files.")
