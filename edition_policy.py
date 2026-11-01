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
