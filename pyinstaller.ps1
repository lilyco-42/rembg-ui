$ErrorActionPreference = "Stop"
$env:PYTHONUTF8 = 1

$venv = Join-Path $PSScriptRoot ".venv"
$python = Join-Path $venv "Scripts\python.exe"
$pyinstaller = Join-Path $venv "Scripts\pyinstaller.exe"
$dist = Join-Path $PSScriptRoot "dist\rembg-ui"

# ensure pyinstaller installed
if (-not (Test-Path $pyinstaller)) {
    & $python -m pip install pyinstaller --quiet
}

# clean old build
if (Test-Path (Join-Path $PSScriptRoot "dist")) {
    Remove-Item -Path (Join-Path $PSScriptRoot "dist") -Recurse -Force
}
if (Test-Path (Join-Path $PSScriptRoot "build")) {
    Remove-Item -Path (Join-Path $PSScriptRoot "build") -Recurse -Force
}

& $pyinstaller --onedir --name "rembg-ui" --noconsole `
    --add-data "frontend;frontend" `
    --add-data "processors;processors" `
    --add-data "sponsor;sponsor" `
    --hidden-import "uvicorn.logging" `
    --hidden-import "uvicorn.loops.auto" `
    --hidden-import "uvicorn.protocols.http.auto" `
    --hidden-import "fastapi" `
    --hidden-import "multipart" `
    --hidden-import "numpy" `
    --hidden-import "PIL._tkinter_finder" `
    --collect-submodules "ultralytics" `
    --collect-submodules "rembg" `
    --exclude-module "matplotlib" `
    --exclude-module "tensorflow" `
    --exclude-module "notebook" `
    --exclude-module "ipython" `
    --exclude-module "jupyter" `
    --exclude-module "torch.distributed" `
    --exclude-module "torch.legacy" `
    --exclude-module "torch.testing" `
    --exclude-module "torch.utils.tensorboard" `
    --exclude-module "torchvision" `
    --exclude-module "tkinter" `
    main.py

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] 打包完成: $dist" -ForegroundColor Green
    Write-Host "    入口: $dist\rembg-ui.exe" -ForegroundColor Green
} else {
    Write-Host "[FAIL] 打包失败" -ForegroundColor Red
}
