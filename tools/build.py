"""Build an installable module ZIP without a release or external dependencies."""

import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "module.json").read_text(encoding="utf-8"))
destination = root / "dist" / f"background-volume-{manifest['version']}.zip"
destination.parent.mkdir(exist_ok=True)
files = [root / name for name in ("module.json", "LICENSE", "README.md")]
for directory in ("scripts", "html", "lang", "images"):
    files.extend(p for p in (root / directory).rglob("*") if p.is_file())

with ZipFile(destination, "w", compression=ZIP_DEFLATED) as archive:
    for path in sorted(files):
        entry = ZipInfo(path.relative_to(root).as_posix(), (2026, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, path.read_bytes())
print(destination)
