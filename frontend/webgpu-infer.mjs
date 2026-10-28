// Actual browser GPU inference, not an ONNX Runtime CPU provider alias.
const CDN='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
let session,ort;
function normalize(rgba){
 const n=rgba.length/4,t=new Float32Array(n*3),mean=[.485,.456,.406],std=[.229,.224,.225];
 let max=1e-6;for(let i=0;i<n;i++)for(let c=0;c<3;c++)max=Math.max(max,rgba[4*i+c]);
 for(let i=0;i<n;i++)for(let c=0;c<3;c++)t[c*n+i]=(rgba[4*i+c]/max-mean[c])/std[c];
 return t;
}
self.onmessage=async({data})=>{
 const {id,bitmap,model}=data;let input,outputs;
 try{
  if(!self.navigator?.gpu)throw Error('当前浏览器没有 WebGPU，无法启用 GPU 推理');
  if(!session){
   ort=await import(CDN+'ort.webgpu.min.mjs');
   ort.env.wasm.wasmPaths=CDN;
   // Explicit webgpu only: never silently present CPU inference as GPU.
   session=await ort.InferenceSession.create(model,{executionProviders:['webgpu']});
  }
  const small=new OffscreenCanvas(320,320),ctx=small.getContext('2d');
  ctx.drawImage(bitmap,0,0,320,320);
  input=new ort.Tensor('float32',normalize(ctx.getImageData(0,0,320,320).data),[1,3,320,320]);
  const started=performance.now();
  outputs=await session.run({[session.inputNames[0]]:input});
  const elapsedMs=Math.round(performance.now()-started);
  const values=outputs[session.outputNames[0]].data;
  const n=320*320;
  if(values.length<n)throw Error('模型输出格式不正确');
  let min=Infinity,max=-Infinity;
  for(let i=0;i<n;i++){const v=values[i];if(!Number.isFinite(v))throw Error('模型输出包含非有限数');min=Math.min(min,v);max=Math.max(max,v);}
  const mask=ctx.createImageData(320,320),range=max-min;
  for(let i=0;i<n;i++){const j=i*4;mask.data[j]=mask.data[j+1]=mask.data[j+2]=255;mask.data[j+3]=range>1e-8?(values[i]-min)/range*255:0;}
  ctx.putImageData(mask,0,0);
  const out=new OffscreenCanvas(bitmap.width,bitmap.height),o=out.getContext('2d');
  o.drawImage(bitmap,0,0);o.globalCompositeOperation='destination-in';o.drawImage(small,0,0,bitmap.width,bitmap.height);
  const blob=await out.convertToBlob({type:'image/png'});
  self.postMessage({id,blob,provider:'webgpu',elapsedMs});
 }catch(error){self.postMessage({id,error:String(error?.message||error)});}
 finally{bitmap?.close();input?.dispose();for(const t of Object.values(outputs||{}))t.dispose();}
};