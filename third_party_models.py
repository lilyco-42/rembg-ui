"""Third-party ONNX adapter registry: explicit compatible image->alpha models only."""
import json
import re
import shutil
import uuid
from pathlib import Path

def root_dir():
    from model_catalog import model_dir
    return model_dir() / "third-party"

def validate_manifest(doc):
    if not isinstance(doc, dict): raise ValueError("Manifest must be object")
    name=doc.get("id")
    if not isinstance(name,str) or not re.fullmatch(r"[a-z][a-z0-9_-]{2,63}",name):
        raise ValueError("Invalid model id")
    if doc.get("adapter")!="onnx-alpha-v1":
        raise ValueError("Unsupported adapter; require onnx-alpha-v1")
    size=doc.get("input_size")
    if type(size)!=int or size<32 or size>2048 or size%32:
        raise ValueError("Input size must be 32..2048 and divisible by 32")
    if doc.get("normalization") not in ("zero-one","imagenet"):
        raise ValueError("Unsupported normalization")
    if doc.get("output") not in ("logit","probability"):
        raise ValueError("Unsupported output type")
    if not isinstance(doc.get("license"),str) or not doc["license"].strip():
        raise ValueError("License declaration required")
    return {k:doc[k] for k in ("id","adapter","input_size","normalization","output","license")}

def install_local(manifest, model_file):
    import onnx
    spec=validate_manifest(manifest)
    src=Path(model_file).expanduser().resolve()
    if not src.is_file() or src.suffix!=".onnx" or not 1024<=src.stat().st_size<=2*1024**3:
        raise ValueError("Invalid ONNX file")
    graph=onnx.load(str(src),load_external_data=False)
    onnx.checker.check_model(graph)
    # This adapter does not support arbitrary plugin scripts or execution of Python code.
    if len(graph.graph.input)!=1 or len(graph.graph.output)<1:
        raise ValueError("Expected one input and at least one output")
    dims=graph.graph.input[0].type.tensor_type.shape.dim
    if len(dims)!=4 or dims[1].dim_value not in (0,3):
        raise ValueError("Expected NCHW RGB input")
    dst=root_dir()/spec["id"]
    if dst.exists():raise ValueError("Model already installed")
    dst.mkdir(parents=True,exist_ok=False)
    try:
        shutil.copyfile(src,dst/"model.onnx")
        (dst/"manifest.json").write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding="utf-8")
    except BaseException:
        shutil.rmtree(dst)
        raise
    return {"id":spec["id"],"path":str(dst)}

def installed():
    result={}
    for manifest in root_dir().glob("*/manifest.json"):
        try:
            doc=validate_manifest(json.loads(manifest.read_text(encoding="utf-8")))
            if manifest.parent.name==doc["id"] and (manifest.parent/"model.onnx").is_file():
                result[doc["id"]]=doc
        except (OSError,ValueError,KeyError,TypeError):
            continue
    return result

def infer_mask(model_id,img):
    import numpy as np
    import onnxruntime as ort
    from PIL import Image
    models=installed()
    if model_id not in models:raise ValueError("Unknown third-party model")
    spec=models[model_id]
    size=spec["input_size"]
    rgb=img.convert("RGB").resize((size,size),Image.Resampling.LANCZOS)
    arr=np.asarray(rgb,dtype=np.float32)/255.0
    if spec["normalization"]=="imagenet":
        arr=(arr-np.array([.485,.456,.406],dtype=np.float32))/np.array([.229,.224,.225],dtype=np.float32)
    arr=np.transpose(arr,(2,0,1))[None]
    session=ort.InferenceSession(str(root_dir()/model_id/"model.onnx"),providers=["CPUExecutionProvider"])
    out=np.asarray(session.run(None,{session.get_inputs()[0].name:arr})[0]).squeeze()
    if out.ndim!=2:raise ValueError("Output must be one-channel alpha mask")
    if spec["output"]=="logit":out=1/(1+np.exp(-np.clip(out,-40,40)))
    mask=Image.fromarray(np.uint8(np.clip(out,0,1)*255),"L").resize(img.size,Image.Resampling.BILINEAR)
    rgba=img.convert("RGBA");rgba.putalpha(mask);return rgba
