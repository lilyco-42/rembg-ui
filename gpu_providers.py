"""ONNX Runtime Execution Provider 自动探测（与 Web 应用入口解耦，便于单测）。

rembg 主管线走 onnxruntime。不同 ORT 发行版提供的 ExecutionProvider 不同：
  * onnxruntime-gpu      -> CUDAExecutionProvider（NVIDIA）
  * onnxruntime-migraphx -> MIGraphXExecutionProvider（AMD ROCm，如 Radeon 780M / gfx1103）
  * onnxruntime (macOS)  -> CoreMLExecutionProvider
两个 Linux 发行版共享 onnxruntime/capi 目录，**不能共存于同一环境**，因此
本模块不尝试运行时切换包，而是只看 get_available_providers() 实际列出的
Provider 来选：同一份应用代码对两个构建变体都适用。

探测不能只信 get_available_providers()（缺运行库时它会误报，例如缺 cuDNN
仍列出 CUDA）；必须用一个最小 ONNX 模型真正创建会话确认。空模型 b"" 会因
"No graph was found" 永远失败，也不能用。
"""
from __future__ import annotations

import base64
import os
import sys
from typing import Callable, List, Optional, Sequence

# 单个 Relu 节点的最小 ONNX 模型（输入 x: float32[1,1]），仅用于 Provider 可用性探测。
_MIN_ONNX = base64.b64decode(
    "CA06OwoMCgF4EgF5IgRSZWx1EgFtWhMKAXgSDgoMCAESCAoCCAEKAggBYhMKAXkSDgoMCAESCAoCCAEKAggBQgQKABAN"
)

MIGRAPHX_EP = "MIGraphXExecutionProvider"
CUDA_EP = "CUDAExecutionProvider"
COREML_EP = "CoreMLExecutionProvider"
CPU_EP = "CPUExecutionProvider"

# providers 列表元素：str 或 (name, options_dict) 元组
Provider = object


def _cuda_lib_dirs() -> List[str]:
    """返回需要加入 CUDA 运行库搜索路径的目录（Linux）：
      - -cuda 打包产物：二进制同级的 nvidia-cuda/lib/
      - 开发环境：pip 安装的 nvidia-* 包所在 site-packages/nvidia/<pkg>/lib/
        （如 nvidia-cudnn-cu12 提供 libcudnn.so.9）。"""
    dirs: List[str] = []
    base = os.path.join(os.path.dirname(sys.executable), "nvidia-cuda", "lib")
    if os.path.isdir(base):
        dirs.append(base)
    try:
        import site

        for sp in list(site.getsitepackages()) + [os.path.dirname(os.__file__)]:
            ndir = os.path.join(sp, "nvidia")
            if os.path.isdir(ndir):
                for sub in os.listdir(ndir):
                    lib = os.path.join(ndir, sub, "lib")
                    if os.path.isdir(lib):
                        dirs.append(lib)
    except Exception:
        pass
    return dirs


def ensure_cuda_ldpath() -> None:
    """Linux 上，若 nvidia 运行库目录未进入 LD_LIBRARY_PATH，就重启本进程并前置该路径。

    onnxruntime-gpu 的 CUDA Provider 通过 dlopen 按 SONAME 查找 libcudnn.so.9 等库；
    cuDNN 9 的子库之间存在循环依赖，仅靠 ctypes 逐个预加载无法解开，必须由动态链接器
    在进程启动时就从目录里解析。因此在 import onnxruntime 之前设置 LD_LIBRARY_PATH
    并 os.execv 重启自身。AMD MIGraphX 变体没有 nvidia 目录，此函数直接返回、不重启。
    """
    if not sys.platform.startswith("linux"):
        return
    dirs = _cuda_lib_dirs()
    if not dirs:
        return
    existing = set(p for p in os.environ.get("LD_LIBRARY_PATH", "").split(os.pathsep) if p)
    if all(d in existing for d in dirs):
        return
    new_path = os.pathsep.join(
        dirs + ([os.environ["LD_LIBRARY_PATH"]] if os.environ.get("LD_LIBRARY_PATH") else [])
    )
    os.environ["LD_LIBRARY_PATH"] = new_path
    os.execv(sys.executable, [sys.executable] + sys.argv)


