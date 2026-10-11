"""Publish only the reviewed static files; run on the web host after CI passes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import time
import uuid

FILES = (
    'product-images/index.html', 'product-images/product-images.css',
    'product-images/product-images.js', 'product-images/product-brief.js',
    'product-images/product-image-guide.md', 'assets/commerce-entry.css',
    'assets/studio.js', 'index.html', 'sub/buy.html',
)


def within(base, name):
    target = (base / name).resolve()
    if not target.is_relative_to(base.resolve()):
        raise RuntimeError('Path is outside the named deployment directory')
    return target


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def atomic_copy(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.name + '.new-' + uuid.uuid4().hex)
    try:
        shutil.copyfile(source, temporary)
        os.chmod(temporary, 0o644)
        os.replace(temporary, target)
    finally:
        if temporary.exists():
            temporary.unlink()


def publish(root, stage, expected, revision, backup_root):
    root = Path(root).resolve()
    stage = Path(stage).resolve()
    backup_root = Path(backup_root).resolve()
    if not root.is_dir() or not stage.is_dir():
        raise RuntimeError('Deployment or staging directory is absent')
    if backup_root.is_relative_to(root):
        raise RuntimeError('Backups must be outside the public website')
    for name, sha in expected.items():
        if digest(within(root, name)) != sha:
            raise RuntimeError('Live file changed since review: ' + name)
    for name in FILES:
        if not within(stage, name).is_file():
            raise RuntimeError('Artifact is missing ' + name)
    backup = backup_root / ('commerce-' + time.strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:6])
    backup.mkdir(parents=True, mode=0o700)
    existed = {}
    for name in FILES:
        target = within(root, name)
        existed[name] = target.exists()
        if target.exists():
            old = within(backup, name)
            old.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(target, old)
    (backup / 'manifest.json').write_text(json.dumps({'revision': revision, 'existed': existed}, indent=2))
    updated = []
    try:
        for name in FILES:
            atomic_copy(within(stage, name), within(root, name))
            updated.append(name)
        for name in FILES:
            if digest(within(root, name)) != digest(within(stage, name)):
                raise RuntimeError('Published checksum differs: ' + name)
    except Exception:
        for name in reversed(updated):
            target = within(root, name)
            if existed[name]:
                atomic_copy(within(backup, name), target)
            elif target.exists():
                target.unlink()
        raise
    return {'revision': revision, 'backup': str(backup), 'files': len(FILES)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', required=True)
    parser.add_argument('--baseline', required=True)
    parser.add_argument('--revision', required=True)
    args = parser.parse_args()
    expected = json.loads(Path(args.baseline).read_text())
    result = publish('/var/www/studio', args.stage, expected, args.revision, '/root/website-backups')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
