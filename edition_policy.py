"""Server-owned edition flags. Client parameters never grant paid entitlements."""
import os

def current_edition():
    value = os.environ.get("REMBG_EDITION", "pro").strip().lower()
    if value not in ("community", "pro"):
        raise ValueError("REMBG_EDITION must be community or pro")
    return value

def allow_local_webgpu():
    # Local inference is free for Community; Pro has no metered browser path.
    return current_edition() == "community" and os.environ.get("REMBG_ENABLE_WEBGPU_EXPERIMENT") == "1"

def community_entitlement():
    """Explicit unlimited local entitlement, not a paid or signed license."""
    return {
        "status": "active",
        "plan_id": "community",
        "label": "Community (free local)",
        "monthly_images": None,
        "max_batch_images": 10,
    }

def require_trusted_cloud_billing():
    """Fail closed for hosted paid inference until a trusted server ledger exists.

    Local SQLite usage and browser-reported usage are not trusted cloud billing.
    This flag is intended for production deployments; it never creates privileges.
    """
    if current_edition() == "pro" and os.environ.get("REMBG_HOSTED_PAID_MODE") == "1":
        raise RuntimeError("Hosted Pro billing is not configured; paid inference is disabled")
