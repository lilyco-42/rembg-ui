#!/usr/bin/env bash
# Linux 打包脚本：Nuitka 构建 + 打包 tar.gz
# 依赖：uv（或已激活的 .venv）。产物在 dist/Rembg-UI-linux.tar.gz
set -euo pipefail
cd "$(dirname "$0")"

echo "[Build] 开始 Nuitka 构建（Linux），可能需要较长时间..."
uv run python build_nuitka.py release

echo "[Build] 打包产物..."
mkdir -p dist
tar -czf dist/Rembg-UI-linux.tar.gz -C dist/main.dist .

echo "[OK] 打包完成: dist/Rembg-UI-linux.tar.gz"
echo "     解压后运行: ./main.bin"
