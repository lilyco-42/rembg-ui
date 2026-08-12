"""赞助与教程模块 — FastAPI Router"""
import os
import sys
import webbrowser

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


@router.post("/open-external")
async def open_external(url: str = Form(...)):
    """用系统默认浏览器打开外部链接"""
    try:
        webbrowser.open(url)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/open-url")
async def open_url(req: OpenUrlRequest):
    """用系统默认浏览器打开外部链接（JSON body）"""
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
