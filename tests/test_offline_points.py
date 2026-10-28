import base64
import json
import tempfile
import time
import unittest
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from offline_points import verify_grant, activate, transition, balance, PointsError

def b64(data):
    return base64.urlsafe_b64encode(data).decode().rstrip("=")

class PointLedgerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db=Path(self.tmp.name)/"wallet.db"
        self.key=Ed25519PrivateKey.generate()
        self.public=b64(self.key.public_key().public_bytes(Encoding.Raw,PublicFormat.Raw))
        self.device="a"*64
        self.now=int(time.time())
    def make(self, credits=2, grant_id="invoice-1",device=None):
        claim={"grant_id":grant_id,"device_hash":device or self.device,"credits":credits,"issued_at":self.now-2,"expires_at":self.now+3600}
        payload=b64(json.dumps(claim,sort_keys=True,separators=(",",":")).encode())
        sig=b64(self.key.sign(("pc1."+payload).encode()))
        return "pc1."+payload+"."+sig
    def test_charge_once_and_refund(self):
        v=self.make()
        self.assertEqual(activate(self.db,v,self.public,self.device,self.now)["balance"],2)
        self.assertEqual(activate(self.db,v,self.public,self.device,self.now)["balance"],2)
        self.assertEqual(transition(self.db,"job-1","reserve"),"reserved")
        self.assertEqual(transition(self.db,"job-1","complete"),"completed")
        self.assertEqual(transition(self.db,"job-1","complete"),"completed")
        self.assertEqual(balance(self.db)["balance"],1)
        self.assertEqual(transition(self.db,"job-2","reserve"),"reserved")
        self.assertEqual(transition(self.db,"job-2","refund"),"refunded")
        self.assertEqual(balance(self.db)["balance"],1)
        with self.assertRaises(PointsError):transition(self.db,"job-2","reserve")
    def test_no_negative_or_double_charge(self):
        activate(self.db,self.make(credits=1),self.public,self.device,self.now)
        transition(self.db,"job-1","reserve")
        with self.assertRaises(PointsError):transition(self.db,"job-2","reserve")
        transition(self.db,"job-1","refund")
        self.assertEqual(balance(self.db)["balance"],1)
    def test_wrong_key_device_tampered_expired(self):
        token=self.make()
        for bad in [token[:-2]+"aa",self.make(device="b"*64)]:
            with self.assertRaises(PointsError):verify_grant(bad,self.public,self.device,self.now)
        with self.assertRaises(PointsError):verify_grant(token,self.public,self.device,self.now+7200)
    def test_same_grant_id_conflict(self):
        activate(self.db,self.make(),self.public,self.device,self.now)
        with self.assertRaises(PointsError):activate(self.db,self.make(credits=4),self.public,self.device,self.now)
if __name__=="__main__":unittest.main()
