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
METADATA_DISTRIBUTIONS = ["pymatting", "torchvision", "torch"]


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

    # 跨平台通用参数
    cmd = [
        sys.executable,
        "-m",
        "nuitka",
        "--standalone",
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
            cmd.append("--macos-app-create-dmg")
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


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "release"
    if mode not in ("debug", "release"):
        print(f"用法: python build_nuitka.py [debug|release]")
        sys.exit(1)
    build(mode)
