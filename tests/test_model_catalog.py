import tempfile,os,unittest
from pathlib import Path
from unittest.mock import patch
import model_catalog as m
class CatalogTest(unittest.TestCase):
 def test_known_and_license_gated(self):
  self.assertIn("isnet-anime",m.catalog())
  with self.assertRaises(ValueError):m.install("bria-rmbg")
  with self.assertRaises(ValueError):m.install("../escape")
  with self.assertRaises(ValueError):m.install("u2netp",source="random")
 def test_import_local(self):
  with tempfile.TemporaryDirectory() as d:
   path=Path(d);src=path/"source.onnx";src.write_bytes(b"x"*1024)
   with patch.dict(os.environ,{"U2NET_HOME":str(path/"models")}):
    o=m.import_local("u2netp",src)
    self.assertEqual(o["status"],"imported")
    self.assertTrue(m.catalog()["u2netp"]["installed"])
    with self.assertRaises(ValueError):m.import_local("u2netp",src)
 def test_bad_hash(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/"file.onnx";p.write_bytes(b"x"*1024)
   with self.assertRaises(ValueError):m.import_local("u2netp",p,expected_sha256="0"*64)
if __name__=="__main__":unittest.main()
