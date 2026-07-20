"""赞助与教程模块 — FastAPI Router"""
import os
import sys
import webbrowser
from typing import Optional

from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

try:
    import webview as _webview
except ImportError:
    _webview = None

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


class SaveFileRequest(BaseModel):
    base64_data: str
    filename: str


@router.post("/open-external")
async def open_external(url: str = Form(...)):
    """用系统默认浏览器打开外部链接（安全地离开 WebView）"""
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


@router.post("/save-file")
async def save_file(req: SaveFileRequest):
    """保存文件到本地（二维码等）"""
    window = _get_window()
    if not window:
        raise HTTPException(status_code=500, detail="桌面窗口句柄未初始化")

    try:
        dialog_result = window.create_file_dialog(
            _webview.FileDialog.SAVE,
            directory=os.path.expanduser("~/Desktop"),
            save_filename=req.filename,
            file_types=("PNG Image (*.png)", "All files (*.*)"),
        )

        save_path = _parse_dialog(dialog_result)
        if not save_path:
            return {"success": False, "msg": "用户取消了保存"}

        header, base64_str = (
            req.base64_data.split(", ")
            if ", " in req.base64_data
            else req.base64_data.split(",")
        )
        import base64
        file_bytes = base64.b64decode(base64_str)

        with open(save_path, "wb") as f:
            f.write(file_bytes)

        return {"success": True, "path": save_path}
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
    assets_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
    filepath = os.path.join(assets_dir, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Asset not found")
    return FileResponse(filepath)


def _get_window():
    """获取当前 pywebview 窗口实例"""
    if _webview is None:
        return None
    try:
        windows = _webview.windows
        if windows:
            return windows[0]
    except Exception:
        pass
    return None


def _parse_dialog(result) -> Optional[str]:
    """解析 pywebview 文件对话框返回值"""
    if isinstance(result, (tuple, list)):
        if len(result) > 0 and result[0]:
            return result[0]
    elif isinstance(result, str):
        return result
    return None
