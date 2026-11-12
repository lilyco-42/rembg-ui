@echo off
title Rembg Studio - pro
cd /d "%~dp0"
set "REMBG_EDITION=pro"
if exist "%~dp0rembg-ui.exe" (
  echo 正在启动 Rembg Studio（商用版 · 授权试用），浏览器会自动打开，请勿关闭本窗口。
  "%~dp0rembg-ui.exe"
  goto :done
)
echo 未找到 rembg-ui.exe。
echo 请先把 Rembg-UI-windows.zip 完整解压到本文件夹（不能只复制 exe），再双击本文件。
:done
echo.
echo 程序已退出。若出现错误，请把本窗口内容截图反馈。
pause >nul
