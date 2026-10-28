import {composeProduct} from './composition.mjs?v=region-2';
import * as wasmOrt from './vendor/ort.wasm.min.mjs';
// The WebGPU build must be separate: the bundled wasm-only runtime cannot enable GPU
// just by selecting "webgpu" as an execution provider.
const WEBGPU_RUNTIME = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.webgpu.min.mjs';
const WEBGPU_ASSETS = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
const MODEL_URL = new URL('./models/u2netp.onnx', import.meta.url).href;
let ort = wasmOrt;
let sessionPromise;
let backend = 'wasm';

async function initializeSession() {
  if (self.navigator?.gpu) {
    try {
      const gpuOrt = await import(WEBGPU_RUNTIME);
      gpuOrt.env.wasm.numThreads = 1;
      gpuOrt.env.wasm.wasmPaths = WEBGPU_ASSETS;
      const gpuSession = await gpuOrt.InferenceSession.create(MODEL_URL, {
        executionProviders: ['webgpu'],
      });
      ort = gpuOrt;
      backend = 'webgpu';
      return gpuSession;
    } catch (error) {
      // Unsupported WebGPU browser/driver/operator or offline CDN: keep CPU usable.
      console.warn('[Rembg] WebGPU unavailable; falling back to WASM:', error);
    }
  }
  backend = 'wasm';
  ort = wasmOrt;
  return wasmOrt.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] });
}
import {normalize,maskPixels} from './pixels.mjs?v=region-2';
import {validateRegion} from './region.mjs?v=region-2';
wasmOrt.env.wasm.numThreads=1;
wasmOrt.env.wasm.wasmPaths=new URL('./vendor/',import.meta.url).href;
let session;
self.onmessage=async ({data})=>{
 const {id,bitmap,size,region,mode='replace',base}=data;
 let input, outputs,small,crop,cutout,baseBitmap;
 try {
  if(region)validateRegion(region,bitmap.width,bitmap.height);
  if(!['replace','add'].includes(mode))throw Error('无效的局部抠图方式');
  if(mode==='add'&&(!region||!(base instanceof Blob)))throw Error('添加局部需要已有透明底稿');
  self.postMessage({id,status:session?'正在抠图…':'正在初始化 WebGPU/WASM 与模型…'});
  sessionPromise ??= initializeSession();
  try { session = await sessionPromise; }
  catch (error) { sessionPromise = undefined; throw error; }
  self.postMessage({id,status:backend === 'webgpu' ? 'WebGPU GPU 加速抠图中…' : 'WASM CPU 抠图中…'});
  small=new OffscreenCanvas(320,320);const ctx=small.getContext('2d');
  if(region)ctx.drawImage(bitmap,region.x,region.y,region.w,region.h,0,0,320,320);
  else ctx.drawImage(bitmap,0,0,320,320);
  input=new ort.Tensor('float32',normalize(ctx.getImageData(0,0,320,320).data),[1,3,320,320]);
  outputs=await session.run({[session.inputNames[0]]:input});
  const mask=outputs[session.outputNames[0]];
  ctx.putImageData(new ImageData(maskPixels(mask.data.subarray(0,320*320)),320,320),0,0);
  cutout=new OffscreenCanvas(bitmap.width,bitmap.height);const cc=cutout.getContext('2d');
  if(region){
   crop=new OffscreenCanvas(region.w,region.h);const cropContext=crop.getContext('2d');
   cropContext.drawImage(bitmap,region.x,region.y,region.w,region.h,0,0,region.w,region.h);
   cropContext.globalCompositeOperation='destination-in';cropContext.drawImage(small,0,0,region.w,region.h);
   if(mode==='add'){
    baseBitmap=await createImageBitmap(base);
    if(baseBitmap.width!==bitmap.width||baseBitmap.height!==bitmap.height)throw Error('底稿与原图尺寸不一致');
    cc.drawImage(baseBitmap,0,0);
   }
   cc.globalCompositeOperation='source-over';cc.drawImage(crop,region.x,region.y);
  }else{
   cc.drawImage(bitmap,0,0);cc.globalCompositeOperation='destination-in';cc.drawImage(small,0,0,bitmap.width,bitmap.height);
  }
  const transparent=await cutout.convertToBlob({type:'image/png'});
  const product=size?await composeProduct(cutout,size):transparent;
  cutout.width=cutout.height=1;
  self.postMessage({id,product,transparent});
 }catch(error){self.postMessage({id,error:error.message||String(error)});}finally{
  if(small)small.width=small.height=1;
  if(crop)crop.width=crop.height=1;
  if(cutout)cutout.width=cutout.height=1;
  baseBitmap?.close();
  input?.dispose();
  for(const output of Object.values(outputs||{}))output.dispose();
  bitmap.close();
 }
};
