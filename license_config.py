"""Public verifier configuration for the production Rembg license issuer.

This file is safe to distribute with the desktop application.  It contains a
public Ed25519 key only; the matching private key stays on lain42.top in the
operator-only studio-billing service.  Rotate both the key id and this value
when replacing the issuer key, while keeping the old key available during the
transition window.
"""

OFFLINE_LICENSE_KEY_ID = "rembg-2026"
OFFLINE_LICENSE_PUBLIC_KEY = "ZxjlbtB-cmEwqMIVFjBiCR3C9YWKrRWGI6upwOLBjKI"
