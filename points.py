"""Small, provider-neutral integer points ledger.

The billing service can use this module without coupling points to a payment
provider. Every mutation is recorded with its resulting balance and an
optional idempotency reference.
"""

from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from typing import Any, Mapping


MAX_POINTS_DELTA = 1_000_000
MAX_POINTS_BALANCE = 100_000_000
MAX_REASON_LENGTH = 200
MAX_REFERENCE_LENGTH = 120


class PointsError(ValueError):
    """Raised when a points request is invalid or cannot be applied."""


POINTS_SCHEMA = """
CREATE TABLE IF NOT EXISTS points_accounts (
    user_id INTEGER PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS points_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    delta INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference TEXT,
    created_at TEXT NOT NULL,
    meta TEXT NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX IF NOT EXISTS points_ledger_user_reference_idx
    ON points_ledger(user_id, reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS points_ledger_user_id_idx
    ON points_ledger(user_id, id DESC);
"""


def ensure_schema(connection: sqlite3.Connection) -> None:
    """Create the points tables and indexes in an existing billing database."""

    connection.executescript(POINTS_SCHEMA)


def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def parse_points(value: Any, *, maximum: int = MAX_POINTS_DELTA) -> int:
    """Parse a positive integer supplied by an API client."""

    if isinstance(value, bool):
        raise PointsError("积分必须是正整数")
    if isinstance(value, int):
        amount = value
    elif isinstance(value, str) and re.fullmatch(r"[0-9]+", value.strip()):
        amount = int(value.strip())
    else:
        raise PointsError("积分必须是正整数")
    if amount < 1 or amount > maximum:
        raise PointsError(f"积分必须在 1 到 {maximum} 之间")
    return amount


def normalize_reason(value: Any, *, default: str = "") -> str:
    reason = default if value is None else str(value).strip()
    if not reason:
        raise PointsError("积分变更原因不能为空")
    if len(reason) > MAX_REASON_LENGTH:
        raise PointsError(f"积分变更原因不能超过 {MAX_REASON_LENGTH} 个字符")
    return reason


def normalize_reference(value: Any) -> str | None:
    if value is None:
        return None
    reference = str(value).strip()
    if not reference:
        return None
    if len(reference) > MAX_REFERENCE_LENGTH:
        raise PointsError(f"积分引用号不能超过 {MAX_REFERENCE_LENGTH} 个字符")
    if not re.fullmatch(r"[A-Za-z0-9._:/-]+", reference):
        raise PointsError("积分引用号只能包含字母、数字、._:/-")
    return reference


def _entry(row: sqlite3.Row | Mapping[str, Any], *, idempotent: bool) -> dict[str, Any]:
    result = {
        "id": int(row["id"]),
        "user_id": int(row["user_id"]),
        "delta": int(row["delta"]),
        "balance_after": int(row["balance_after"]),
        "reason": str(row["reason"]),
        "reference": row["reference"],
        "created_at": str(row["created_at"]),
        "meta": json.loads(row["meta"] or "{}"),
        "idempotent": idempotent,
    }
    return result


def adjust_points(
    connection: sqlite3.Connection,
    user_id: int,
    delta: int,
    reason: str,
    reference: str | None = None,
    meta: Mapping[str, Any] | None = None,
    *,
    now: str | None = None,
    manage_transaction: bool = True,
) -> dict[str, Any]:
    """Apply one atomic ledger mutation and return its resulting entry.

    ``reference`` makes retries idempotent for a user. Reusing a reference
    with a different delta or reason fails closed instead of silently changing
    the original operation. Set ``manage_transaction=False`` when the caller
    already owns a surrounding SQLite transaction.
    """

    if isinstance(delta, bool) or not isinstance(delta, int) or delta == 0:
        raise PointsError("积分变更必须是非零整数")
    if abs(delta) > MAX_POINTS_DELTA:
        raise PointsError(f"积分变更绝对值不能超过 {MAX_POINTS_DELTA}")
    if isinstance(user_id, bool) or not isinstance(user_id, int) or user_id < 1:
        raise PointsError("用户编号无效")
    reason = normalize_reason(reason)
    reference = normalize_reference(reference)
    metadata = dict(meta or {})
    try:
        encoded_meta = json.dumps(metadata, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError) as error:
        raise PointsError("积分附加信息必须是 JSON 对象") from error
    timestamp = now or _now_utc()

    if manage_transaction:
        connection.execute("BEGIN IMMEDIATE")
    try:
        if reference is not None:
            existing = connection.execute(
                "SELECT id,user_id,delta,balance_after,reason,reference,created_at,meta"
                " FROM points_ledger WHERE user_id=? AND reference=?",
                (user_id, reference),
            ).fetchone()
            if existing:
                if int(existing["delta"]) != delta or str(existing["reason"]) != reason:
                    raise PointsError("积分引用号已用于另一笔变更")
                if manage_transaction:
                    connection.commit()
                return _entry(existing, idempotent=True)

        account = connection.execute(
            "SELECT balance FROM points_accounts WHERE user_id=?", (user_id,)
        ).fetchone()
        current = int(account["balance"]) if account else 0
        balance_after = current + delta
        if balance_after < 0:
            raise PointsError("积分余额不足")
        if balance_after > MAX_POINTS_BALANCE:
            raise PointsError(f"积分余额不能超过 {MAX_POINTS_BALANCE}")
        if account:
            connection.execute(
                "UPDATE points_accounts SET balance=?, updated_at=? WHERE user_id=?",
                (balance_after, timestamp, user_id),
            )
        else:
            connection.execute(
                "INSERT INTO points_accounts(user_id,balance,updated_at) VALUES(?,?,?)",
                (user_id, balance_after, timestamp),
            )
        cursor = connection.execute(
            "INSERT INTO points_ledger(user_id,delta,balance_after,reason,reference,created_at,meta)"
            " VALUES(?,?,?,?,?,?,?)",
            (user_id, delta, balance_after, reason, reference, timestamp, encoded_meta),
        )
        entry = {
            "id": int(cursor.lastrowid),
            "user_id": user_id,
            "delta": delta,
            "balance_after": balance_after,
            "reason": reason,
            "reference": reference,
            "created_at": timestamp,
            "meta": metadata,
            "idempotent": False,
        }
        if manage_transaction:
            connection.commit()
        return entry
    except Exception:
        if manage_transaction:
            connection.rollback()
        raise


def snapshot(
    connection: sqlite3.Connection,
    user_id: int,
    *,
    limit: int = 50,
) -> dict[str, Any]:
    """Return a balance and newest ledger entries for one user."""

    safe_limit = max(1, min(int(limit), 100))
    account = connection.execute(
        "SELECT balance,updated_at FROM points_accounts WHERE user_id=?", (user_id,)
    ).fetchone()
    rows = connection.execute(
        "SELECT id,user_id,delta,balance_after,reason,reference,created_at,meta"
        " FROM points_ledger WHERE user_id=? ORDER BY id DESC LIMIT ?",
        (user_id, safe_limit),
    ).fetchall()
    return {
        "balance": int(account["balance"]) if account else 0,
        "updated_at": account["updated_at"] if account else None,
        "entries": [_entry(row, idempotent=False) for row in rows],
    }


points_snapshot = snapshot
