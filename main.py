import base64
import io
import os
import random
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from typing import Optional  # 明确类型声明，让编辑器和静态检查彻底闭嘴

from sponsor import sponsor_router, set_config, SponsorConfig, SponsorMethod, TutorialLink


def find_available_port(default: int = 8042) -> int:
    """检测默认端口是否可用，不可用则随机 8000-8999"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", default))
            return default
    except OSError:
        port = random.randint(8000, 8999)
        while port == default:
            port = random.randint(8000, 8999)
        print(f"[Port] 端口 {default} 被占用，随机使用 {port}")
        return port


def open_path(path: str):
    """跨平台用系统默认程序打开路径/URL（替代 Windows 专用的 os.startfile）"""
    # 规范化路径，避免混合分隔符（如 C:/Users/liuqi/.u2net）导致 ShellExecute 静默失败
    path = os.path.normpath(os.path.expanduser(path))
    try:
        if sys.platform == "win32":
            os.startfile(path)
        elif sys.platform == "darwin":
            subprocess.run(["open", path])
        else:
            subprocess.run(["xdg-open", path])
    except Exception as e:
        print(f"[Warn] 无法打开 {path}: {e}")

# 💡 强力注入国内 Hugging Face 镜像站，彻底解决大陆网络无法下载新模型的问题
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
os.environ["ORT_LOGGING_LEVEL"] = "3"
os.environ["ORT_CUDA_DEVICE_ID"] = "0"

import numpy as np
import uvicorn


def _detect_providers():
    """检测 CUDA 是否可用，不可用则回退 CPU"""
    try:
        from onnxruntime import get_available_providers
        if "CUDAExecutionProvider" not in get_available_providers():
            return ["CPUExecutionProvider"]
        # 尝试真正创建 CUDA session
        import onnxruntime as ort
        so = ort.SessionOptions()
        so.log_severity_level = 3
        so.add_session_config_entry("session.use_env_allocators", "1")
        ort.InferenceSession(b"", sess_options=so, providers=["CUDAExecutionProvider"])
        return ["CUDAExecutionProvider", "CPUExecutionProvider"]
    except Exception:
        return ["CPUExecutionProvider"]


PROVIDERS = _detect_providers()
print(f"[GPU] Provider: {PROVIDERS[0]}")
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from PIL import Image
from rembg import new_session, remove
from processors.sam_processor import MobileSAMProcessor

app = FastAPI()
app.include_router(sponsor_router)
set_config(SponsorConfig(
    methods=[
        SponsorMethod(name="微信支付", icon="💚", qr_image="wechatpay.png"),
        SponsorMethod(name="支付宝", icon="💙", qr_image="alipay.png"),
        SponsorMethod(name="爱发电", icon="🧡", url="https://ifdian.net/a/Goth_donghaitang"),
        SponsorMethod(name="B站", icon="📺", url="https://space.bilibili.com/603079076"),
    ],
    tutorials=[TutorialLink(title="B站主页", url="https://space.bilibili.com/603079076")],
    project_name="Rembg Studio",
    project_version="1.0.0",
    project_repo="https://github.com/lilyco-42/rembg-ui",
))
# `--lan` 快捷开关：等价于 REMBG_HOST=0.0.0.0，供手机/局域网设备访问
if "--lan" in sys.argv:
    os.environ.setdefault("REMBG_HOST", "0.0.0.0")


def get_lan_ips() -> list:
    """尽力收集本机局域网 IPv4 地址（UDP「连接」只选路、不发任何数据包）"""
    ips: set = set()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            ips.add(s.getsockname()[0])
    except OSError:
        pass
    try:
        for addr in socket.gethostbyname_ex(socket.gethostname())[2]:
            ips.add(addr)
    except OSError:
        pass

    def _usable(ip: str) -> bool:
        if ip.count(".") != 3 or ip.startswith(("127.", "169.254.", "0.", "255.")):
            return False
        first = int(ip.split(".")[0])
        return 1 <= first <= 223

    return sorted(ip for ip in ips if _usable(ip))


SERVER_PORT = find_available_port()
# 监听地址：默认仅本机回环；移动端/局域网场景可用 REMBG_HOST=0.0.0.0（或 --lan）放开
SERVER_HOST = os.environ.get("REMBG_HOST", "127.0.0.1")


@app.on_event("startup")
async def on_startup():
    server_ready.set()
    print(f"[Server] 本机访问: http://127.0.0.1:{SERVER_PORT}", flush=True)
    if SERVER_HOST in ("0.0.0.0", ""):
        lan_ips = get_lan_ips()
        if lan_ips:
            for ip in lan_ips:
                print(f"[Server] 手机/局域网访问: http://{ip}:{SERVER_PORT}  （同一 WiFi 扫码即可）", flush=True)
        else:
            print("[Server] 未检测到局域网 IP，无法从手机访问", flush=True)
    else:
        print("[Server] 仅本机可访问。如需手机/局域网访问：uv run python main.py --lan  或  REMBG_HOST=0.0.0.0 uv run python main.py", flush=True)


# 允许跨域：页面与 API 同源即可，放开来源以兼容局域网 IP / 内网穿透等任意访问来源。
# 注意：这是本地工具，无鉴权，放开后同一局域网内的设备都能调用接口。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_sessions = {}
session_lock = threading.Lock()
uvicorn_server = None
server_ready = threading.Event()

sam_processor: Optional[MobileSAMProcessor] = None
sam_temp_path: Optional[str] = None
sam_last_result: Optional[dict] = None


def get_model_session(model_name: str):
    """确保单例、平滑地载入并缓存 rembg 模型"""
    with session_lock:
        if model_name not in model_sessions:
            print(f"[Rembg] 正在初始化/载入模型: {model_name}...")
            try:
                model_sessions[model_name] = new_session(model_name, providers=PROVIDERS)
            except Exception:
                model_sessions[model_name] = new_session(model_name)
        return model_sessions[model_name]


@app.get("/api/network")
async def network_info():
    """返回本机访问地址，供前端生成「手机扫码连接」二维码"""
    lan_ips = get_lan_ips() if SERVER_HOST in ("0.0.0.0", "") else []
    return {
        "host": SERVER_HOST,
        "port": SERVER_PORT,
        "lan_ips": lan_ips,
        "lan_url": f"http://{lan_ips[0]}:{SERVER_PORT}" if lan_ips else None,
        "local_url": f"http://127.0.0.1:{SERVER_PORT}",
        "lan_enabled": bool(lan_ips),
    }


@app.get("/api/models")
async def list_models():
    """返回模型列表及本地安装状态"""
    model_dir = os.path.expanduser("~/.u2net")
    sessions = {
        "bria-rmbg": {"name": "商业级 (bria-rmbg)", "group": "推荐", "size": "~170MB"},
        "birefnet-general": {"name": "最强通用 (birefnet-general)", "group": "推荐", "size": "~970MB"},
        "birefnet-massive": {"name": "海量数据版 (birefnet-massive)", "group": "推荐", "size": "~970MB"},
        "birefnet-portrait": {"name": "人像专用 (birefnet-portrait)", "group": "人像", "size": "~970MB"},
        "u2net_human_seg": {"name": "人体发丝 (u2net_human_seg)", "group": "人像", "size": "~170MB"},
        "isnet-anime": {"name": "动漫插画 (isnet-anime)", "group": "动漫", "size": "~170MB"},
        "birefnet-general-lite": {"name": "BiRefNet 轻量", "group": "极速", "size": "~170MB"},
        "u2net": {"name": "通用均衡 (u2net)", "group": "极速", "size": "~170MB"},
        "u2netp": {"name": "极速版 (u2netp)", "group": "极速", "size": "~50MB"},
        "silueta": {"name": "最小体积 (silueta)", "group": "极速", "size": "~43MB"},
        "isnet-general-use": {"name": "高精度通用", "group": "其他", "size": "~170MB"},
        "u2net_cloth_seg": {"name": "服装解析", "group": "其他", "size": "~170MB"},
        "birefnet-dis": {"name": "二分图像", "group": "其他", "size": "~970MB"},
        "birefnet-hrsod": {"name": "高清显著", "group": "其他", "size": "~970MB"},
        "birefnet-cod": {"name": "伪装检测", "group": "其他", "size": "~970MB"},
        "sam": {"name": "SAM 通用分割", "group": "其他", "size": "~370MB"},
    }
    for key, info in sessions.items():
        fpath = os.path.join(model_dir, f"{key}.onnx")
        info["installed"] = os.path.exists(fpath)
        info["path"] = fpath
    return {"model_dir": model_dir, "models": sessions}


@app.post("/api/open-model-dir")
async def open_model_dir():
    """用系统文件管理器打开模型目录"""
    model_dir = os.path.expanduser("~/.u2net")
    os.makedirs(model_dir, exist_ok=True)
    open_path(model_dir)
    return {"success": True, "path": model_dir}


@app.post("/api/remove-bg")
async def remove_bg(
    file: UploadFile = File(...),
    model_name: str = Form("bria-rmbg"),
    alpha_matting: bool = Form(False),
    alpha_matting_fg: int = Form(240),
    alpha_matting_bg: int = Form(10),
    alpha_matting_erode: int = Form(10),
    post_process: bool = Form(False),
    only_mask: bool = Form(False),
):
    try:
        input_data = await file.read()
        session = get_model_session(model_name)
        print(f"[Rembg] 模型={model_name} alpha={alpha_matting} fg={alpha_matting_fg} bg={alpha_matting_bg} erode={alpha_matting_erode}")

        output_data = remove(
            input_data,
            session=session,
            alpha_matting=alpha_matting,
            alpha_matting_foreground_threshold=alpha_matting_fg,
            alpha_matting_background_threshold=alpha_matting_bg,
            alpha_matting_erode_size=alpha_matting_erode,
            post_process_mask=post_process,
            only_mask=only_mask,
        )

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


TEMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp")
os.makedirs(TEMP_DIR, exist_ok=True)


def _get_sam() -> MobileSAMProcessor:
    global sam_processor
    if sam_processor is None:
        print("[SAM] 初始化 SAM-B 模型...")
        sam_processor = MobileSAMProcessor()
    return sam_processor


@app.post("/api/sam/load-image")
async def sam_load_image(file: UploadFile = File(...)):
    global sam_temp_path
    try:
        content = await file.read()
        ext = os.path.splitext(file.filename or "image.png")[1] or ".png"
        sam_temp_path = os.path.join(TEMP_DIR, f"sam_input{ext}")
        with open(sam_temp_path, "wb") as f:
            f.write(content)

        proc = _get_sam()
        proc.load_image(sam_temp_path)
        w, h = proc._orig_size
        print(f"[SAM] 图片已加载: {w}x{h}")
        return {"success": True, "width": w, "height": h}
    except Exception as e:
        print(f"[SAM Error] 加载失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sam/segment")
async def sam_segment(points_json: str = Form(...)):
    global sam_temp_path, sam_last_result
    if not sam_temp_path or not os.path.exists(sam_temp_path):
        raise HTTPException(status_code=400, detail="请先加载图片")
    try:
        import json
        points_data = json.loads(points_json)
        pts = [(p["x"], p["y"]) for p in points_data]
        labels = [p["label"] for p in points_data]  # 1=前景, 0=背景

        proc = _get_sam()
        result = proc.segment_with_points(pts, labels)
        orig = Image.open(sam_temp_path)
        candidates = []
        for c in result.candidates:
            rgba = proc.apply_mask(orig, c.mask)
            buf = io.BytesIO()
            rgba.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            candidates.append({
                "label": c.label,
                "score": round(c.score, 3),
                "area_pct": round(c.area_pct, 1),
                "image": f"data:image/png;base64,{b64}",
            })
        sam_last_result = {
            "orig_size": proc._orig_size,
            "candidates": result.candidates,
        }
        return {"success": True, "candidates": candidates}
    except Exception as e:
        print(f"[SAM Error] 分割失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sam/segment-box")
async def sam_segment_box(x1: int = Form(...), y1: int = Form(...), x2: int = Form(...), y2: int = Form(...)):
    global sam_temp_path, sam_last_result
    if not sam_temp_path or not os.path.exists(sam_temp_path):
        raise HTTPException(status_code=400, detail="请先加载图片")
    try:
        proc = _get_sam()
        result = proc.segment_with_prompts(boxes=[(x1, y1, x2, y2)])
        orig = Image.open(sam_temp_path)
        candidates = []
        for c in result.candidates:
            rgba = proc.apply_mask(orig, c.mask)
            buf = io.BytesIO()
            rgba.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            candidates.append({
                "label": c.label,
                "score": round(c.score, 3),
                "area_pct": round(c.area_pct, 1),
                "image": f"data:image/png;base64,{b64}",
            })
        sam_last_result = {
            "orig_size": proc._orig_size,
            "candidates": result.candidates,
        }
        return {"success": True, "candidates": candidates}
    except Exception as e:
        print(f"[SAM Error] 框选分割失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sam/auto-segment")
async def sam_auto_segment():
    global sam_temp_path, sam_last_result
    if not sam_temp_path or not os.path.exists(sam_temp_path):
        raise HTTPException(status_code=400, detail="请先加载图片")
    try:
        proc = _get_sam()
        result = proc.auto_segment(sam_temp_path)
        orig = Image.open(sam_temp_path)
        candidates = []
        for c in result.candidates:
            rgba = proc.apply_mask(orig, c.mask)
            buf = io.BytesIO()
            rgba.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            candidates.append({
                "label": c.label,
                "score": c.score,
                "area_pct": c.area_pct,
                "image": f"data:image/png;base64,{b64}",
            })
        sam_last_result = {
            "orig_size": proc._orig_size,
            "candidates": result.candidates,
        }
        return {"success": True, "candidates": candidates}
    except Exception as e:
        print(f"[SAM Error] 自动分割失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/", response_class=HTMLResponse)
async def read_index():
    if hasattr(sys, "_MEIPASS"):
        base_path = sys._MEIPASS
    elif getattr(sys, "frozen", False):
        exe_dir = os.path.dirname(sys.executable)
        if os.path.exists(os.path.join(exe_dir, "frontend", "index.html")):
            base_path = exe_dir
        else:
            base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))

    html_path = os.path.join(base_path, "frontend", "index.html")

    try:
        with open(html_path, "r", encoding="utf-8") as f:
            content = f.read()
        # 禁止缓存：确保每次启动都加载最新的前端页面，避免 WebView2 展示旧版本
        return HTMLResponse(
            content=content,
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="前端资源文件丢失，请检查 frontend/index.html 是否打包在内",
        )



def run_server():
    """在子线程中安全运行 Uvicorn"""
    global uvicorn_server
    config = uvicorn.Config(app, host=SERVER_HOST, port=SERVER_PORT, log_level="warning")
    uvicorn_server = uvicorn.Server(config)
    uvicorn_server.run()


def _open_browser_when_ready():
    """服务就绪后自动打开浏览器访问本地 API"""
    server_ready.wait(timeout=60)
    url = f"http://127.0.0.1:{SERVER_PORT}"
    print(f"[UI] 服务已就绪，自动打开: {url}", flush=True)
    webbrowser.open(url)


if __name__ == "__main__":
    # 1. 后端丢给子线程启动
    server_thread = threading.Thread(target=run_server)
    server_thread.daemon = True
    server_thread.start()

    # 2. 自动打开浏览器访问对应端口（不打包任何原生窗口 / pywebview）
    threading.Thread(target=_open_browser_when_ready, daemon=True).start()

    # 3. 主线程保持存活，Ctrl+C 退出
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        print("[Server] 正在退出...")
        if uvicorn_server:
            uvicorn_server.should_exit = True
