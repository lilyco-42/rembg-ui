import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('deploy_site', Path(__file__).parents[1] / 'scripts' / 'deploy_site.py')
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)


class DeploymentTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.base = Path(self.directory.name)
        self.root = self.base / 'public'
        self.stage = self.base / 'stage'
        self.backups = self.base / 'backups'
        self.root.mkdir()
        self.stage.mkdir()
        self.expected = {}
        for name in deployment.FILES:
            source = self.stage / name
            source.parent.mkdir(parents=True, exist_ok=True)
            source.write_text('new: ' + name)
        for name in ('index.html', 'sub/buy.html', 'assets/studio.js'):
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text('old: ' + name)
            self.expected[name] = hashlib.sha256(target.read_bytes()).hexdigest()

    def test_publishes_only_allowlist_with_private_backup(self):
        (self.root / 'billing.db').write_text('unchanged')
        result = deployment.publish(self.root, self.stage, self.expected, 'test-revision', self.backups)
        self.assertEqual(result['files'], len(deployment.FILES))
        self.assertEqual((self.root / 'billing.db').read_text(), 'unchanged')
        self.assertEqual((Path(result['backup']) / 'index.html').read_text(), 'old: index.html')
        for name in deployment.FILES:
            self.assertEqual((self.root / name).read_bytes(), (self.stage / name).read_bytes())

    def test_refuses_live_drift_and_public_backups(self):
        (self.root / 'index.html').write_text('another editor changed this')
        with self.assertRaises(RuntimeError):
            deployment.publish(self.root, self.stage, self.expected, 'test', self.backups)
        self.assertFalse((self.root / 'product-images').exists())
        with self.assertRaises(RuntimeError):
            deployment.publish(self.root, self.stage, {}, 'test', self.root / 'backup')

    def test_recovers_files_after_partial_failure(self):
        original = deployment.atomic_copy
        calls = 0

        def fail_once(source, target):
            nonlocal calls
            calls += 1
            if calls == 8:
                raise OSError('simulated interrupted deployment')
            original(source, target)

        with patch.object(deployment, 'atomic_copy', side_effect=fail_once):
            with self.assertRaises(OSError):
                deployment.publish(self.root, self.stage, self.expected, 'test', self.backups)
        for name, expected in self.expected.items():
            self.assertEqual(deployment.digest(self.root / name), expected)
        self.assertFalse((self.root / 'product-images/index.html').exists())

    def test_refuses_symlinks_outside_named_target(self):
        outside = self.base / 'outside'
        outside.mkdir()
        (self.root / 'product-images').symlink_to(outside, target_is_directory=True)
        with self.assertRaises(RuntimeError):
            deployment.publish(self.root, self.stage, self.expected, 'test', self.backups)
        self.assertEqual(list(outside.iterdir()), [])
