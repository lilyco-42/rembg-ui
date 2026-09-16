import pathlib
import json
import subprocess
import tempfile
import unittest
import zipfile


class ProductZipTests(unittest.TestCase):
    def test_browser_zip_utf8_names_and_crc(self):
        root = pathlib.Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as folder:
            archive = pathlib.Path(folder) / "delivery.zip"
            subprocess.run(["node", "tests/product_workflow.test.cjs", str(archive)], cwd=root, check=True)
            with zipfile.ZipFile(archive) as bundle:
                self.assertIsNone(bundle.testzip())
                self.assertEqual(bundle.namelist(), ["product_夏季_商品_001.jpg", "product_夏季_商品_002.jpg", "delivery-manifest.json"])
                self.assertEqual(json.loads(bundle.read("delivery-manifest.json")), {"source": "夏季商品"})
                self.assertEqual(bundle.read(bundle.namelist()[0]), b"hello")
