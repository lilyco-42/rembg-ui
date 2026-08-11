import importlib.metadata
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent

# 打包后 importlib.metadata 找不到 .dist-info 会抛 PackageNotFoundError（issue #1）。
# 以下发行版在 import 时会读取自身/依赖的版本元数据，需要把它们的 .dist-info 一并打进产物。
# 它们都会被 Nuitka 跟随导入自动包含（pymatting 经 rembg；torchvision/torch 经 ultralytics），
# 因此只需 --include-distribution-metadata，无需强制 --include-package 增加体积。
METADATA_DISTRIBUTIONS = ["pymatting", "torchvision", "torch"]


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

    cmd = [
        sys.executable,
        "-m",
        "nuitka",
        "--standalone",
        f"--windows-console-mode={'force' if is_debug else 'disable'}",
        f"--windows-icon-from-ico={ROOT / 'rembg.ico'}",
        f"--include-data-dir={ROOT / 'frontend'}=frontend",
        f"--include-data-dir={ROOT / 'sponsor' / 'assets'}=sponsor/assets",
        "--include-package=fastapi",
        "--include-package=sponsor",
        "--nofollow-import-to=fastapi.agents",
        # 跳过 torch._inductor：其生成的模板代码含非 UTF-8 字符，
        # 在 Windows(gbk) 下 Nuitka anti-bloat 解析会崩（gbk 编码报错）
        "--nofollow-import-to=torch._inductor",
        "--include-windows-runtime-dlls=yes",
        "--assume-yes-for-downloads",
        f"--output-dir={ROOT / 'dist'}",
        str(ROOT / "main.py"),
    ]

    # 修复 Release 版启动崩溃（issue #1）：把会在 import 时读取自身/依赖版本的
    # 发行版元数据打进产物，避免 importlib.metadata 抛 PackageNotFoundError
    for dist_name in METADATA_DISTRIBUTIONS:
        if distribution_installed(dist_name):
            cmd.append(f"--include-distribution-metadata={dist_name}")
        else:
            print(f"[warn] 发行版未安装，跳过其元数据: {dist_name}")

    if not is_debug:
        cmd.append("--python-flag=-O")

    print(f"Building [{mode.upper()}] with Nuitka...")
    subprocess.run(cmd, check=True)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "release"
    if mode not in ("debug", "release"):
        print(f"用法: python build_nuitka.py [debug|release]")
        sys.exit(1)
    build(mode)
