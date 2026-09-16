import {composeProduct} from './composition.mjs?v=editor-2';
import * as ort from './vendor/ort.wasm.min.mjs';
import {normalize,maskPixels} from './pixels.mjs?v=editor-2';
ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths=new URL('./vendor/',import.meta.url).href;
let session;
self.onmessage=async ({data})=>{
 const {id,bitmap,size}=data;
 let input, outputs,small,cutout;
 try {
  self.postMessage({id,status:session?'正在抠图…':'首次加载 WASM 与模型，请稍候…'});
  session ??= await ort.InferenceSession.create(new URL('./models/u2netp.onnx',import.meta.url).href,{executionProviders:['wasm']});
  small=new OffscreenCanvas(320,320);const ctx=small.getContext('2d');
  ctx.drawImage(bitmap,0,0,320,320);
  input=new ort.Tensor('float32',normalize(ctx.getImageData(0,0,320,320).data),[1,3,320,320]);
  outputs=await session.run({[session.inputNames[0]]:input});
  const mask=outputs[session.outputNames[0]];
  ctx.putImageData(new ImageData(maskPixels(mask.data.subarray(0,320*320)),320,320),0,0);
  cutout=new OffscreenCanvas(bitmap.width,bitmap.height);const cc=cutout.getContext('2d');
  cc.drawImage(bitmap,0,0);cc.globalCompositeOperation='destination-in';cc.drawImage(small,0,0,bitmap.width,bitmap.height);
  const transparent=await cutout.convertToBlob({type:'image/png'});
  const product=size?await composeProduct(cutout,size):transparent;
  cutout.width=cutout.height=1;
  self.postMessage({id,product,transparent});
 }catch(error){self.postMessage({id,error:error.message||String(error)});}finally{
  if(small)small.width=small.height=1;
  if(cutout)cutout.width=cutout.height=1;
  input?.dispose();
  for(const output of Object.values(outputs||{}))output.dispose();
  bitmap.close();
 }
};
