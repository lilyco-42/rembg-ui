"""Actions-only upstream byte/ZIP verification; never execute downloaded programs."""
import hashlib
import json
import os
from pathlib import Path
import urllib.request
import zipfile

if os.environ.get('GITHUB_ACTIONS') != 'true':
    raise SystemExit('Run this verification in GitHub Actions')
root = Path(__file__).resolve().parents[1]
output = root / 'package-evidence'
output.mkdir(exist_ok=True)
results = []
for entry in json.loads((root / 'packages.json').read_text()):
    package_dir = root / 'verified-packages'
    package_dir.mkdir(exist_ok=True)
    target = package_dir / entry['file']
    digest = hashlib.sha256()
    size = 0
    with urllib.request.urlopen(entry['source_url'], timeout=120) as response, target.open('wb') as dest:
        for chunk in iter(lambda: response.read(1024 * 1024), b''):
            size += len(chunk)
            if size > entry['size']:
                raise RuntimeError('Upstream archive exceeds pinned size')
            digest.update(chunk)
            dest.write(chunk)
    assert size == entry['size'] and digest.hexdigest() == entry['sha256'], entry['id']
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None, 'ZIP CRC failure'
        files = archive.namelist()
        assert not any(p.startswith(('/', '\\')) or '..' in p.replace('\\', '/').split('/') for p in files)
        executable = 'rembg-ui.exe' if entry['id'].startswith('rembg') else 'scrcpy.exe'
        assert any(Path(p).name == executable for p in files), executable
        if entry['id'].startswith('rembg'):
            frontend = [p for p in files if p.replace('\\', '/').endswith('frontend/index.html')]
            assert len(frontend) == 1, 'Expected packaged UI'
            # Compare with the immutable source of the published release, which
            # may differ from this resource-maintenance branch's application UI.
            with urllib.request.urlopen(entry['frontend_source_url'], timeout=60) as response:
                original = response.read(4 * 1024 * 1024)
            assert hashlib.sha256(original).hexdigest() == entry['frontend_sha256'], 'Pinned release source differs'
            packaged = archive.read(frontend[0])
            # Windows Git checkouts can materialize CRLF. Permit only that
            # checkout transformation; all HTML/JS content must still match.
            ui_proof = {'source_url': entry['frontend_source_url'],
                        'source_sha256': hashlib.sha256(original).hexdigest(),
                        'packaged_sha256': hashlib.sha256(packaged).hexdigest(),
                        'source_crlf': original.count(b'\r\n'), 'packaged_crlf': packaged.count(b'\r\n'),
                        'normalized_match': packaged.replace(b'\r\n', b'\n') == original.replace(b'\r\n', b'\n')}
            (output / 'rembg-packaged-ui.json').write_text(json.dumps(ui_proof, indent=2) + '\n')
            assert ui_proof['normalized_match'], 'Packaged UI content differs from pinned release source'
            assert b'webkitdirectory' in original and '选择整个文件夹' in original.decode('utf-8')
        else:
            assert any(Path(p).name == 'adb.exe' for p in files), 'ADB is absent'
        (output / (entry['id'] + '-contents.txt')).write_text('\n'.join(files) + '\n')
    results.append({'id': entry['id'], 'source_url': entry['source_url'], 'size': size, 'sha256': digest.hexdigest(), 'zip_crc': 'passed', 'files': len(files)})
(output / 'VERIFIED.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2))
