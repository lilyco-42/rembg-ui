#!/usr/bin/env python3
"""Prepare FP16 ONNX for large WebGPU inference without overwriting original.
The output must pass separately tested accuracy and browser GPU compatibility.
"""
import argparse
import hashlib
import os
import pathlib
import shutil
import sys

def main():
    p = argparse.ArgumentParser(description="Opt-in FP16 weight conversion for large ONNX models")
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--min-free-gib", type=float, default=5.0)
    p.add_argument("--block-op", action="append", default=[])
    args = p.parse_args()
    src, dst = pathlib.Path(args.input).expanduser().resolve(), pathlib.Path(args.output).expanduser().resolve()
    if not src.is_file() or not src.name.endswith(".onnx"):
        p.error("input .onnx model is required")
    if src == dst or dst.exists():
        p.error("output must be a new file, never overwrite original or existing model")
    if shutil.disk_usage(dst.parent).free < max(src.stat().st_size * 2, 1 << 30):
        p.error("insufficient free disk for intermediate converted model")
    if sys.platform.startswith("linux"):
        avail = 0
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemAvailable:"):
                    avail=int(line.split()[1])*1024;break
        required=max(int(args.min_free_gib * 1024**3),src.stat().st_size*4)
        if avail < required:
            p.error("insufficient available memory for safe conversion")
    import onnx
    from onnxconverter_common import float16
    print("Loading source model ...",flush=True)
    model=onnx.load(str(src))
    print("Converting float weights to FP16; retaining I/O type ...",flush=True)
    converted=float16.convert_float_to_float16(model, keep_io_types=True, op_block_list=args.block_op or None)
    onnx.checker.check_model(converted)
    partial=dst.with_name(dst.name+".part")
    try:
        onnx.save(converted,str(partial))
        if partial.stat().st_size < 1024: raise RuntimeError("invalid converted output")
        os.replace(partial,dst)
    finally:
        partial.unlink(missing_ok=True)
    print("Prepared:",dst, "bytes:",dst.stat().st_size)
    h=hashlib.sha256()
    with dst.open("rb") as f:
        for piece in iter(lambda:f.read(1024*1024),b""):h.update(piece)
    print("SHA256:",h.hexdigest())
    print("IMPORTANT: This converts model weights; full WebGPU inference and quality still require tests.")

if __name__ == "__main__": main()
