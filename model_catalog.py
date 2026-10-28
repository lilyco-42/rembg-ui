"""Approved-source catalog and safe local model installer (BYOM)."""
import hashlib
import os
from pathlib import Path
import urllib.request
from urllib.parse import urlparse

RELEASE="https://github.com/danielgatis/rembg/releases/download/v0.0.0/"
MODELS={
 "u2netp":{"file":"u2netp.onnx","purpose":"轻量通用","license":"Check original model terms","url":RELEASE+"u2netp.onnx"},
 "u2net":{"file":"u2net.onnx","purpose":"通用","license":"Check original model terms","url":RELEASE+"u2net.onnx"},
 "u2net_human_seg":{"file":"u2net_human_seg.onnx","purpose":"人像","license":"Check original model terms","url":RELEASE+"u2net_human_seg.onnx"},
 "u2net_cloth_seg":{"file":"u2net_cloth_seg.onnx","purpose":"服装","license":"Check original model terms","url":RELEASE+"u2net_cloth_seg.onnx"},
 "silueta":{"file":"silueta.onnx","purpose":"小模型","license":"Check original model terms","url":RELEASE+"silueta.onnx"},
 "isnet-anime":{"file":"isnet-anime.onnx","purpose":"动漫","license":"Check original model terms","url":RELEASE+"isnet-anime.onnx"},
 "isnet-general-use":{"file":"isnet-general-use.onnx","purpose":"通用细节","license":"Check original model terms","url":RELEASE+"isnet-general-use.onnx"},
 "bria-rmbg":{"file":"bria-rmbg.onnx","purpose":"高精度去背景","license":"CC BY-NC 4.0; commercial license required","url":None,"model_card":"https://huggingface.co/briaai/RMBG-2.0"},
}
HOSTS={"github.com","hf-mirror.com","huggingface.co"}
def model_dir():
    return Path(os.environ.get("U2NET_HOME",Path.home()/".u2net")).expanduser()
def catalog():
    root=model_dir()
    return {key:{**v,"name":key,"group":"模型市场","size":"按需下载","installed":(root/v["file"]).is_file(),"path":str(root/v["file"]),"source":v["url"],"file":v["file"]} for key,v in MODELS.items()}
def install(model, *, source="official", expected_sha256=None):
    if model not in MODELS:raise ValueError("Unknown model")
    entry=MODELS[model]
    if not entry["url"]:raise ValueError("License-gated model: import a user-authorized local file instead")
    url=entry["url"]
    if source=="mirror" and "huggingface.co/" in url:
        url=url.replace("https://huggingface.co/","https://hf-mirror.com/",1)
    elif source!="official":raise ValueError("Unsupported source")
    if urlparse(url).hostname not in HOSTS:raise ValueError("Unexpected host")
    root=model_dir();root.mkdir(parents=True,exist_ok=True)
    dest=root/entry["file"]
    if dest.exists():return {"status":"existing","path":str(dest)}
    part=dest.with_suffix(".onnx.part")
    pos=part.stat().st_size if part.exists() else 0
    headers={"User-Agent":"Rembg-Studio/0.2","Accept-Encoding":"identity"}
    if pos:headers["Range"]=f"bytes={pos}-"
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=35) as response:
        if response.geturl().split(":")[0]!="https":raise ValueError("Insecure redirect")
        status=response.status
        mode="ab" if pos and status==206 else "wb"
        with part.open(mode) as handle:
            while chunk:=response.read(1024*1024):
                handle.write(chunk)
                if handle.tell()>2*1024**3:raise ValueError("Model exceeds 2 GiB safety limit")
    if part.stat().st_size<1024:raise ValueError("Download incomplete")
    h=hashlib.sha256()
    with part.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):h.update(chunk)
    if expected_sha256 and h.hexdigest().lower()!=expected_sha256.lower():
        part.unlink(missing_ok=True)
        raise ValueError("SHA256 mismatch")
    # ONNX model protobuf header sanity check is not a full model validation.
    os.replace(part,dest)
    return {"status":"installed","path":str(dest),"sha256":h.hexdigest()}

def import_local(model, source_path, *, expected_sha256=None):
    """Import an already-licensed ONNX file into a known model slot."""
    import shutil
    if model not in MODELS: raise ValueError("Unknown model")
    src=Path(source_path).expanduser().resolve()
    if not src.is_file() or src.suffix.lower()!=".onnx": raise ValueError("Select an ONNX file")
    if src.stat().st_size<1024 or src.stat().st_size>2*1024**3: raise ValueError("Invalid model size")
    h=hashlib.sha256()
    with src.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):h.update(chunk)
    if expected_sha256 and h.hexdigest().lower()!=expected_sha256.lower():
        raise ValueError("SHA256 mismatch")
    root=model_dir();root.mkdir(parents=True,exist_ok=True)
    dest=root/MODELS[model]["file"]
    if dest.exists():raise ValueError("Target already exists, refusing overwrite")
    temp=dest.with_suffix(".onnx.importing")
    try:
        shutil.copyfile(src,temp)
        os.replace(temp,dest)
    finally:temp.unlink(missing_ok=True)
    return {"status":"imported","path":str(dest),"sha256":h.hexdigest()}
