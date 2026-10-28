#!/usr/bin/env python3
"""Rembg Studio BYOM manager. Models never ship with the application."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from model_catalog import MODELS, catalog, install, import_local
def main():
    p=argparse.ArgumentParser()
    sub=p.add_subparsers(dest="command",required=True)
    sub.add_parser("list")
    d=sub.add_parser("download")
    d.add_argument("model",choices=sorted(k for k,v in MODELS.items() if v["url"]))
    d.add_argument("--source",choices=["official","mirror"],default="official")
    d.add_argument("--sha256")
    i=sub.add_parser("import")
    i.add_argument("model",choices=sorted(MODELS))
    i.add_argument("file")
    i.add_argument("--sha256")
    a=p.parse_args()
    if a.command=="list":result=catalog()
    elif a.command=="download":result=install(a.model,source=a.source,expected_sha256=a.sha256)
    else:result=import_local(a.model,a.file,expected_sha256=a.sha256)
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=="__main__":main()
