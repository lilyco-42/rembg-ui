"""Offline prepaid credit ledger. Signed grants are issued by a trusted service.

Local SQLite cannot prevent rollback/copy attacks by an adversarial machine
owner. Never equate this with authoritative hosted wallet accounting.
"""
import base64
import hashlib
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

class PointsError(ValueError): pass

def _b64(value):
    return base64.urlsafe_b64decode(value + "="*(-len(value)%4))

def verify_grant(token, public_key, device_hash, now):
    try:
        version,payload,signature=token.split(".")
        if version!="pc1":raise PointsError("积分包版本不支持")
        raw=_b64(payload)
        Ed25519PublicKey.from_public_bytes(_b64(public_key)).verify(_b64(signature),b"pc1."+payload.encode())
        doc=json.loads(raw)
        if set(doc)!={"grant_id","device_hash","credits","issued_at","expires_at"}:
            raise PointsError("积分包字段无效")
        if not isinstance(doc["grant_id"],str) or not (1<=len(doc["grant_id"])<=100):
            raise PointsError("积分包编号无效")
        if doc["device_hash"]!=device_hash or not isinstance(device_hash,str) or len(device_hash)!=64:
            raise PointsError("设备不匹配")
        if type(doc["credits"]) is not int or not 1<=doc["credits"]<=100000:
            raise PointsError("积分数量无效")
        if any(type(doc[k]) is not int for k in ("issued_at","expires_at")) or not doc["issued_at"]<=now<doc["expires_at"]:
            raise PointsError("积分包未生效或过期")
        return doc
    except PointsError:raise
    except Exception as exc:
        raise PointsError("积分包验签或格式无效") from exc

@contextmanager
def _db(path):
    path=Path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(path,timeout=10,isolation_level=None)
    db.execute("PRAGMA busy_timeout=10000")
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript("""
    CREATE TABLE IF NOT EXISTS point_grants(
        grant_id TEXT PRIMARY KEY, device_hash TEXT NOT NULL, credits INTEGER NOT NULL CHECK(credits>0));
    CREATE TABLE IF NOT EXISTS point_jobs(
        job_id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('reserved','completed','refunded')));
    """)
    try:
        yield db
        if db.in_transaction:
            db.commit()
    except Exception:
        if db.in_transaction:
            db.rollback()
        raise
    finally:
        db.close()

def activate(path,token,public_key,device_hash,now):
    grant=verify_grant(token,public_key,device_hash,now)
    with _db(path) as db:
        db.execute("BEGIN IMMEDIATE")
        prior=db.execute("SELECT credits,device_hash FROM point_grants WHERE grant_id=?",(grant["grant_id"],)).fetchone()
        if prior and prior!=(grant["credits"],grant["device_hash"]):
            raise PointsError("积分包重复编号内容不一致")
        db.execute("INSERT OR IGNORE INTO point_grants VALUES(?,?,?)",(grant["grant_id"],device_hash,grant["credits"]))
    return balance(path)

def balance(path):
    with _db(path) as db:
        credits=db.execute("SELECT COALESCE(SUM(credits),0) FROM point_grants").fetchone()[0]
        completed=db.execute("SELECT COUNT(*) FROM point_jobs WHERE status='completed'").fetchone()[0]
        reserved=db.execute("SELECT COUNT(*) FROM point_jobs WHERE status='reserved'").fetchone()[0]
        return {"balance":max(credits-completed-reserved,0),"credits":credits,"completed":completed,"reserved":reserved}

def transition(path,job_id,action):
    if not isinstance(job_id,str) or not (1<=len(job_id)<=128):
        raise PointsError("任务编号无效")
    with _db(path) as db:
        db.execute("BEGIN IMMEDIATE")
        row=db.execute("SELECT status FROM point_jobs WHERE job_id=?",(job_id,)).fetchone()
        status=row[0] if row else None
        if action=="reserve":
            if status:
                if status=="refunded":raise PointsError("已退款任务不可重用")
                return status
            credits=db.execute("SELECT COALESCE(SUM(credits),0) FROM point_grants").fetchone()[0]
            used=db.execute("SELECT COUNT(*) FROM point_jobs WHERE status IN ('reserved','completed')").fetchone()[0]
            if used>=credits:raise PointsError("积分不足")
            db.execute("INSERT INTO point_jobs VALUES(?, 'reserved')",(job_id,))
            return "reserved"
        if action not in ("complete","refund"):raise PointsError("未知状态操作")
        if not status:raise PointsError("任务未预留积分")
        target="completed" if action=="complete" else "refunded"
        if status==target:return status
        if status!="reserved":raise PointsError("任务已结算，不能反向修改")
        db.execute("UPDATE point_jobs SET status=? WHERE job_id=?",(target,job_id))
        return target
