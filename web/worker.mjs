import * as ort from './vendor/ort.wasm.min.mjs';
import {normalize,maskPixels} from './pixels.mjs';
ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths=new URL('./vendor/',import.meta.url).href;
let session;
self.onmessage=async ({data})=>{
 const {id,bitmap,size}=data;
 let input, outputs;
 try {
  self.postMessage({id,status:session?'正在抠图…':'首次加载 WASM 与模型，请稍候…'});
  session ??= await ort.InferenceSession.create(new URL('./models/u2netp.onnx',import.meta.url).href,{executionProviders:['wasm']});
  const small=new OffscreenCanvas(320,320),ctx=small.getContext('2d');
  ctx.drawImage(bitmap,0,0,320,320);
  input=new ort.Tensor('float32',normalize(ctx.getImageData(0,0,320,320).data),[1,3,320,320]);
  outputs=await session.run({[session.inputNames[0]]:input});
  const mask=outputs[session.outputNames[0]];
  ctx.putImageData(new ImageData(maskPixels(mask.data.subarray(0,320*320)),320,320),0,0);
  const cutout=new OffscreenCanvas(bitmap.width,bitmap.height),cc=cutout.getContext('2d');
  cc.drawImage(bitmap,0,0);cc.globalCompositeOperation='destination-in';cc.drawImage(small,0,0,bitmap.width,bitmap.height);
  const transparent=await cutout.convertToBlob({type:'image/png'});
  let product=transparent;
  if(size){
   const pixels=cc.getImageData(0,0,cutout.width,cutout.height).data;
   let left=cutout.width,top=cutout.height,right=-1,bottom=-1;
   for(let y=0;y<cutout.height;y++)for(let x=0;x<cutout.width;x++)if(pixels[(y*cutout.width+x)*4+3]>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   if(right<left)throw Error('未检测到主体，请换一张图片');
   const w=right-left+1,h=bottom-top+1,scale=size*.8/Math.max(w,h);
   const canvas=new OffscreenCanvas(size,size),c=canvas.getContext('2d');
   c.fillStyle='#fff';c.fillRect(0,0,size,size);c.drawImage(cutout,left,top,w,h,(size-w*scale)/2,(size-h*scale)/2,w*scale,h*scale);
   product=await canvas.convertToBlob({type:'image/png'});
  }
  self.postMessage({id,product,transparent});
 }catch(error){self.postMessage({id,error:error.message||String(error)});}finally{
  input?.dispose();
  for(const output of Object.values(outputs||{}))output.dispose();
  bitmap.close();
 }
};
