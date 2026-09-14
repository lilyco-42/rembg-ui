const files=document.querySelector('#files'),run=document.querySelector('#run'),status=document.querySelector('#status'),results=document.querySelector('#results');
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
files.onchange=()=>{run.disabled=!files.files.length;};
if(!('Worker' in window)||!('OffscreenCanvas' in window)||!('createImageBitmap' in window)){
 files.disabled=true;
 status.textContent='此浏览器不支持所需的图片处理功能，请使用新版 Chrome、Edge 或 Firefox。';
}
run.onclick=async()=>{
 if(busy)return;
 const selected=[...files.files];
 if(selected.length>10){status.textContent='请每批选择不超过 10 张图片';return;}
 busy=true;run.disabled=true;files.disabled=true;document.querySelector('#size').disabled=true;
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
   pending.replaceWith(imagePreview(output.transparent,'抠图结果 · 透明底稿',file.name));
   const productDetails=document.createElement('details'),summary=document.createElement('summary');
   summary.textContent='查看交付商品图';productDetails.append(summary,imagePreview(output.product,'交付商品图',file.name));row.append(productDetails);
   for(const [label,blob,suffix]of [['下载商品图',output.product,'product'],['下载透明底稿',output.transparent,'cutout']]){
    const a=document.createElement('a');a.className='download';a.textContent=label;a.href=URL.createObjectURL(blob);urls.push(a.href);a.download=`${suffix}_${file.name.replace(/\.[^.]+$/,'')}_${i+1}.png`;row.append(a);
   }complete++;
  }catch(error){row.querySelector('.comparison > p')?.remove();const p=document.createElement('p');p.textContent=`失败：${error.message}`;row.append(p);}
 }}finally{busy=false;run.disabled=false;files.disabled=false;document.querySelector('#size').disabled=false;status.textContent=`已完成 ${complete} / ${selected.length} 张；结果仅保留在本页，请下载。`;}
};
