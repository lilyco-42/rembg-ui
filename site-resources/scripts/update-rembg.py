"""Publish a verified versioned ZIP and the two reviewed existing resource pages."""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--stage', type=Path, required=True)
parser.add_argument('--root', type=Path, default=Path('/var/www/studio'))
parser.add_argument('--backup-root', type=Path, default=Path('/root/website-backups'))
args = parser.parse_args()
stage, root = args.stage.resolve(), args.root.resolve()
baseline = json.loads((stage / 'rembg-update-baseline.json').read_text())['existing']
assert set(baseline) == {'downloads/manifest.json', 'downloads/rembg/index.html'}
entry, = [p for p in json.loads((stage / 'packages.json').read_text()) if p['id'] == 'rembg-studio-windows']
relative = 'downloads/files/rembg-ui/v0.2.7-20261028-1536/Rembg-UI-windows.zip'
assert entry['file'] == 'Rembg-UI-windows.zip' and entry['url'] == 'https://lain42.top/' + relative

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

args.backup_root.mkdir(mode=0o700, parents=True, exist_ok=True)
lock = (args.backup_root / 'resource-downloads.lock').open('a')
fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
for name, old_hash in baseline.items():
    assert digest(root / name) == old_hash, f'Live file changed: {name}'
package = stage / 'packages' / entry['file']
assert package.stat().st_size == entry['size'] and digest(package) == entry['sha256'], 'Package differs'
assert not (root / relative).exists(), 'Versioned target already exists'
publication = [(relative, package, entry['sha256'])]
for name in ['downloads/rembg/index.html', 'downloads/manifest.json']:
    source = stage / 'site' / name
    assert source.is_file() and not source.is_symlink()
    publication.append((name, source, digest(source)))
assert shutil.disk_usage(root).free >= sum(p.stat().st_size for _, p, _ in publication) + 256 * 1024 * 1024
backup = args.backup_root / ('rembg-update-' + datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S-%f'))
backup.mkdir(mode=0o700)
for name in baseline:
    dest = backup / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / name, dest)
    dest.chmod(0o600)

def atomic_copy(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.resource-', dir=target.parent)
    try:
        with os.fdopen(fd, 'wb') as dest, source.open('rb') as src:
            shutil.copyfileobj(src, dest)
            dest.flush()
            os.fsync(dest.fileno())
        os.chmod(temporary, 0o644)
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)

changed = []
try:
    for name, source, new_hash in publication:
        target = root / name
        if name in baseline:
            assert digest(target) == baseline[name], f'Concurrent edit: {name}'
        else:
            assert not target.exists(), f'Concurrent new file: {name}'
        atomic_copy(source, target)
        changed.append((name, new_hash))
        assert digest(target) == new_hash
except BaseException:
    for name, deployed_hash in reversed(changed):
        target = root / name
        if target.exists() and digest(target) == deployed_hash:
            if name in baseline:
                atomic_copy(backup / name, target)
            else:
                target.unlink()
    raise
result = {'backup': str(backup), 'files': [{'path': n, 'sha256': h} for n, h in changed]}
(backup / 'deployed.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
