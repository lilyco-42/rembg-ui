import contextlib
import hashlib
import io
import json
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/deploy.py'
sha = lambda data: hashlib.sha256(data).hexdigest()

class DeploymentBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.stage, self.root, self.backups = [self.base / p for p in ('stage','live','backups')]
        self.originals = {name: ('old ' + name).encode() for name in ('downloads/index.html','downloads/manifest.json','downloads/downloads.css')}
        for name, data in self.originals.items():
            p = self.root / name;p.parent.mkdir(parents=True, exist_ok=True);p.write_bytes(data)
            p = self.stage / 'site' / name;p.parent.mkdir(parents=True, exist_ok=True);p.write_bytes(b'new '+data)
        self.sentinel = self.root / 'unrelated-customer-data.bin'
        self.sentinel.write_bytes(b'preserve this exact file')
        guide = self.stage / 'site/downloads/rembg/index.html';guide.parent.mkdir();guide.write_bytes(b'guide')
        (self.stage / 'packages').mkdir()
        packages = []
        for ident, folder, file in [('rembg-studio-windows','rembg-ui/v0.2.7-20261011-0249','Rembg-UI-windows.zip'),('scrcpy-windows','scrcpy/v5.0.1','scrcpy-win64-v5.0.1.zip')]:
            data = ('test fixture '+ident).encode();(self.stage / 'packages' / file).write_bytes(data)
            packages.append({'id':ident,'file':file,'size':len(data),'sha256':sha(data),'url':f'https://lain42.top/downloads/files/{folder}/{file}'})
        (self.stage / 'packages.json').write_text(json.dumps(packages))
        (self.stage / 'deployment-baseline.json').write_text(json.dumps({'existing':{n:sha(v) for n,v in self.originals.items()},'new':['downloads/rembg/index.html']}))
        self.argv = [str(SCRIPT),'--stage',str(self.stage),'--root',str(self.root),'--backup-root',str(self.backups)]

    def run_command(self):
        return subprocess.run([sys.executable]+self.argv, capture_output=True, text=True)

    def assert_originals(self):
        for name,data in self.originals.items():self.assertEqual((self.root/name).read_bytes(),data)
        self.assertEqual(self.sentinel.read_bytes(),b'preserve this exact file')
        self.assertFalse((self.root/'downloads/rembg/index.html').exists())
        self.assertEqual(list(self.root.glob('downloads/files/**/*.zip')),[])

    def test_publishes_only_allowlisted_files_and_retains_private_originals(self):
        result=self.run_command();self.assertEqual(result.returncode,0,result.stderr)
        proof=json.loads(result.stdout);self.assertEqual(len(proof['files']),6)
        backup=Path(proof['backup']);self.assertEqual(backup.stat().st_mode & 0o777,0o700)
        for name,data in self.originals.items():
            self.assertEqual((backup/name).read_bytes(),data)
            self.assertEqual((backup/name).stat().st_mode & 0o777,0o600)
            self.assertEqual((self.root/name).read_bytes(),b'new '+data)
        self.assertEqual(self.sentinel.read_bytes(),b'preserve this exact file')

    def test_concurrent_live_change_stops_before_any_publication(self):
        changed=self.root/'downloads/manifest.json';changed.write_bytes(b'other editor')
        result=self.run_command();self.assertNotEqual(result.returncode,0)
        self.assertIn('Live file changed',result.stderr)
        self.assertEqual(changed.read_bytes(),b'other editor')
        self.assertFalse((self.root/'downloads/files').exists())
        self.assertEqual((self.root/'downloads/index.html').read_bytes(),self.originals['downloads/index.html'])

    def test_tampered_package_is_not_published(self):
        (self.stage/'packages/Rembg-UI-windows.zip').write_bytes(b'tampered')
        self.assertNotEqual(self.run_command().returncode,0)
        self.assert_originals()

    def test_mid_publication_io_failure_rolls_back_new_files(self):
        original_copy=shutil.copyfileobj
        def fail_css(src,dest,*args,**kwargs):
            if str(src.name).endswith('/site/downloads/downloads.css'):raise OSError('simulated write failure')
            return original_copy(src,dest,*args,**kwargs)
        with patch.object(sys,'argv',self.argv),patch('shutil.copyfileobj',side_effect=fail_css),contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(OSError,'simulated write failure'):runpy.run_path(str(SCRIPT),run_name='__main__')
        self.assert_originals()
        self.assertEqual(list(self.root.rglob('.resource-*')),[])

if __name__=='__main__':unittest.main()
