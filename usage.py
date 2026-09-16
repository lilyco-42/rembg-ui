"""Durable local monthly inference usage accounting.

The desktop app processes images locally, so a small SQLite ledger is used to
enforce the plan's monthly image allowance without storing image data.  The
ledger is deliberately separate from the hosted points database: a local
license can continue to work when the network is unavailable, while every
successful request still consumes one auditable local quota unit.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


MAX_USAGE_REQUEST = 1_000_000
MAX_SUBJECT_LENGTH = 320
MAX_OPERATION_LENGTH = 120


class UsageError(ValueError):
    """Raised when the local usage ledger cannot accept a request."""


class UsageLimitError(UsageError):
    """Raised when a request would exceed the current plan allowance."""

    def __init__(self, snapshot: dict[str, Any]):
        self.snapshot = snapshot
        limit = snapshot.get("limit")
        used = snapshot.get("used", 0)
        super().__init__(f"本期额度不足（已使用 {used}/{limit} 张）")


USAGE_SCHEMA = """
CREATE TABLE IF NOT EXISTS usage_periods (
    subject TEXT NOT NULL,
    period TEXT NOT NULL,
    used INTEGER NOT NULL CHECK (used >= 0),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (subject, period)
);
CREATE TABLE IF NOT EXISTS usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    period TEXT NOT NULL,
    delta INTEGER NOT NULL,
    operation TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS usage_events_subject_period_idx
    ON usage_events(subject, period, id DESC);
"""


def ensure_schema(connection: sqlite3.Connection) -> None:
    """Create the usage tables and indexes in an existing connection."""

    connection.executescript(USAGE_SCHEMA)


def current_period(now: datetime | None = None) -> str:
    """Return the UTC calendar month used for quota accounting."""

    value = now or datetime.now(timezone.utc)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y-%m")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _validate_subject(subject: str) -> str:
    if not isinstance(subject, str) or not subject.strip() or len(subject) > MAX_SUBJECT_LENGTH:
        raise UsageError("用量主体无效")
    return subject.strip()


def _validate_period(period: str) -> str:
    if not isinstance(period, str) or len(period) != 7 or period[4] != "-":
        raise UsageError("用量周期无效")
    try:
        datetime.strptime(period, "%Y-%m")
    except ValueError as error:
        raise UsageError("用量周期无效") from error
    return period


def _validate_limit(limit: int | None) -> int | None:
    if limit is None:
        return None
    if isinstance(limit, bool) or not isinstance(limit, int) or limit < 0:
        raise UsageError("用量上限无效")
    return limit


def _validate_request(requested: int) -> int:
    if isinstance(requested, bool) or not isinstance(requested, int) or requested < 1 or requested > MAX_USAGE_REQUEST:
        raise UsageError(f"用量请求必须在 1 到 {MAX_USAGE_REQUEST} 之间")
    return requested


def _validate_operation(operation: str) -> str:
    if not isinstance(operation, str) or not operation.strip() or len(operation) > MAX_OPERATION_LENGTH:
        raise UsageError("用量操作无效")
    return operation.strip()


def _connect(db_path: str | Path) -> sqlite3.Connection:
    path = Path(db_path).expanduser()
    if str(path) != ":memory:":
        path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(path), timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout=10000")
    connection.execute("PRAGMA journal_mode=WAL")
    ensure_schema(connection)
    return connection


def _snapshot(
    subject: str,
    period: str,
    used: int,
    limit: int | None,
    updated_at: str | None,
) -> dict[str, Any]:
    return {
        "subject": subject,
        "period": period,
        "used": used,
        "limit": limit,
        "remaining": None if limit is None else max(0, limit - used),
        "updated_at": updated_at,
    }


def snapshot(
    db_path: str | Path,
    subject: str,
    *,
    limit: int | None,
    period: str | None = None,
) -> dict[str, Any]:
    """Read the current period without changing usage."""

    subject = _validate_subject(subject)
    limit = _validate_limit(limit)
    period = _validate_period(period or current_period())
    connection = _connect(db_path)
    try:
        row = connection.execute(
            "SELECT used,updated_at FROM usage_periods WHERE subject=? AND period=?",
            (subject, period),
        ).fetchone()
        return _snapshot(
            subject,
            period,
            int(row["used"]) if row else 0,
            limit,
            str(row["updated_at"]) if row else None,
        )
    finally:
        connection.close()


def reserve(
    db_path: str | Path,
    subject: str,
    requested: int,
    limit: int | None,
    operation: str,
    *,
    period: str | None = None,
    now: str | None = None,
) -> dict[str, Any]:
    """Atomically reserve quota units and return the new period snapshot."""

    subject = _validate_subject(subject)
    requested = _validate_request(requested)
    limit = _validate_limit(limit)
    operation = _validate_operation(operation)
    period = _validate_period(period or current_period())
    timestamp = now or _now()
    connection = _connect(db_path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute(
            "SELECT used,updated_at FROM usage_periods WHERE subject=? AND period=?",
            (subject, period),
        ).fetchone()
        used = int(row["used"]) if row else 0
        if limit is not None and used + requested > limit:
            connection.rollback()
            raise UsageLimitError(_snapshot(subject, period, used, limit, str(row["updated_at"]) if row else None))
        new_used = used + requested
        if row:
            connection.execute(
                "UPDATE usage_periods SET used=?,updated_at=? WHERE subject=? AND period=?",
                (new_used, timestamp, subject, period),
            )
        else:
            connection.execute(
                "INSERT INTO usage_periods(subject,period,used,updated_at) VALUES(?,?,?,?)",
                (subject, period, new_used, timestamp),
            )
        connection.execute(
            "INSERT INTO usage_events(subject,period,delta,operation,created_at) VALUES(?,?,?,?,?)",
            (subject, period, requested, operation, timestamp),
        )
        connection.commit()
        return _snapshot(subject, period, new_used, limit, timestamp)
    except Exception:
        if connection.in_transaction:
            connection.rollback()
        raise
    finally:
        connection.close()


def release(
    db_path: str | Path,
    subject: str,
    reserved: int,
    operation: str,
    *,
    period: str,
    now: str | None = None,
    limit: int | None = None,
) -> dict[str, Any]:
    """Return reserved units after an inference fails."""

    subject = _validate_subject(subject)
    reserved = _validate_request(reserved)
    operation = _validate_operation(operation)
    period = _validate_period(period)
    limit = _validate_limit(limit)
    timestamp = now or _now()
    connection = _connect(db_path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute(
            "SELECT used FROM usage_periods WHERE subject=? AND period=?",
            (subject, period),
        ).fetchone()
        used = int(row["used"]) if row else 0
        new_used = max(0, used - reserved)
        if row:
            connection.execute(
                "UPDATE usage_periods SET used=?,updated_at=? WHERE subject=? AND period=?",
                (new_used, timestamp, subject, period),
            )
        else:
            connection.execute(
                "INSERT INTO usage_periods(subject,period,used,updated_at) VALUES(?,?,?,?)",
                (subject, period, new_used, timestamp),
            )
        connection.execute(
            "INSERT INTO usage_events(subject,period,delta,operation,created_at) VALUES(?,?,?,?,?)",
            (subject, period, -reserved, operation, timestamp),
        )
        connection.commit()
        return _snapshot(subject, period, new_used, limit, timestamp)
    except Exception:
        if connection.in_transaction:
            connection.rollback()
        raise
    finally:
        connection.close()


# Explicit aliases make the intent clear at call sites and keep the module
# convenient for a future hosted adapter.
reserve_usage = reserve
release_usage = release
usage_snapshot = snapshot
