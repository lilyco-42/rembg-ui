#!/usr/bin/env python3
"""Verified, resumable U2Netp download with HF China mirror failover."""
import argparse
import hashlib
import os
import pathlib
import time
import urllib.error
import urllib.request

SIZE = 4574861
SHA256 = "309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8"
SOURCES = [
    "https://hf-mirror.com/edgetools/u2netp/resolve/main/u2netp.onnx",
    "https://huggingface.co/edgetools/u2netp/resolve/main/u2netp.onnx",
    "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx",
]
def good(path):
    if not path.is_file() or path.stat().st_size != SIZE:
        return False
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest() == SHA256

def download(url, part):
    offset = part.stat().st_size if part.exists() else 0
    if offset > SIZE:
        part.unlink()
        offset = 0
    headers = {"User-Agent": "Rembg-Studio-model-downloader/1.0"}
    if offset:
        headers["Range"] = f"bytes={offset}-"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=25) as response:
        status = response.status
        if offset and status != 206:
            # A server returning 200 ignored Range. Restart rather than append corruption.
            offset = 0
        if status == 206 and not offset:
            raise ValueError("unexpected partial response")
        with part.open("ab" if offset else "wb") as out:
            while True:
                chunk = response.read(256 * 1024)
                if not chunk:
                    break
                out.write(chunk)
                if out.tell() > SIZE:
                    raise ValueError("model exceeds expected size")
    if part.stat().st_size != SIZE:
        raise ValueError(f"incomplete: {part.stat().st_size}/{SIZE}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", default=str(pathlib.Path.home()/".u2net"/"u2netp.onnx"))
    ap.add_argument("--retries", type=int, default=2)
    args = ap.parse_args()
    target = pathlib.Path(args.output).expanduser()
    target.parent.mkdir(parents=True, exist_ok=True)
    if good(target):
        print("OK cached verified model:", target)
        return 0
    if target.exists():
        raise SystemExit("Existing model failed checksum; refusing to overwrite: "+str(target))
    part = target.with_suffix(target.suffix + ".part")
    for attempt in range(max(1, args.retries)):
        for url in SOURCES:
            try:
                print("Downloading", url, "resuming from", part.stat().st_size if part.exists() else 0, flush=True)
                download(url, part)
                if not good(part):
                    part.unlink(missing_ok=True)
                    raise ValueError("SHA-256 mismatch")
                os.replace(part, target)
                print("Verified SHA-256:", SHA256, flush=True)
                return 0
            except (OSError, urllib.error.URLError, ValueError) as e:
                print("Source failed:", str(e), flush=True)
        time.sleep(min(2**attempt, 8))
    raise SystemExit("Download failed, partial data retained: "+str(part))
if __name__ == "__main__":
    raise SystemExit(main())
