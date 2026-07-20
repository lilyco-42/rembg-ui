import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent


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
        "--include-package=fastapi",
        "--include-package=shared",
        "--include-package=shared.sponsor",
        "--nofollow-import-to=fastapi.agents",
        "--include-windows-runtime-dlls=yes",
        "--assume-yes-for-downloads",
        f"--output-dir={ROOT / 'dist'}",
        str(ROOT / "main.py"),
    ]

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
