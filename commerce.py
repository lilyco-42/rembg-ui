"""Provider-neutral commercial plans and signed entitlements.

This module deliberately does not pretend that a browser flag is a payment
wall. A payment adapter can issue a signed entitlement after it has verified an
order; the production service keeps the signing secret private. The local
desktop app and the GitHub Pages demo remain trial products until a merchant
account and a hosted verification service are configured.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping


SCHEMA_VERSION = 1
TOKEN_VERSION = "v1"


class LicenseError(ValueError):
    """Raised when an entitlement cannot be trusted or is not usable."""


@dataclass(frozen=True)
class Plan:
    id: str
    label: str
    price_label: str
    billing: str
    max_batch_images: int
    monthly_images: int | None
    features: tuple[str, ...]


# These are explicitly pricing hypotheses, not a promise or a checkout page.
# The first paid experiment is intentionally narrow: a solo seller who needs
# repeatable SKU exports and local processing, followed by a small studio plan.
PLANS: dict[str, Plan] = {
    "trial": Plan(
        id="trial", label="公开试用", price_label="免费", billing="trial",
        max_batch_images=10, monthly_images=30,
        features=("browser-wasm", "original-comparison", "zip-delivery"),
    ),
    "creator": Plan(
        id="creator", label="创作者版", price_label="建议测试价 ¥29/月", billing="monthly",
        max_batch_images=50, monthly_images=500,
        features=("desktop-models", "batch-delivery", "manual-repair"),
    ),
    "studio": Plan(
        id="studio", label="小团队版", price_label="建议测试价 ¥99/月", billing="monthly",
        max_batch_images=200, monthly_images=3000,
        features=("desktop-models", "batch-delivery", "manual-repair", "priority-support"),
    ),
}


def public_plan_catalog() -> list[dict[str, Any]]:
    """Return safe, immutable-to-callers plan metadata for a pricing surface."""

    return [
        {
            "id": plan.id,
            "label": plan.label,
            "price_label": plan.price_label,
            "billing": plan.billing,
            "max_batch_images": plan.max_batch_images,
            "monthly_images": plan.monthly_images,
            "features": list(plan.features),
            "pricing_status": "experiment",
        }
        for plan in PLANS.values()
    ]


def _urlsafe(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unurlsafe(value: str) -> bytes:
    if not value or any(char not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_" for char in value):
        raise LicenseError("许可证编码无效")
    try:
        return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (ValueError, base64.binascii.Error) as error:
        raise LicenseError("许可证编码无效") from error


def _secret_bytes(secret: str | bytes) -> bytes:
    if isinstance(secret, str):
        secret = secret.encode("utf-8")
    if not isinstance(secret, bytes) or len(secret) < 16:
        raise LicenseError("许可证签名密钥至少需要 16 字节")
    return secret


def _canonical(payload: Mapping[str, Any]) -> bytes:
    try:
        return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    except (TypeError, ValueError) as error:
        raise LicenseError("许可证内容无法编码") from error


def _timestamp(value: Any, field: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise LicenseError(f"许可证 {field} 无效")
    return value


def _normalize_claims(claims: Mapping[str, Any], *, now: int | None = None) -> dict[str, Any]:
    if not isinstance(claims, Mapping) or claims.get("schema_version") != SCHEMA_VERSION:
        raise LicenseError("许可证版本不支持")
    license_id = claims.get("license_id")
    subject = claims.get("subject")
    plan_id = claims.get("plan_id")
    if not isinstance(license_id, str) or not license_id.strip() or len(license_id) > 128:
        raise LicenseError("许可证编号无效")
    if not isinstance(subject, str) or not subject.strip() or len(subject) > 320:
        raise LicenseError("许可证主体无效")
    if plan_id not in PLANS:
        raise LicenseError("许可证套餐不存在")
    issued_at = _timestamp(claims.get("issued_at"), "签发时间")
    expires_at = _timestamp(claims.get("expires_at"), "到期时间")
    if expires_at <= issued_at:
        raise LicenseError("许可证有效期无效")
    if now is not None and not issued_at <= now < expires_at:
        raise LicenseError("许可证已过期或尚未生效")
    # Claims never override server-side plan limits. Keeping only the stable
    # fields also prevents a signed token from smuggling arbitrary permissions.
    return {
        "schema_version": SCHEMA_VERSION,
        "license_id": license_id,
        "subject": subject,
        "plan_id": plan_id,
        "issued_at": issued_at,
        "expires_at": expires_at,
    }


def issue_license(claims: Mapping[str, Any], secret: str | bytes) -> str:
    """Issue a compact HMAC entitlement token for a trusted billing service."""

    key = _secret_bytes(secret)
    normalized = _normalize_claims(claims)
    payload = _urlsafe(_canonical(normalized))
    signing_input = f"{TOKEN_VERSION}.{payload}".encode("ascii")
    signature = _urlsafe(hmac.new(key, signing_input, hashlib.sha256).digest())
    return f"{TOKEN_VERSION}.{payload}.{signature}"


def verify_license(token: str, secret: str | bytes, *, now: int | None = None) -> dict[str, Any]:
    """Verify signature, schema and time bounds using constant-time comparison."""

    if not isinstance(token, str):
        raise LicenseError("许可证缺失")
    parts = token.split(".")
    if len(parts) != 3 or parts[0] != TOKEN_VERSION:
        raise LicenseError("许可证格式无效")
    key = _secret_bytes(secret)
    payload_part, signature_part = parts[1], parts[2]
    expected = _urlsafe(hmac.new(key, f"{TOKEN_VERSION}.{payload_part}".encode("ascii"), hashlib.sha256).digest())
    if not hmac.compare_digest(expected, signature_part):
        raise LicenseError("许可证签名无效")
    try:
        payload = json.loads(_unurlsafe(payload_part).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise LicenseError("许可证内容无效") from error
    return _normalize_claims(payload, now=now if now is not None else int(datetime.now(timezone.utc).timestamp()))


def trial_entitlement(*, now: int | None = None) -> dict[str, Any]:
    """Return the explicitly limited public-demo entitlement."""

    timestamp = now if now is not None else int(datetime.now(timezone.utc).timestamp())
    plan = PLANS["trial"]
    return {
        "status": "trial",
        "plan_id": plan.id,
        "label": plan.label,
        "expires_at": None,
        "max_batch_images": plan.max_batch_images,
        "monthly_images": plan.monthly_images,
        "features": list(plan.features),
        "checked_at": timestamp,
    }


def entitlement_view(claims: Mapping[str, Any], *, now: int | None = None) -> dict[str, Any]:
    """Convert verified claims into a response safe for a UI."""

    current = now if now is not None else int(datetime.now(timezone.utc).timestamp())
    normalized = _normalize_claims(claims, now=current)
    plan = PLANS[normalized["plan_id"]]
    return {
        "status": "licensed",
        "license_id": normalized["license_id"],
        "plan_id": plan.id,
        "label": plan.label,
        "expires_at": normalized["expires_at"],
        "max_batch_images": plan.max_batch_images,
        "monthly_images": plan.monthly_images,
        "features": list(plan.features),
        "checked_at": current,
    }


def resolve_entitlement(token: str | None, secret: str | None, *, now: int | None = None) -> dict[str, Any]:
    """Resolve a licensed plan or fall back to the bounded public trial.

    A configured secret without a token is intentionally still trial. A token
    without a configured secret is rejected rather than treated as paid.
    """

    if token is None or not token.strip():
        return trial_entitlement(now=now)
    if not secret:
        raise LicenseError("授权服务尚未配置签名密钥")
    claims = verify_license(token, secret, now=now)
    return entitlement_view(claims, now=now)


def can_process(entitlement: Mapping[str, Any], *, used_this_period: int, requested: int) -> bool:
    """Pure quota check used by a future hosted worker or desktop policy."""

    if not isinstance(used_this_period, int) or not isinstance(requested, int) or used_this_period < 0 or requested < 0:
        raise ValueError("用量必须是非负整数")
    limit = entitlement.get("monthly_images")
    batch_limit = entitlement.get("max_batch_images")
    return isinstance(limit, int) and isinstance(batch_limit, int) and requested <= batch_limit and used_this_period + requested <= limit
