#!/usr/bin/env python3
"""Reproducible local CPU-only U2Netp benchmark (warm timings in ms)."""
import argparse
import json
import statistics
import time
from pathlib import Path
import numpy as np
import onnxruntime as ort

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--model',default=str(Path.home()/'.u2net/u2netp-webgpu.onnx'))
    p.add_argument('--runs',type=int,default=8)
    p.add_argument('--threads',type=int,nargs='+',default=[1,2,4,8])
    a=p.parse_args()
    if a.runs<4: p.error('--runs must be >=4')
    x=np.sin(np.arange(3*320*320,dtype=np.float32)*.007).reshape(1,3,320,320)
    report={}
    for count in a.threads:
        so=ort.SessionOptions();so.intra_op_num_threads=count;so.inter_op_num_threads=1
        session=ort.InferenceSession(a.model,sess_options=so,providers=['CPUExecutionProvider'])
        data=[]
        for _ in range(a.runs):
            t=time.perf_counter()
            out=session.run(None,{session.get_inputs()[0].name:x})[0]
            data.append(round((time.perf_counter()-t)*1000,2))
        warm=data[3:]
        report[str(count)]={'runs_ms':data,'warm_median_ms':round(statistics.median(warm),2),'output_shape':list(out.shape)}
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
