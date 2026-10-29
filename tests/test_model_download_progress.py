import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import model_catalog

class FakeReply:
    status=200
    headers={"Content-Length":"2048"}
    def __init__(self):self.sent=False
    def geturl(self):return "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx"
    def read(self,n):
        if self.sent:return b""
        self.sent=True
        return b"a"*2048
    def __enter__(self):return self
    def __exit__(self,*args):pass

class DownloadTest(unittest.TestCase):
    def test_real_byte_progress(self):
        with tempfile.TemporaryDirectory() as directory:
            updates=[]
            with patch.dict(os.environ,{"U2NET_HOME":directory}),patch("model_catalog.urllib.request.urlopen",return_value=FakeReply()):
                out=model_catalog.install("u2netp",progress=lambda received,total:updates.append((received,total)))
            self.assertEqual(out["status"],"installed")
            self.assertEqual(updates[-1],(2048,2048))
            self.assertEqual((Path(directory)/"u2netp.onnx").stat().st_size,2048)
if __name__=="__main__":unittest.main()
