$ErrorActionPreference = "Stop"
$env:PYTHONUTF8 = 1

$nuitka = Join-Path (Join-Path $PSScriptRoot ".venv") "Scripts\nuitka.cmd"

& $nuitka --standalone `
    --output-dir=dist --python-flag=-O --assume-yes-for-downloads `
    --include-windows-runtime-dlls=yes `
    --include-data-dir=frontend=frontend --include-data-dir=processors=processors `
    --include-package=fastapi --include-package=ultralytics `
    --nofollow-import-to=fastapi.agents `
    --nofollow-import-to=torch._inductor `
    --module-parameter=numba-disable-jit=yes --module-parameter=torch-disable-jit=yes `
    main.py

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] dist/main.dist/main.exe" -ForegroundColor Green
} else {
    Write-Host "[FAIL]" -ForegroundColor Red
}
