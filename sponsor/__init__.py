"""Shared Sponsor & Tutorial Module - import and use in any FastAPI project"""
from .api import router as sponsor_router, set_config, get_config
from .config import SponsorConfig, SponsorMethod, TutorialLink, DEFAULT_CONFIG
from .ui import MODAL_CSS, SPONSOR_QR_CDN, build_modal_html, build_modal_js

__all__ = [
    "sponsor_router",
    "set_config",
    "get_config",
    "SponsorConfig",
    "SponsorMethod",
    "TutorialLink",
    "DEFAULT_CONFIG",
    "MODAL_CSS",
    "SPONSOR_QR_CDN",
    "build_modal_html",
    "build_modal_js",
]
