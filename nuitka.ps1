<#============================================================================
  Nuitka 打包脚本 — Rembg Studio
  用法: powershell -ExecutionPolicy Bypass -File nuitka.ps1
=============================================================================#>
$ErrorActionPreference = "Stop"
$env:PYTHONUTF8 = 1

$root = $PSScriptRoot
$nuitka = Join-Path (Join-Path $root ".venv") "Scripts\nuitka.cmd"

$args = @(
    # 输出模式
    "--standalone"
    "--output-dir=dist"
    "--python-flag=-O"

    # Windows 相关
    "--assume-yes-for-downloads"
    "--include-windows-runtime-dlls=yes"

    # 首次打包先注释掉下行，看控制台输出排查报错
    "--windows-console-mode=disable"

    # 包含资源目录
    "--include-data-dir=frontend=frontend"
    "--include-data-dir=processors=processors"

    # 包含 Python 包
    "--include-package=fastapi"
    "--include-package=ultralytics"

    # 跳过这些包的源码编译（直接复制字节码），避免编码 / JIT 报错
    "--nofollow-import-to=fastapi.agents"
    "--nofollow-import-to=torch"
    "--nofollow-import-to=numba"
    "--nofollow-import-to=matplotlib"

    # JIT 禁用
    "--module-parameter=torch-disable-jit=yes"

    "main.py"
)

Write-Host ">>> nuitka $($args -join ' ')" -ForegroundColor Cyan
& $nuitka $args

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ 打包成功！" -ForegroundColor Green
    Write-Host "   可执行文件: dist\main.dist\main.exe" -ForegroundColor Green
    Write-Host "   注意：首次运行会自动下载 mobile_sam.pt (~40MB)，需联网" -ForegroundColor Yellow
    Write-Host "   如需离线分发，将 mobile_sam.pt 放入 dist\main.dist\ 下" -ForegroundColor Yellow
} else {
    Write-Host "`n❌ 打包失败，请检查上方错误日志" -ForegroundColor Red
}
