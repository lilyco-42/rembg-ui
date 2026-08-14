"""赞助与教程模块 — FastAPI Router"""
import os
import re
import sys
import webbrowser
from urllib.parse import urlparse

from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/sponsor", tags=["sponsor"])

# 赞助配置（由各项目在注册 router 时设置）
_config = None


def set_config(config):
    global _config
    _config = config


def get_config():
    return _config


class OpenUrlRequest(BaseModel):
    url: str


def _is_safe_url(url: str) -> bool:
    """只允许 http/https 链接，拒绝 file://、javascript: 等危险协议。"""
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


@router.post("/open-external")
async def open_external(url: str = Form(...)):
    """用系统默认浏览器打开外部链接"""
    if not _is_safe_url(url):
        raise HTTPException(status_code=400, detail="仅允许 http/https 链接")
    try:
        webbrowser.open(url)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/open-url")
async def open_url(req: OpenUrlRequest):
    """用系统默认浏览器打开外部链接（JSON body）"""
    if not _is_safe_url(req.url):
        raise HTTPException(status_code=400, detail="仅允许 http/https 链接")
    try:
        webbrowser.open(req.url)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config")
async def sponsor_config():
    """返回赞助配置供前端动态渲染"""
    if not _config:
        return {"methods": [], "tutorials": [], "project_name": "", "project_version": ""}
    from dataclasses import asdict
    return asdict(_config)


@router.get("/assets/{filename}")
async def serve_asset(filename: str):
    """提供 sponsor assets 目录中的静态文件"""
    # 只允许文件名本身，防止路径穿越读取任意文件
    filename = os.path.basename(filename)
    if not filename:
        raise HTTPException(status_code=404, detail="Asset not found")
    if getattr(sys, "frozen", False):
        # Nuitka 打包后
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 尝试多个路径
    for sub_path in ["sponsor/assets", "assets"]:
        filepath = os.path.join(base_dir, sub_path, filename)
        if os.path.isfile(filepath):
            return FileResponse(filepath)
    
    raise HTTPException(status_code=404, detail="Asset not found")