def _preload_cuda_runtime() -> None:
    """Linux 兜底：以 RTLD_GLOBAL 预加载 nvidia 运行库（SONAME 常驻进程）。
    主要解循环依赖靠 ensure_cuda_ldpath()；这里作为补充，覆盖无法改环境变量的打包产物。"""
    if not sys.platform.startswith("linux"):
        return
    import ctypes
    from glob import glob

    dirs = _cuda_lib_dirs()
    if not dirs:
        return
    remaining: List[str] = []
    for d in dirs:
        remaining += glob(os.path.join(d, "*.so*"))
    progress = True
    while progress and remaining:
        progress = False
        still: List[str] = []
        for path in remaining:
            try:
                ctypes.CDLL(path, mode=os.RTLD_GLOBAL)
                progress = True
            except OSError:
                still.append(path)
        remaining = still


def migraphx_cache_dir() -> Optional[str]:
    """MIGraphX 模型编译缓存目录。

    MIGraphX 是 AOT 编译执行：首次加载 u2netp 在 780M 上约需 5 分钟编译，命中缓存后
    仅约 5 秒。不设缓存首启会像卡死，故默认落到 ~/.cache/rembg-ui-migraphx，可用
    REMBG_MIGRAPHX_CACHE_DIR 覆盖。缓存与 GPU / 驱动 / ROCm 版本绑定，不随发布包分发。
    目录不可创建时返回 None（仍可用 MIGraphX，只是每次都重新编译）。
    """
    cache = os.environ.get("REMBG_MIGRAPHX_CACHE_DIR") or os.path.join(
        os.path.expanduser("~"), ".cache", "rembg-ui-migraphx"
    )
    try:
        os.makedirs(cache, exist_ok=True)
    except OSError:
        return None
    return cache


def _default_session_factory(model_bytes: bytes, providers, config_entries=None):
    import onnxruntime as ort

    so = ort.SessionOptions()
    so.log_severity_level = 3
    for key, value in config_entries or []:
        so.add_session_config_entry(key, value)
    return ort.InferenceSession(model_bytes, sess_options=so, providers=providers)


def detect_providers(
    platform: Optional[str] = None,
    available: Optional[Sequence[str]] = None,
    session_factory: Optional[Callable] = None,
    preload_cuda: Optional[Callable] = None,
) -> list:
    """按平台探测可用 GPU 加速，返回可直接传给 ort.InferenceSession 的 providers 列表。

    优先级：AMD MIGraphX(ROCm) > NVIDIA CUDA > Apple CoreML > CPU。
    参数仅供测试注入；生产调用 detect_providers() 无参。
    """
    platform = platform or sys.platform
    try:
        if available is None or session_factory is None:
            import onnxruntime as ort

            if available is None:
                available = ort.get_available_providers()
            if session_factory is None:
                session_factory = _default_session_factory
        if preload_cuda is None:
            preload_cuda = _preload_cuda_runtime

        if platform == "darwin":
            if COREML_EP in available:
                return [COREML_EP, CPU_EP]
            return [CPU_EP]

        # AMD ROCm / MIGraphX（Radeon 780M 等 gfx11 核显）：onnxruntime-migraphx 发行版。
        # 用最小模型真建会话确认；带模型编译缓存目录避免首次 u2netp 编译数分钟。
        if MIGRAPHX_EP in available:
            cache = migraphx_cache_dir()
            options = {"migraphx_model_cache_dir": cache} if cache else {}
            ep = (MIGRAPHX_EP, options)
            try:
                session_factory(_MIN_ONNX, [ep])
            except Exception:
                pass  # 探测失败则继续尝试 CUDA / 回退 CPU
            else:
                return [ep, CPU_EP]

        # NVIDIA CUDA：先按 RTLD_GLOBAL 预加载运行库，再用最小模型真建会话。
        preload_cuda()
        if CUDA_EP not in available:
            return [CPU_EP]
        try:
            session_factory(_MIN_ONNX, [CUDA_EP], [("session.use_env_allocators", "1")])
        except Exception:
            return [CPU_EP]
        return [CUDA_EP, CPU_EP]
    except Exception:
        return [CPU_EP]
