#!/usr/bin/env python3
"""Convert checked U2Netp ONNX pools for ORT WebGPU; preserves CPU output at 320px."""
import argparse
import pathlib
import hashlib
import onnx
from download_webgpu_model import main as fetch_original

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--model-dir", default=str(pathlib.Path.home()/".u2net"))
    args=parser.parse_args()
    folder=pathlib.Path(args.model_dir).expanduser()
    src=folder/"u2netp.onnx"
    target=folder/"u2netp-webgpu.onnx"
    if not src.is_file():
        raise SystemExit("First run scripts/download_webgpu_model.py")
    from download_webgpu_model import good
    if not good(src):
        raise SystemExit("Original U2Netp checksum mismatch; refusing conversion")
    model=onnx.load(str(src))
    changed=0
    for node in model.graph.node:
        if node.op_type=="MaxPool":
            for attr in node.attribute:
                if attr.name=="ceil_mode" and attr.i == 1:
                    attr.i=0
                    changed+=1
    if changed != 33:
        raise SystemExit(f"Unexpected U2Netp graph ({changed} MaxPool nodes); no converted model saved")
    onnx.checker.check_model(model)
    tmp=target.with_suffix(".onnx.part")
    onnx.save(model,str(tmp))
    tmp.replace(target)
    print(f"Prepared WebGPU model: {target} ({target.stat().st_size} bytes)")
    print("SHA256:",hashlib.sha256(target.read_bytes()).hexdigest())
    print("NOTE: conversion validated for 320x320 input; do not apply generally.")
if __name__=="__main__":
    main()
