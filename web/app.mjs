import {createZip} from './zip.mjs';
import {outputName,deliveryManifest} from './delivery.mjs';
const files=document.querySelector('#files'),run=document.querySelector('#run'),status=document.querySelector('#status'),results=document.querySelector('#results');
const exportBatch=document.querySelector('#exportBatch'),reviewedOnly=document.querySelector('#reviewedOnly'),deliveryStatus=document.querySelector('#deliveryStatus');
let batch=[],batchSize=1200,exporting=false;
function updateDelivery() {
 const done=batch.filter(item=>item.status==='done');
 const reviewed=done.filter(item=>item.reviewed);
 exportBatch.disabled=busy||exporting||!(reviewedOnly.checked?reviewed.length:done.length);
 deliveryStatus.textContent=`完成 ${done.length} / ${batch.length} 张 · 已确认 ${reviewed.length} 张。交付包含商品图、透明底稿及全部任务清单。`;
}
reviewedOnly.onchange=updateDelivery;
exportBatch.onclick=async()=>{
 if(busy||exporting||exportBatch.disabled)return;
 exporting=true;run.disabled=true;reviewedOnly.disabled=true;updateDelivery();
 try{
  const manifest=deliveryManifest(batch,batchSize,reviewedOnly.checked),entries=[];
  for(const [i,item]of batch.entries())if(manifest.items[i].exported){
   entries.push({name:manifest.items[i].product,bytes:new Uint8Array(await item.output.product.arrayBuffer())});
   entries.push({name:manifest.items[i].cutout,bytes:new Uint8Array(await item.output.transparent.arrayBuffer())});
  }
  entries.push({name:'delivery-manifest.json',bytes:new TextEncoder().encode(JSON.stringify(manifest,null,2))});
  const url=URL.createObjectURL(createZip(entries));
  const a=document.createElement('a');a.href=url;a.download='rembg-delivery.zip';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(error){status.textContent=`打包失败：${error.message}，可先逐图下载。`;}
 finally{exporting=false;run.disabled=!files.files.length;reviewedOnly.disabled=false;updateDelivery();}
};
let worker,request=0,busy=false;
const urls=[];
function imagePreview(blob, label, filename) {
 const figure=document.createElement('figure');
 const caption=document.createElement('figcaption');caption.textContent=label;
 const image=document.createElement('img');image.alt=`${filename} · ${label}`;
 image.src=URL.createObjectURL(blob);urls.push(image.src);
 figure.append(caption,image);
 return figure;
}
function infer(bitmap,size){
 return new Promise((resolve,reject)=>{
  worker??=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
  const id=++request;
  const fail=message=>{clearTimeout(timer);worker.terminate();worker=null;reject(Error(message));};
  const timer=setTimeout(()=>fail('处理超过 3 分钟，请缩小图片或换设备重试'),180000);
  worker.onmessage=({data})=>{if(data.id!==id)return;if(data.status){status.textContent=data.status;return;}clearTimeout(timer);data.error?reject(Error(data.error)):resolve(data);};
  worker.onerror=()=>fail('WASM 加载失败，请检查网络或使用新版浏览器后重试');
  worker.postMessage({id,bitmap,size},[bitmap]);
 });
}
files.onchange=()=>{run.disabled=exporting||!files.files.length;};
if(!('Worker' in window)||!('OffscreenCanvas' in window)||!('createImageBitmap' in window)){
 files.disabled=true;
 status.textContent='此浏览器不支持所需的图片处理功能，请使用新版 Chrome、Edge 或 Firefox。';
}
run.onclick=async()=>{
 if(busy||exporting)return;
 const selected=[...files.files];
 if(selected.length>10){status.textContent='请每批选择不超过 10 张图片';return;}
 busy=true;run.disabled=true;files.disabled=true;document.querySelector('#size').disabled=true;
 batch=selected.map(file=>({source:file.name,status:'pending',reviewed:false}));
 batchSize=Number(document.querySelector('#size').value);updateDelivery();
 for(const url of urls)URL.revokeObjectURL(url);urls.length=0;results.replaceChildren();
 let complete=0;
 try{for(const [i,file]of selected.entries()){
  const row=document.createElement('section'),title=document.createElement('h2');title.textContent=file.name;row.append(title);results.append(row);
  try{
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>25*1024*1024)throw Error('仅支持 25 MB 内的 PNG/JPEG/WebP');
   const bitmap=await createImageBitmap(file);
   if(bitmap.width*bitmap.height>16e6){bitmap.close();throw Error('图片超过 1600 万像素，请先缩小');}
   const comparison=document.createElement('div');comparison.className='comparison';
   comparison.append(imagePreview(file,'原图',file.name));
   const pending=document.createElement('p');pending.textContent='正在生成抠图结果…';comparison.append(pending);row.append(comparison);
   status.textContent=`处理 ${i+1} / ${selected.length}`;
   const output=await infer(bitmap,Number(document.querySelector('#size').value));
   batch[i].status='done';batch[i].output=output;
   pending.replaceWith(imagePreview(output.transparent,'抠图结果 · 透明底稿',file.name));
   const productDetails=document.createElement('details'),summary=document.createElement('summary');
   summary.textContent='查看交付商品图';productDetails.append(summary,imagePreview(output.product,'交付商品图',file.name));row.append(productDetails);
   for(const [label,blob,suffix]of [['下载商品图',output.product,'product'],['下载透明底稿',output.transparent,'cutout']]){
    const a=document.createElement('a');a.className='download';a.textContent=label;a.href=URL.createObjectURL(blob);urls.push(a.href);a.download=outputName(file.name,i,suffix);row.append(a);
   }
   const reviewLabel=document.createElement('label'),review=document.createElement('input');review.type='checkbox';review.setAttribute('aria-label',`确认图片 ${file.name}`);
   const item=batch[i];review.onchange=()=>{item.reviewed=review.checked;updateDelivery();};
   reviewLabel.append(review,document.createTextNode('已检查边缘，可以交付'));row.append(document.createElement('br'),reviewLabel);
   complete++;
  }catch(error){batch[i].status='error';batch[i].error=error.message;row.querySelector('.comparison > p')?.remove();const p=document.createElement('p');p.textContent=`失败：${error.message}`;row.append(p);}
 }}finally{busy=false;run.disabled=false;files.disabled=false;document.querySelector('#size').disabled=false;status.textContent=`已完成 ${complete} / ${selected.length} 张；结果仅保留在本页，请下载。`;updateDelivery();}
};
