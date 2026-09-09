import importlib.metadata
import re
import shutil
import subprocess
import sys
from pathlib import Path

try:
    import tomllib  # Python 3.11+
except ImportError:  # pragma: no cover
    tomllib = None

ROOT = Path(__file__).parent

# 应用名与产物命名（Windows → rembg-ui.exe，Linux → rembg-ui.bin，macOS → rembg-ui.app）
APP_NAME = "Rembg Studio"
OUTPUT_NAME = "rembg-ui"

# 打包后 importlib.metadata 找不到 .dist-info 会抛 PackageNotFoundError（issue #1）。
# 以下发行版在 import 时会读取自身/依赖的版本元数据，需要把它们的 .dist-info 一并打进产物。
# 它们都会被 Nuitka 跟随导入自动包含（pymatting 经 rembg；torchvision/torch 经 ultralytics），
# 因此只需 --include-distribution-metadata，无需强制 --include-package 增加体积。
METADATA_DISTRIBUTIONS = ["PyMatting", "torchvision", "torch"]


def _project_version() -> str:
    """从 pyproject.toml 读取版本号，作为产物版本元数据"""
    if tomllib is not None:
        try:
            with open(ROOT / "pyproject.toml", "rb") as f:
                return tomllib.load(f)["project"].get("version", "0.0.0")
        except Exception:
            pass
    m = re.search(r'^\s*version\s*=\s*"([^"]+)"', (ROOT / "pyproject.toml").read_text(encoding="utf-8"), re.M)
    return m.group(1) if m else "0.0.0"


def distribution_installed(name: str) -> bool:
    """当前构建环境是否已安装该发行版"""
    try:
        importlib.metadata.version(name)
        return True
    except Exception:
        return False


def build(mode: str = "release"):
    build_dir = ROOT / "dist"
    if build_dir.exists():
        shutil.rmtree(build_dir)
        print("已清理 dist 目录")

    is_debug = mode == "debug"
    version = _project_version()

    # 编译模式：macOS 用 --mode=app 产出 .app 应用包（必须，且与 --standalone 互斥——
    # 只给 --standalone 时 Nuitka 会警告 macos-app-* 选项全部失效、不生成 .app/.dmg）；
    # Windows / Linux 用经典 --standalone
    mode_flag = "--mode=app" if sys.platform.startswith("darwin") else "--standalone"

    # 跨平台通用参数
    cmd = [
        sys.executable,
        "-m",
        "nuitka",
        mode_flag,
        f"--output-folder-name={OUTPUT_NAME}",
        f"--output-filename={OUTPUT_NAME}",
        f"--include-data-dir={ROOT / 'frontend'}=frontend",
        f"--include-data-dir={ROOT / 'sponsor' / 'assets'}=sponsor/assets",
        "--include-package=fastapi",
        "--include-package=sponsor",
        "--nofollow-import-to=fastapi.agents",
        # 跳过 torch._inductor：其生成的模板代码含非 UTF-8 字符，
        # 在 Windows(gbk) 下 Nuitka anti-bloat 解析会崩（gbk 编码报错）；Linux 下同样精简体积
        "--nofollow-import-to=torch._inductor",
        # torch 的 include 头文件目录（~1 万个文件）运行时永远用不到，却会被 Nuitka 计入
        # macOS codesign 命令行（Standalone.py 把 data_file_paths 一并传入签名），超出
        # macOS ARG_MAX 报 "command line was too long" FATAL（曾致 macOS 构建失败）。
        # 排除后三平台 dist 均减重、复制加速。
        "--noinclude-data-files=torch/include",
        # 版本信息：写入 Windows 资源元数据 / macOS Info.plist / Linux 二进制
        # 注意：file-description 用 ASCII，避免 Nuitka 在 Windows(gbk) 解析参数时报错
        "--company-name=lilyco-42",
        f"--product-name={APP_NAME}",
        f"--product-version={version}",
        f"--file-version={version}",
        "--file-description=AI Image Background Remover",
        "--copyright=Copyright (c) lilyco-42",
        "--assume-yes-for-downloads",
        f"--output-dir={ROOT / 'dist'}",
        str(ROOT / "main.py"),
    ]

    # 平台相关的打包参数
    if sys.platform.startswith("win"):
        # Windows：无控制台窗口 + 图标 + C 运行时 DLL
        cmd += [
            f"--windows-console-mode={'force' if is_debug else 'disable'}",
            f"--windows-icon-from-ico={ROOT / 'rembg.ico'}",
            "--include-windows-runtime-dlls=yes",
        ]
    elif sys.platform.startswith("darwin"):
        # macOS：生成 .app 应用包；release 模式下再产出 DMG 安装包
        cmd += [
            f"--macos-app-name={APP_NAME}",
            f"--macos-app-version={version}",
            "--macos-signed-app-name=com.lilyco42.rembg-ui",
            "--macos-app-mode=gui",
        ]
        if not is_debug:
            if shutil.which("create-dmg"):
                cmd.append("--macos-app-create-dmg")
            else:
                print("[warn] 未找到 create-dmg，跳过 DMG（仍产出 .app）")
    elif sys.platform.startswith("linux"):
        # Linux 桌面图标可选：若要给产物加图标，准备一个合适尺寸的 PNG 并取消下面两行
        # icon_png = ROOT / "rembg.png"
        # cmd.append(f"--linux-icon={icon_png}")
        pass

    # 修复 Release 版启动崩溃（issue #1）：把会在 import 时读取自身/依赖版本的
    # 发行版元数据打进产物，避免 importlib.metadata 抛 PackageNotFoundError
    for dist_name in METADATA_DISTRIBUTIONS:
        if distribution_installed(dist_name):
            cmd.append(f"--include-distribution-metadata={dist_name}")
        else:
            print(f"[warn] 发行版未安装，跳过其元数据: {dist_name}")

    if not is_debug:
        cmd.append("--python-flag=-O")

    print(f"Building [{mode.upper()}] with Nuitka (version {version})...")
    subprocess.run(cmd, check=True)
    # CUDA 变体收尾（仅 win/linux）：macOS 用 --mode=app 无 .dist 目录，且 nvidia 包
    # 本就因平台标记不会安装，无需调用
    if sys.platform.startswith(("win", "linux")):
        _bundle_cuda_runtime(build_dir / f"{OUTPUT_NAME}.dist")


