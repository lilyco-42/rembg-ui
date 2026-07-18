import base64
import io
import os
import sys
import threading
from typing import Any  # 明确类型声明，让编辑器和静态检查彻底闭嘴

# 💡 强力注入国内 Hugging Face 镜像站，彻底解决大陆网络无法下载新模型的问题
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

# 原有的强阻断显卡环境配置
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
os.environ["ORT_LOGGING_LEVEL"] = "3"
# 💡 强力阻断 ONNX 检索显卡组件，杜绝 missing cublasLt64 报错，大幅缩减 Nuitka 打包体积
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
os.environ["ORT_LOGGING_LEVEL"] = "3"

import numpy as np
import uvicorn
import webview
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from PIL import Image
from pydantic import BaseModel
from rembg import new_session, remove

app = FastAPI()


@app.on_event("startup")
async def on_startup():
    server_ready.set()


# 允许跨域（本地回环地址互通，确保 Webview 内部请求顺畅）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_sessions = {}
session_lock = threading.Lock()
window_instance: Any = None
uvicorn_server = None
server_ready = threading.Event()


def get_model_session(model_name: str):
    """确保单例、平滑地载入并缓存 rembg 模型"""
    with session_lock:
        if model_name not in model_sessions:
            print(f"[Rembg] 正在初始化/载入模型: {model_name}...")
            try:
                # 强指定使用 CPU 运行，契合轻量化桌面端定位
                model_sessions[model_name] = new_session(
                    model_name, providers=["CPUExecutionProvider"]
                )
            except Exception:
                model_sessions[model_name] = new_session(model_name)
        return model_sessions[model_name]


class SaveImageRequest(BaseModel):
    base64_data: str
    filename: str


@app.post("/api/remove-bg")
async def remove_bg(file: UploadFile = File(...), model_name: str = Form("u2net")):
    try:
        input_data = await file.read()
        session = get_model_session(model_name)
        print(f"[Rembg] 正在使用模型 [{model_name}] 处理图片...")

        # 执行智能分层抠图
        output_data = remove(input_data, session=session)

        # 统一输出格式为二进制 bytes
        if isinstance(output_data, Image.Image):
            img_byte_arr = io.BytesIO()
            output_data.save(img_byte_arr, format="PNG")
            final_bytes = img_byte_arr.getvalue()
        elif isinstance(output_data, np.ndarray):
            img = Image.fromarray(output_data)
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format="PNG")
            final_bytes = img_byte_arr.getvalue()
        else:
            final_bytes = output_data

        base64_encoded = base64.b64encode(final_bytes).decode("utf-8")
        return {
            "success": True,
            "image": f"data:image/png;base64,{base64_encoded}",
        }
    except Exception as e:
        print(f"[Error] 处理失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/save-image")
async def save_image(req: SaveImageRequest):
    global window_instance
    if not window_instance:
        raise HTTPException(status_code=500, detail="桌面窗口句柄未初始化")

    try:
        # 唤起本地操作系统的原生“另存为”文件选择框
        dialog_result = window_instance.create_file_dialog(
            webview.FileDialog.SAVE,
            directory=os.path.expanduser("~/Desktop"),
            save_filename=req.filename,
            file_types=("PNG Image (*.png)", "All files (*.*)"),
        )

        # 健壮的解包逻辑：兼容新老版本 pywebview 返回的多种数据类型 (str, tuple, list)
        save_path = None
        if isinstance(dialog_result, (tuple, list)):
            if len(dialog_result) > 0 and dialog_result[0]:
                save_path = dialog_result[0]
        elif isinstance(dialog_result, str):
            save_path = dialog_result

        # 如果用户点击了取消
        if not save_path:
            return {"success": False, "msg": "用户取消了保存"}

        # 解码前端发来的 base64 数据并写入本地磁盘
        header, base64_str = (
            req.base64_data.split(", ")
            if ", " in req.base64_data
            else req.base64_data.split(",")
        )
        file_bytes = base64.b64decode(base64_str)

        with open(save_path, "wb") as f:
            f.write(file_bytes)

        print(f"[IO] 抠图结果成功保存到: {save_path}")
        return {"success": True, "path": save_path}
    except Exception as e:
        print(f"[Error] 保存文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/", response_class=HTMLResponse)
async def read_index():
    if hasattr(sys, "_MEIPASS"):
        base_path = sys._MEIPASS
    elif getattr(sys, "frozen", False):
        base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))

    html_path = os.path.join(base_path, "frontend/index.html")

    try:
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="前端资源文件丢失，请检查 frontend/index.html 是否打包在内",
        )


def run_server():
    """在子线程中安全运行 Uvicorn"""
    global uvicorn_server
    config = uvicorn.Config(app, host="127.0.0.1", port=8000, log_level="warning")
    uvicorn_server = uvicorn.Server(config)
    uvicorn_server.run()


def on_window_closed():
    """窗口关闭时触发，干净利落地扬了后端"""
    print("[UI] 窗口已关闭，正在强制退出后端服务...")
    global uvicorn_server
    if uvicorn_server:
        uvicorn_server.should_exit = True
    # 强制杀死自身进程，防止任何可能的事件循环死锁残留
    os._exit(0)


if __name__ == "__main__":
    # 1. 创建窗口实例
    active_window = webview.create_window(
        title="AI 智能分层抠图工具 (完全体)",
        url="http://127.0.0.1:8000",
        width=1100,
        height=800,
        resizable=True,
    )

    # 2. 显式空值防线，让静态检查器确信 active_window 绝对存在且不是 None
    if active_window is not None:
        active_window.events.closed += on_window_closed

    # 3. 赋值给全局变量供保存接口调用
    window_instance = active_window

    # 4. 后端丢给子线程启动
    server_thread = threading.Thread(target=run_server)
    server_thread.daemon = True
    server_thread.start()

    server_ready.wait(timeout=10)

    # 5. GUI 占领主线程启动
    print("[UI] 正在启动桌面窗口...")
    webview.start()
