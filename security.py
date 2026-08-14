"""Security hardening for the Rembg Studio API.

Rembg Studio runs a local FastAPI service that processes images and can open
the system browser / file manager. Like any loopback tool it is exposed to
DNS-rebinding and CSRF attacks from malicious websites, so it is protected by:

1. **Trusted ``Host`` validation** — every request must carry a ``Host``
   header naming a loopback address or a private/LAN address. DNS rebinding
   keeps the attacker's public hostname in the ``Host`` header and is rejected
   before any handler runs. LAN access (``REMBG_HOST=0.0.0.0`` / ``--lan``)
   keeps working because private addresses are still allowed.
2. **Trusted ``Origin`` validation** — state-changing requests carrying an
   ``Origin`` header are rejected unless that origin is loopback or private.
3. **Per-launch token** — every state-changing ``/api/*`` request must present
   a cryptographically random token in the ``X-Rembg-Token`` header. The token
   is only embedded in the page served by this app, so a remote page can never
   learn it.
"""

from __future__ import annotations

import ipaddress
import secrets
from urllib.parse import urlsplit

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

TOKEN_HEADER = "X-Rembg-Token"

_STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

_LOOPBACK_NAMES = {"localhost", "127.0.0.1", "::1", "[::1]"}


def _strip_port(host: str) -> str:
    """Return the host portion of a possibly port-qualified host string."""
    host = host.strip().lower()
    if host.startswith("["):
        # IPv6 bracket notation: "[::1]:8042"
        return host[1:].split("]", 1)[0]
    if host.count(":") == 1:
        # "127.0.0.1:8042" / "192.168.1.5:8042"
        return host.rsplit(":", 1)[0]
    return host


def is_trusted_host(host: str | None) -> bool:
    """Return True if ``host`` is loopback or a private/LAN address."""
    if not host:
        return False
    name = _strip_port(host)
    if name in _LOOPBACK_NAMES:
        return True
    try:
        ip = ipaddress.ip_address(name)
    except ValueError:
        return False
    return ip.is_loopback or ip.is_private or ip.is_link_local


def is_trusted_origin(origin: str | None) -> bool:
    """Return True if the ``Origin`` header's host is loopback or private."""
    if not origin:
        return False
    try:
        host = urlsplit(origin).hostname
    except ValueError:
        return False
    return host is not None and is_trusted_host(host)


def generate_token() -> str:
    """Return a cryptographically random URL-safe token."""
    return secrets.token_urlsafe(32)


class AppSecurity:
    """Holds the per-launch token and compares candidate tokens safely."""

    def __init__(self) -> None:
        self.token = generate_token()

    def check(self, token: str | None) -> bool:
        if not token:
            return False
        return secrets.compare_digest(token, self.token)


security = AppSecurity()


class SecurityMiddleware(BaseHTTPMiddleware):
    """Enforce trusted Host/Origin and the per-launch token."""

    def __init__(self, app, security_obj: AppSecurity) -> None:
        super().__init__(app)
        self._security = security_obj

    async def dispatch(self, request: Request, call_next):
        host = request.headers.get("host")
        if not is_trusted_host(host):
            return JSONResponse({"detail": "Forbidden"}, status_code=403)

        path = request.url.path
        if request.method in _STATE_CHANGING_METHODS and path.startswith("/api/"):
            origin = request.headers.get("origin")
            if origin and not is_trusted_origin(origin):
                return JSONResponse({"detail": "Forbidden"}, status_code=403)

            if not self._security.check(request.headers.get(TOKEN_HEADER)):
                return JSONResponse({"detail": "Unauthorized"}, status_code=401)

        return await call_next(request)
