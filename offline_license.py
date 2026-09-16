"""Ed25519 signed licenses for weak-network and offline desktop activation.

The verifier only needs a public key.  The private key is intentionally kept
in the operator-side issuer and is never read by the desktop UI or the Pages
build.  The signed claims carry plan identity and time bounds; plan quotas are
still resolved by :mod:`commerce` so a license file cannot invent permissions.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
from datetime import datetime, timezone
from typing import Any, Mapping

from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey


TOKEN_VERSION = "ol1"
FORMAT_VERSION = "rembg-offline-v1"
SCHEMA_VERSION = 1
PUBLIC_KEY_BYTES = 32
PRIVATE_KEY_BYTES = 32
SIGNATURE_BYTES = 64
_KEY_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
_DEVICE_HASH_PATTERN = re.compile(r"^[0-9a-f]{64}$")


class OfflineLicenseError(ValueError):
    """Raised when an offline license is malformed, untrusted or unusable."""


def _urlsafe(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unurlsafe(value: str, *, field: str) -> bytes:
    if not isinstance(value, str) or not value or any(
        character not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_" for character in value
    ):
        raise OfflineLicenseError(f"{field} 编码无效")
    try:
        return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (ValueError, base64.binascii.Error) as error:
        raise OfflineLicenseError(f"{field} 编码无效") from error


def _canonical(value: Mapping[str, Any]) -> bytes:
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    except (TypeError, ValueError) as error:
        raise OfflineLicenseError("离线授权内容无法编码") from error


def _timestamp(value: Any, field: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise OfflineLicenseError(f"离线授权 {field} 无效")
    return value


def _key_id(value: Any) -> str:
    if not isinstance(value, str) or not _KEY_ID_PATTERN.fullmatch(value):
        raise OfflineLicenseError("离线授权 key_id 无效")
    return value


def _raw_key(value: bytes | str, *, field: str, length: int) -> bytes:
    if isinstance(value, str):
        value = _unurlsafe(value, field=field)
    if not isinstance(value, bytes) or len(value) != length:
        raise OfflineLicenseError(f"{field} 长度无效")
    return value


def _private_key(value: bytes | str) -> Ed25519PrivateKey:
    raw = _raw_key(value, field="私钥", length=PRIVATE_KEY_BYTES)
    try:
        return Ed25519PrivateKey.from_private_bytes(raw)
    except (TypeError, ValueError) as error:
        raise OfflineLicenseError("私钥无效") from error


def _public_key(value: bytes | str) -> Ed25519PublicKey:
    raw = _raw_key(value, field="公钥", length=PUBLIC_KEY_BYTES)
    try:
        return Ed25519PublicKey.from_public_bytes(raw)
    except (TypeError, ValueError) as error:
        raise OfflineLicenseError("公钥无效") from error


def encode_private_key(key: Ed25519PrivateKey) -> str:
    """Encode a private key for a private operator-side key file or secret."""

    try:
        raw = key.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
    except (TypeError, ValueError) as error:
        raise OfflineLicenseError("私钥无效") from error
    return _urlsafe(raw)


def encode_public_key(key: Ed25519PublicKey) -> str:
    """Encode a public key for a build secret or a packaged verifier."""

    try:
        raw = key.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    except (TypeError, ValueError) as error:
        raise OfflineLicenseError("公钥无效") from error
    return _urlsafe(raw)


def generate_keypair() -> tuple[str, str]:
    """Generate ``(private_key_b64, public_key_b64)`` using raw Ed25519 keys."""

    private_key = Ed25519PrivateKey.generate()
    return encode_private_key(private_key), encode_public_key(private_key.public_key())


def hash_device_id(identifier: str) -> str:
    """Hash a local device identifier before it enters an issued license.

    The caller chooses the platform-specific identifier and should avoid
    sending the raw value to an issuer.  Only the lower-case SHA-256 digest is
    persisted in a license file or compared during activation.
    """

    if not isinstance(identifier, str) or not identifier.strip():
        raise OfflineLicenseError("设备标识不能为空")
    return hashlib.sha256(identifier.encode("utf-8")).hexdigest()


def _normalize_claims(claims: Mapping[str, Any], *, now: int | None = None) -> dict[str, Any]:
    if not isinstance(claims, Mapping) or claims.get("schema_version") != SCHEMA_VERSION:
        raise OfflineLicenseError("离线授权版本不支持")
    license_id = claims.get("license_id")
    subject = claims.get("subject")
    plan_id = claims.get("plan_id")
    if not isinstance(license_id, str) or not license_id.strip() or len(license_id) > 128:
        raise OfflineLicenseError("离线授权编号无效")
    if not isinstance(subject, str) or not subject.strip() or len(subject) > 320:
        raise OfflineLicenseError("离线授权主体无效")
    if not isinstance(plan_id, str) or not plan_id.strip() or len(plan_id) > 64:
        raise OfflineLicenseError("离线授权套餐无效")
    issued_at = _timestamp(claims.get("issued_at"), "签发时间")
    expires_at = _timestamp(claims.get("expires_at"), "到期时间")
    if expires_at <= issued_at:
        raise OfflineLicenseError("离线授权有效期无效")
    device_hash = claims.get("device_hash")
    if device_hash is not None and (not isinstance(device_hash, str) or not _DEVICE_HASH_PATTERN.fullmatch(device_hash)):
        raise OfflineLicenseError("离线授权设备哈希无效")
    if now is not None and not issued_at <= now < expires_at:
        raise OfflineLicenseError("离线授权已过期或尚未生效")
    return {
        "schema_version": SCHEMA_VERSION,
        "license_id": license_id,
        "subject": subject,
        "plan_id": plan_id,
        "issued_at": issued_at,
        "expires_at": expires_at,
        "device_hash": device_hash,
    }


def issue_offline_license(
    claims: Mapping[str, Any], private_key: bytes | str, *, key_id: str = "default"
) -> str:
    """Sign a compact ``ol1`` token with an operator-only Ed25519 private key."""

    normalized = _normalize_claims(claims)
    key_id = _key_id(key_id)
    payload = {"format": FORMAT_VERSION, "key_id": key_id, "claims": normalized}
    encoded_payload = _urlsafe(_canonical(payload))
    signing_input = f"{TOKEN_VERSION}.{encoded_payload}".encode("ascii")
    signature = _urlsafe(_private_key(private_key).sign(signing_input))
    return f"{TOKEN_VERSION}.{encoded_payload}.{signature}"


def verify_offline_license(
    token: str,
    public_key: bytes | str,
    *,
    expected_key_id: str | None = None,
    device_hash: str | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    """Verify an offline token with only a public key and optional device hash."""

    if not isinstance(token, str) or len(token) > 65536:
        raise OfflineLicenseError("离线授权格式无效")
    parts = token.split(".")
    if len(parts) != 3 or parts[0] != TOKEN_VERSION:
        raise OfflineLicenseError("离线授权格式无效")
    payload_part, signature_part = parts[1], parts[2]
    payload_bytes = _unurlsafe(payload_part, field="离线授权内容")
    signature = _unurlsafe(signature_part, field="离线授权签名")
    if len(signature) != SIGNATURE_BYTES:
        raise OfflineLicenseError("离线授权签名长度无效")
    try:
        payload = json.loads(payload_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise OfflineLicenseError("离线授权内容无效") from error
    if not isinstance(payload, dict) or payload.get("format") != FORMAT_VERSION:
        raise OfflineLicenseError("离线授权格式不支持")
    key_id = _key_id(payload.get("key_id"))
    if expected_key_id is not None and key_id != _key_id(expected_key_id):
        raise OfflineLicenseError("离线授权密钥编号不匹配")
    try:
        verifier = _public_key(public_key)
    except OfflineLicenseError:
        raise
    try:
        verifier.verify(signature, f"{TOKEN_VERSION}.{payload_part}".encode("ascii"))
    except InvalidSignature as error:
        raise OfflineLicenseError("离线授权签名无效") from error
    claims = _normalize_claims(payload.get("claims"), now=now if now is not None else int(datetime.now(timezone.utc).timestamp()))
    claim_device_hash = claims.get("device_hash")
    if claim_device_hash is not None:
        if device_hash is None or not _DEVICE_HASH_PATTERN.fullmatch(device_hash):
            raise OfflineLicenseError("离线授权需要匹配的设备哈希")
        if not hmac.compare_digest(claim_device_hash, device_hash):
            raise OfflineLicenseError("离线授权不适用于此设备")
    claims["key_id"] = key_id
    return claims
