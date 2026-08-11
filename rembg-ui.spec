# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules, copy_metadata

hiddenimports = ['uvicorn.logging', 'uvicorn.loops.auto', 'uvicorn.protocols.http.auto', 'fastapi', 'multipart', 'numpy', 'PIL._tkinter_finder', 'skimage']
hiddenimports += collect_submodules('ultralytics')
hiddenimports += collect_submodules('rembg')

# 修复 Release 版启动崩溃（importlib.metadata.PackageNotFoundError，issue #1）：
# pymatting/ultralytics 等在 import 时用 importlib.metadata.version() 读取自身/依赖版本，
# 必须把这些发行版的 .dist-info 元数据一并打包。
_datas = [('frontend', 'frontend'), ('sponsor\\assets', 'sponsor\\assets'), ('rembg.ico', '.')]
_datas += copy_metadata('pymatting')
_datas += copy_metadata('torchvision')
_datas += copy_metadata('torch')
_datas += copy_metadata('numpy')
_datas += copy_metadata('ultralytics')

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=_datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['matplotlib', 'tensorflow', 'notebook', 'ipython', 'jupyter', 'torch.distributed', 'torch.legacy', 'torch.testing', 'torch.utils.tensorboard', 'torchvision', 'tkinter'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='rembg-ui',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='rembg-ui',
)
