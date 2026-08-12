$ErrorActionPreference = "Stop"
$env:PYTHONUTF8 = 1

$root = $PSScriptRoot
$dist = Join-Path $root "dist\rembg-ui"

# clean old build
foreach ($d in @("dist", "build")) {
    $p = Join-Path $root $d
    if (Test-Path $p) { Remove-Item -Recurse -Force $p }
}

# 环境由 uv 管理：pyinstaller 不在项目依赖里，用 uv run --with 按需引入（不写入锁文件）
# 修复 Release 版启动崩溃（issue #1）：递归带上运行时依赖树的 .dist-info 元数据，
# 避免 importlib.metadata 在打包后找不到包版本
& uv run --with pyinstaller pyinstaller --onedir --name "rembg-ui" --noconsole `
    --add-data "frontend;frontend" `
    --add-data "sponsor\assets;sponsor\assets" `
    --add-data "rembg.ico;." `
    --recursive-copy-metadata "rembg" `
    --recursive-copy-metadata "ultralytics" `
    --hidden-import "uvicorn.logging" `
    --hidden-import "uvicorn.loops.auto" `
    --hidden-import "uvicorn.protocols.http.auto" `
    --hidden-import "fastapi" `
    --hidden-import "multipart" `
    --hidden-import "numpy" `
    --hidden-import "PIL._tkinter_finder" `
    --hidden-import "skimage" `
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
    Write-Host "[OK] 打包完成: $dist\rembg-ui.exe" -ForegroundColor Green
} else {
    Write-Host "[FAIL] 打包失败" -ForegroundColor Red
}
