"""Generate the room package manifest from its authored package and foundation declarations."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'authoring/package.json').read_text())
manifest.update(json.loads((root / 'authoring/foundations.json').read_text()))
indexed = {item['path']: item for item in manifest['files']}
for folder in ('classes', 'notices'):
    for path in sorted((root / folder).rglob('*')):
        if path.is_file():
            relative = path.relative_to(root).as_posix()
            indexed[relative] = {'path': relative, 'executable': False}
manifest['files'] = [indexed[key] for key in sorted(indexed)]
(root / 'component.json').write_text(json.dumps(manifest, separators=(',', ':'), ensure_ascii=False, sort_keys=True))
