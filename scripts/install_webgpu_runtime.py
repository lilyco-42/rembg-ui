#!/usr/bin/env python3
"""Install pinned ORT WebGPU runtime assets from npmmirror (npm fallback)."""
import argparse
import pathlib
import os
import shutil
import subprocess
import tarfile
import tempfile

VERSION = "1.22.0"
FILES = ("ort.webgpu.min.mjs", "ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm")
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(pathlib.Path(__file__).resolve().parents[1]/"frontend/vendor/ort"))
    args = parser.parse_args()
    out = pathlib.Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=True)
    if all((out/name).is_file() and (out/name).stat().st_size > 1000 for name in FILES):
        print("ORT WebGPU runtime cached:", out)
        return
    npm = shutil.which("npm.cmd") if os.name == "nt" else shutil.which("npm")
    if npm is None:
        raise SystemExit("npm is required to bundle the offline WebGPU runtime")
    with tempfile.TemporaryDirectory() as temp:
        archive = pathlib.Path(temp)/f"onnxruntime-web-{VERSION}.tgz"
        for registry in ("https://registry.npmmirror.com", "https://registry.npmjs.org"):
            try:
                subprocess.run([npm, "pack", f"onnxruntime-web@{VERSION}", "--silent", "--pack-destination", temp, "--registry", registry],
                               check=True, timeout=120)
                break
            except (subprocess.SubprocessError, OSError) as error:
                print("npm registry failed:", registry, error)
        if not archive.exists():
            raise SystemExit("ORT WebGPU npm archive download failed")
        with tarfile.open(archive, "r:gz") as package:
            for name in FILES:
                member = package.getmember("package/dist/" + name)
                if not member.isfile() or member.size < 1000 or member.size > 70 * 1024 * 1024:
                    raise RuntimeError("Invalid runtime asset: " + name)
                data = package.extractfile(member)
                dest = out / (name+".part")
                with dest.open("wb") as f:
                    while True:
                        chunk = data.read(1024*1024)
                        if not chunk:
                            break
                        f.write(chunk)
                dest.replace(out/name)
                print("Installed", name, (out/name).stat().st_size)
if __name__ == "__main__":
    main()
