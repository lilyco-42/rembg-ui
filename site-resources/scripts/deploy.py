"""Narrow reviewed-file deployment. Run on the website host with verified CI staging."""
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
baseline = json.loads((stage / 'deployment-baseline.json').read_text())
packages = json.loads((stage / 'packages.json').read_text())
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
expected_existing = {'downloads/index.html','downloads/manifest.json','downloads/downloads.css'}
assert set(baseline['existing']) == expected_existing
assert baseline['new'] == ['downloads/rembg/index.html']
assert {p['id'] for p in packages} == {'rembg-studio-windows','scrcpy-windows'}

args.backup_root.mkdir(mode=0o700, parents=True, exist_ok=True)
lock = (args.backup_root / 'resource-downloads.lock').open('a')
fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
for name, old_hash in baseline['existing'].items():
    assert digest(root / name) == old_hash, f'Live file changed: {name}'

publication = []
for package in packages:
    # Fixed public target, independently checked against the reviewed catalog URL.
    folder = 'rembg-ui/v0.2.7-20261011-0249' if package['id'].startswith('rembg') else 'scrcpy/v5.0.1'
    relative = 'downloads/files/' + folder + '/' + package['file']
    assert package['url'] == 'https://lain42.top/' + relative
    source = stage / 'packages' / package['file']
    assert source.stat().st_size == package['size'] and digest(source) == package['sha256']
    assert not (root / relative).exists(), f'New target already exists: {relative}'
    publication.append((relative, source, package['sha256']))
for name in ['downloads/rembg/index.html','downloads/downloads.css','downloads/index.html','downloads/manifest.json']:
    source = stage / 'site' / name
    assert source.is_file() and not source.is_symlink()
    if name in baseline['new']:
        assert not (root / name).exists(), f'New page already exists: {name}'
    publication.append((name, source, digest(source)))

required = sum(source.stat().st_size for _, source, _ in publication) + 256 * 1024 * 1024
assert shutil.disk_usage(root).free >= required, 'Insufficient deployment headroom'
backup = args.backup_root / ('software-resources-' + datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S'))
backup.mkdir(mode=0o700)
for name in baseline['existing']:
    target = backup / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / name, target)
    target.chmod(0o600)
changed = []

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

try:
    for name, source, new_hash in publication:
        target = root / name
        if name in baseline['existing']:
            assert digest(target) == baseline['existing'][name], f'Concurrent edit: {name}'
        else:
            assert not target.exists(), f'Concurrent new file: {name}'
        atomic_copy(source, target)
        changed.append((name, new_hash))
        assert digest(target) == new_hash, f'Deployed bytes differ: {name}'
except BaseException:
    for name, deployed_hash in reversed(changed):
        target = root / name
        if not target.exists() or digest(target) != deployed_hash:
            continue  # Never overwrite a third party's concurrent changes.
        if name in baseline['existing']:
            atomic_copy(backup / name, target)
        else:
            target.unlink()
    raise
result = {'backup': str(backup), 'files': [{'path': n, 'sha256': h} for n, h in changed]}
(backup / 'deployed.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
