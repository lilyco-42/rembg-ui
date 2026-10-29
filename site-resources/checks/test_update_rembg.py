import contextlib
import hashlib
import io
import json
from pathlib import Path
import runpy
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/update-rembg.py'
sha = lambda data: hashlib.sha256(data).hexdigest()

class UpdateBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        base = Path(self.temp.name)
        self.stage, self.root, self.backups = [base / p for p in ('stage', 'live', 'backups')]
        self.old = {n: ('old ' + n).encode() for n in ['downloads/manifest.json', 'downloads/rembg/index.html']}
        for name, data in self.old.items():
            for parent, content in [(self.root, data), (self.stage / 'site', b'new ' + data)]:
                p = parent / name
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes(content)
        self.sentinel = self.root / 'downloads/files/old.zip'
        self.sentinel.parent.mkdir(parents=True)
        self.sentinel.write_bytes(b'previous download')
        (self.stage / 'packages').mkdir()
        (self.stage / 'packages/Rembg-UI-windows.zip').write_bytes(b'fixture archive')
        entry = {'id': 'rembg-studio-windows', 'file': 'Rembg-UI-windows.zip', 'size': 15, 'sha256': sha(b'fixture archive'),
                 'url': 'https://lain42.top/downloads/files/rembg-ui/v0.2.7-20261028-1536/Rembg-UI-windows.zip'}
        (self.stage / 'packages.json').write_text(json.dumps([entry]))
        (self.stage / 'rembg-update-baseline.json').write_text(json.dumps({'existing': {n: sha(v) for n, v in self.old.items()}}))
        self.argv = [str(SCRIPT), '--stage', str(self.stage), '--root', str(self.root), '--backup-root', str(self.backups)]

    def run_update(self):
        with patch.object(sys, 'argv', self.argv), contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(SCRIPT), run_name='__main__')

    def assert_originals(self):
        for name, data in self.old.items():
            self.assertEqual((self.root / name).read_bytes(), data)
        self.assertEqual(self.sentinel.read_bytes(), b'previous download')
        self.assertEqual(list(self.root.glob('downloads/files/rembg-ui/**/*.zip')), [])

    def test_publishes_three_reviewed_files_preserving_previous_downloads(self):
        self.run_update()
        for name, data in self.old.items():
            self.assertEqual((self.root / name).read_bytes(), b'new ' + data)
        self.assertEqual(self.sentinel.read_bytes(), b'previous download')
        backup, = self.backups.glob('rembg-update-*')
        self.assertEqual(backup.stat().st_mode & 0o777, 0o700)
        self.assertEqual(len(json.loads((backup / 'deployed.json').read_text())['files']), 3)

    def test_concurrent_change_refuses_to_publish(self):
        target = self.root / 'downloads/manifest.json'
        target.write_bytes(b'other editor')
        with self.assertRaisesRegex(AssertionError, 'Live file changed'):
            self.run_update()
        self.assertEqual(target.read_bytes(), b'other editor')
        self.assertEqual(list(self.root.glob('downloads/files/rembg-ui/**/*.zip')), [])

    def test_tampered_archive_refuses_to_publish(self):
        (self.stage / 'packages/Rembg-UI-windows.zip').write_bytes(b'tampered')
        with self.assertRaisesRegex(AssertionError, 'Package differs'):
            self.run_update()
        self.assert_originals()

    def test_late_write_failure_restores_both_pages_and_removes_new_archive(self):
        original = shutil.copyfileobj
        def fail_manifest(src, dest, *args, **kwargs):
            if str(src.name).endswith('/site/downloads/manifest.json'):
                raise OSError('simulated publication failure')
            return original(src, dest, *args, **kwargs)
        with patch('shutil.copyfileobj', side_effect=fail_manifest):
            with self.assertRaisesRegex(OSError, 'simulated publication failure'):
                self.run_update()
        self.assert_originals()
        self.assertEqual(list(self.root.rglob('.resource-*')), [])