def _bundle_cuda_runtime(dist_dir: Path) -> None:
    """-cuda 变体收尾：把构建环境里 nvidia-* wheel 的 CUDA 12 运行库拷进产物。
    默认构建（无 --extra cuda）环境没有这些包，直接跳过。
    - Windows：*.dll 平铺到 dist 根目录——exe 所在目录在 DLL 搜索路径首位，
      onnxruntime 按名加载 cudart64_12.dll 等可直接命中；
    - Linux：*.so* 收集到 dist/nvidia-cuda/lib/——运行时由 main._preload_cuda_runtime
      用 ctypes 按绝对路径预加载（dlopen 的库不做相对搜索，必须显式加载）。
    同时确保 onnxruntime 的 CUDA Provider 动态库真的进了产物（Nuitka 的 dll 追踪
    只报过 1 个 DLL，Provider 是运行时 dlopen 的，不保证被复制）。"""
    import shutil
    import sysconfig

    if not dist_dir.is_dir():
        print(f"[cuda] 未找到产物目录 {dist_dir.name}，跳过 CUDA 打包")
        return

    purelib = Path(sysconfig.get_paths()["purelib"])
    nvidia_root = purelib / "nvidia"

    if not nvidia_root.is_dir():
        print("[cuda] 构建环境未安装 nvidia 运行库（非 --extra cuda），跳过 CUDA 打包")
        return

    if sys.platform.startswith("win"):
        target = dist_dir
        count = 0
        for dll in nvidia_root.glob("*/bin/*.dll"):
            shutil.copy2(dll, target / dll.name)
            count += 1
        print(f"[cuda] 已拷贝 {count} 个 CUDA DLL 到 dist 根目录")
    elif sys.platform.startswith("linux"):
        target = dist_dir / "nvidia-cuda" / "lib"
        target.mkdir(parents=True, exist_ok=True)
        count = 0
        for so in nvidia_root.glob("*/lib/lib*.so*"):
            shutil.copy2(so, target / so.name)
            count += 1
        print(f"[cuda] 已拷贝 {count} 个 CUDA 运行库到 nvidia-cuda/lib/")

    # 保险：补齐 onnxruntime/capi 下缺失的 Provider 动态库（providers_cuda/shared/tensorrt）
    capi_src = purelib / "onnxruntime" / "capi"
    capi_dst = dist_dir / "onnxruntime" / "capi"
    if capi_src.is_dir():
        capi_dst.mkdir(parents=True, exist_ok=True)
        for f in capi_src.iterdir():
            if f.suffix in (".dll", ".so") and not (capi_dst / f.name).exists():
                shutil.copy2(f, capi_dst / f.name)
                print(f"[cuda] 补拷缺失的 ORT Provider 库: {f.name}")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "release"
    if mode not in ("debug", "release"):
        print(f"用法: python build_nuitka.py [debug|release]")
        sys.exit(1)
    build(mode)
