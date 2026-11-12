#!/usr/bin/env bash
# Rembg Studio 一键启动（商用版 · 授权试用）
# 用法：把本文件放在与 rembg-ui / Rembg-UI-linux-x86_64.AppImage 相同的解压目录，双击或在终端运行。
set -u
cd "$(dirname "$0")" || exit 1
export REMBG_EDITION=pro

echo "正在启动 Rembg Studio（商用版 · 授权试用），浏览器会自动打开。"
echo "保持本窗口开启；关闭窗口即退出程序。"

if [ -x ./rembg-ui ]; then
  exec ./rembg-ui
elif [ -x ./Rembg-UI-linux-x86_64.AppImage ]; then
  # AppImage 需要 FUSE；没有 FUSE 时自动解包运行，环境变量会透传给内部进程。
  export APPIMAGE_EXTRACT_AND_RUN=1
  exec ./Rembg-UI-linux-x86_64.AppImage
elif [ -x ./rembg-ui.app/Contents/MacOS/rembg-ui ]; then
  exec ./rembg-ui.app/Contents/MacOS/rembg-ui
else
  echo "未找到程序：请把 Rembg-UI-linux.tar.gz / AppImage / macOS.zip 完整解压到本文件夹。"
  echo "注意：macOS 也可以直接双击 rembg-ui.app；如需社区版请用本启动器。"
  read -r -p "按回车键退出..." _
  exit 1
fi
