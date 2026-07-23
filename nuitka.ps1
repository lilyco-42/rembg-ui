<#
  Nuitka build script - Rembg Studio
  Usage: powershell -ExecutionPolicy Bypass -File nuitka.ps1
#>
$ErrorActionPreference = "Stop"
$env:PYTHONUTF8 = 1

$root = $PSScriptRoot
$nuitka = Join-Path (Join-Path $root ".venv") "Scripts\nuitka.cmd"

$args = @(
    "--standalone"
    "--output-dir=dist"
    "--python-flag=-O"
    "--assume-yes-for-downloads"
    "--include-windows-runtime-dlls=yes"
    "--windows-console-mode=disable"
    "--include-data-dir=frontend=frontend"
    "--include-data-dir=processors=processors"
    "--include-package=fastapi"
    "--include-package=ultralytics"
    "--nofollow-import-to=fastapi.agents"
    "--nofollow-import-to=torch"
    "--nofollow-import-to=numba"
    "--nofollow-import-to=matplotlib"
    "--module-parameter=torch-disable-jit=yes"
    "main.py"
)

Write-Host ">>> nuitka $($args -join ' ')" -ForegroundColor Cyan
& $nuitka $args

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Build success!" -ForegroundColor Green
    Write-Host "     Exe: dist/main.dist/main.exe" -ForegroundColor Green
    Write-Host "     Note: First run downloads mobile_sam.pt (~40MB), needs internet" -ForegroundColor Yellow
    Write-Host "     For offline: copy mobile_sam.pt into dist/main.dist/" -ForegroundColor Yellow
} else {
    Write-Host "[FAIL] Build failed, check errors above" -ForegroundColor Red
}
