import {validateImageFile} from './image-limits.mjs?v=editor-2';
import {editCutout} from './editor.mjs?v=editor-2';
import {replaceOutput,setReviewed,isReviewed} from './revisions.mjs?v=editor-2';
import {exportProjectArchive,importProjectArchive} from './project-archive.mjs?v=editor-2';
import {createZip} from './zip.mjs?v=editor-2';
import {outputName,deliveryManifest} from './delivery.mjs?v=editor-2';
import {openProjectStore,PROJECT_SCHEMA_VERSION} from './project-store.mjs?v=editor-2';
import {PRESETS} from './presets.mjs?v=editor-2';
const $=id=>document.getElementById(id);
const files=$('files'),run=$('run'),status=$('status'),results=$('results');
const exportBatch=$('exportBatch'),reviewedOnly=$('reviewedOnly'),deliveryStatus=$('deliveryStatus');
const size=$('size'),saveStatus=$('saveStatus'),clearBatch=$('clearBatch');
let projectExport,projectImport,projectInput;
size.replaceChildren(...PRESETS.filter(preset=>preset.background==='white').map(preset=>{
 const option=document.createElement('option');option.value=String(preset.width);option.textContent=`${preset.label}，${preset.marginPercent}% 留白`;return option;
}));
const originalSize=document.createElement('option');originalSize.value='0';originalSize.textContent='原尺寸透明 PNG';size.append(originalSize);
let batch=[],batchSize=1200,exporting=false,busy=false,restoring=true,conflict=false,store=null;
let worker,request=0,saveRequest=0;
const urls=[];
const supported='Worker' in window&&'OffscreenCanvas' in window&&'createImageBitmap' in window;
function addCommercialNotice(){
 const host=files.closest('section');if(!host)return;
 const box=document.createElement('aside');box.className='commercial-notice';box.setAttribute('aria-label','商业试用');
 box.style.cssText='background:#fff;border:1px solid #dbe1da;border-radius:16px;padding:16px 24px;margin:22px 0';
 box.innerHTML='<strong>商业试用</strong><p>浏览器演示免费；桌面版与 Android 原生端可用积分兑换授权。第一轮测试价：创作者版 ¥29/月，小团队版 ¥99/月。</p><p><a href="https://lain42.top/sub/buy.html" target="_blank" rel="noopener noreferrer">充值积分 / 购买授权 →</a></p><small>USDT 只用于充值积分，图片仍在你的设备本地处理；付款、授权签发和退款以服务端页面为准。</small>';
 host.before(box);
}
addCommercialNotice();
function addProjectControls(){
 const host=clearBatch.parentElement;if(!host)return;
 const bar=document.createElement('div');bar.style.cssText='display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px';
 projectExport=document.createElement('button');projectExport.textContent='导出项目备份';
 projectImport=document.createElement('label');projectImport.textContent='导入项目备份';projectImport.style.cssText='background:#e7eee8;color:#23694e;border-radius:8px;padding:10px 18px;cursor:pointer';
 projectInput=document.createElement('input');projectInput.type='file';projectInput.accept='.rembg.zip,application/zip';projectInput.hidden=true;projectImport.append(projectInput);bar.append(projectExport,projectImport);host.after(bar);
 projectExport.onclick=async()=>{
  if(projectExport.disabled)return;exporting=true;updateControls();
  try{const snapshot={schemaVersion:PROJECT_SCHEMA_VERSION,size:batchSize,reviewedOnly:reviewedOnly.checked,items:batch};const archive=await exportProjectArchive(snapshot);const url=URL.createObjectURL(archive),a=document.createElement('a');a.href=url;a.download='rembg-project.rembg.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status.textContent='项目备份已导出，可迁移到同源的 Rembg Studio。';}
  catch(error){status.textContent=`项目备份失败：${error.message}`;}
  finally{exporting=false;updateControls();}
 };
 projectInput.onchange=async()=>{
  const file=projectInput.files?.[0];projectInput.value='';if(!file||projectImport.getAttribute('aria-disabled')==='true')return;
  if(batch.length&&!window.confirm('导入项目会替换当前批次；请先导出当前项目备份。继续吗？'))return;
  const previous={batch,batchSize,reviewedOnly:reviewedOnly.checked};busy=true;restoring=true;updateControls();
  try{const snapshot=await importProjectArchive(file);batch=snapshot.items;batchSize=snapshot.size;size.value=String(batchSize);reviewedOnly.checked=snapshot.reviewedOnly;restoring=false;render();const saved=await save();if(!saved)throw Error('项目已读取，但未能保存到当前浏览器');status.textContent=`项目备份已导入，恢复 ${batch.length} 张图片；未完成项可继续处理`;}
  catch(error){batch=previous.batch;batchSize=previous.batchSize;size.value=String(batchSize);reviewedOnly.checked=previous.reviewedOnly;restoring=false;render();status.textContent=`项目导入失败：${error.message}。当前批次已保留`;}
  finally{busy=false;restoring=false;render();}
 };
}
addProjectControls();
function updateControls(){
 const done=batch.filter(item=>item.status==='done'),reviewed=done.filter(isReviewed);
 const locked=busy||exporting||restoring;
 run.disabled=locked||conflict||!supported||!batch.some(item=>item.status!=='done');
 files.disabled=locked||conflict||!supported;
 size.disabled=locked||batch.length>0;
 clearBatch.disabled=locked||conflict||!batch.length;
 if(projectExport)projectExport.disabled=locked||conflict||!batch.length;
 if(projectImport){const importLocked=locked||conflict;projectImport.setAttribute('aria-disabled',String(importLocked));projectInput.disabled=importLocked;projectImport.style.opacity=importLocked?'.5':'1';}
 reviewedOnly.disabled=locked||conflict;
 exportBatch.disabled=locked||!(reviewedOnly.checked?reviewed.length:done.length);
 for(const check of results.querySelectorAll('input[type=checkbox],button'))check.disabled=locked||conflict;
 deliveryStatus.textContent=`完成 ${done.length} / ${batch.length} 张 · 已确认 ${reviewed.length} 张。交付包含商品图、透明底稿及全部任务清单。`;
}
async function save(){
 if(restoring||conflict)return false;
 if(!store)return true;
 const ticket=++saveRequest;
 saveStatus.textContent='正在保存批次…';
 try{
  await store.save({schemaVersion:PROJECT_SCHEMA_VERSION,size:batchSize,reviewedOnly:reviewedOnly.checked,items:batch});
  if(ticket===saveRequest)saveStatus.textContent='批次已保存，可在此浏览器刷新恢复';
  return true;
 }catch(error){
  if(error.name==='ConflictError')conflict=true;
  saveStatus.textContent=conflict?'另一个页面已更新批次。请下载本页结果后刷新，避免覆盖。':`未保存：${error.message}。请先下载结果。`;
  return false;
 }finally{updateControls();}
}
function imagePreview(blob,label,filename){
 const figure=document.createElement('figure'),caption=document.createElement('figcaption'),image=document.createElement('img');
 image.loading='lazy';image.decoding='async';caption.textContent=label;image.alt=`${filename} · ${label}`;
 image.src=URL.createObjectURL(blob);urls.push(image.src);figure.append(caption,image);return figure;
}
function render(){
 for(const url of urls)URL.revokeObjectURL(url);urls.length=0;results.replaceChildren();
 for(const [i,item]of batch.entries()){
  const row=document.createElement('section'),title=document.createElement('h2');title.textContent=item.source;row.append(title);
  const comparison=document.createElement('div');comparison.className='comparison';if(!item.invalidSource)comparison.append(imagePreview(item.file,'原图',item.source));row.append(comparison);
  if(item.status==='done'){
   comparison.append(imagePreview(item.output.transparent,'抠图结果 · 透明底稿',item.source));
   const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='查看交付商品图';details.append(summary,imagePreview(item.output.product,'交付商品图',item.source));row.append(details);
   for(const [label,blob,type]of [['下载商品图',item.output.product,'product'],['下载透明底稿',item.output.transparent,'cutout']]){
    const a=document.createElement('a');a.className='download';a.textContent=label;a.href=URL.createObjectURL(blob);urls.push(a.href);a.download=outputName(item.source,i,type);row.append(a);
   }
   const edit=document.createElement('button');edit.textContent='修边';edit.onclick=async()=>{
    if(busy||exporting||restoring||conflict)return;busy=true;updateControls();
    try{const output=await editCutout(item,batchSize);if(output){replaceOutput(item,output);render();await save();status.textContent='修边已应用，请重新检查并确认交付。';}}
    catch(error){status.textContent=`修边失败：${error.message}`;}finally{busy=false;render();}
   };row.append(edit);
   const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=isReviewed(item);check.setAttribute('aria-label',`确认图片 ${item.source}`);
   check.onchange=()=>{setReviewed(item,check.checked);updateControls();void save();};label.append(check,document.createTextNode('已检查边缘，可以交付'));row.append(document.createElement('br'),label);
  }else{
   const p=document.createElement('p');p.textContent=item.status==='error'?`失败：${item.error}`:item.status==='processing'?'正在处理…':'待处理';comparison.append(p);
  }
  results.append(row);
 }
 updateControls();
}
function infer(bitmap){
 return new Promise((resolve,reject)=>{
  try{worker??=new Worker(new URL('./worker.mjs?v=editor-2',import.meta.url),{type:'module'});}catch(error){bitmap.close();reject(error);return;}
  const id=++request;
  const fail=message=>{clearTimeout(timer);worker?.terminate();worker=null;reject(Error(message));};
  const timer=setTimeout(()=>fail('处理超过 3 分钟，请缩小图片或换设备重试'),180000);
  worker.onmessage=({data})=>{if(data.id!==id)return;if(data.status){status.textContent=data.status;return;}clearTimeout(timer);data.error?reject(Error(data.error)):resolve({product:data.product,transparent:data.transparent});};
  worker.onerror=()=>fail('WASM 加载失败，请检查网络或使用新版浏览器后重试');
  try{worker.postMessage({id,bitmap,size:batchSize},[bitmap]);}catch(error){bitmap.close();fail(error.message);}
 });
}
files.onchange=async()=>{
 if(restoring||busy||exporting||conflict)return;
 const added=[...files.files];files.value='';
 if(batch.length+added.length>10){status.textContent='每批最多 10 张，请先下载并清空当前批次。';return;}
 if(added.some(file=>!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>25*1024*1024)){
  status.textContent='本次未添加：仅支持 25 MB 内的 PNG/JPEG/WebP。';return;
 }
 busy=true;updateControls();
 try{for(const file of added)await validateImageFile(file);}
 catch(error){status.textContent=`本次未添加：${error.message}`;return;}
 finally{busy=false;updateControls();}
 if(!batch.length)batchSize=Number(size.value);
 for(const file of added)batch.push({id:crypto.randomUUID(),source:file.name,file,status:'pending',reviewed:false});
 render();await save();
};
reviewedOnly.onchange=()=>{updateControls();void save();};
clearBatch.onclick=async()=>{
 if(busy||exporting||restoring||conflict)return;
 const previous=batch;busy=true;batch=[];render();
 const cleared=await save();
 if(!cleared)batch=previous;
 busy=false;render();
 status.textContent=cleared?'批次已清空，可以选择新的交付规格和图片。':'未能清空保存内容，已保留当前批次，请先下载结果。';
};
run.onclick=async()=>{
 if(run.disabled)return;
 busy=true;updateControls();
 try{
  for(const item of batch){
   if(item.status==='done')continue;
   item.status='processing';item.reviewed=false;delete item.error;render();await save();
   if(conflict){item.status='pending';break;}
   try{
    await validateImageFile(item.file);
    const bitmap=await createImageBitmap(item.file);
    if(bitmap.width*bitmap.height>16e6){bitmap.close();throw Error('图片超过 1600 万像素，请先缩小');}
    replaceOutput(item,await infer(bitmap));
   }catch(error){item.status='error';item.error=error.message;delete item.output;}
   render();await save();if(conflict)break;
  }
 }finally{busy=false;render();status.textContent='处理结束。已完成项目会保留，继续处理仅运行待处理或失败项。';}
};
exportBatch.onclick=async()=>{
 if(exportBatch.disabled)return;
 exporting=true;updateControls();
 try{
  const manifest=deliveryManifest(batch,batchSize,reviewedOnly.checked),entries=[];
  const total=batch.reduce((sum,item,i)=>sum+(manifest.items[i].exported?item.output.product.size+item.output.transparent.size:0),0);
  if(total>64*1024*1024)throw Error('此批交付超过 64 MB，请分批或逐图下载');
  for(const [i,item]of batch.entries())if(manifest.items[i].exported){
   entries.push({name:manifest.items[i].product,bytes:new Uint8Array(await item.output.product.arrayBuffer())});
   entries.push({name:manifest.items[i].cutout,bytes:new Uint8Array(await item.output.transparent.arrayBuffer())});
  }
  entries.push({name:'delivery-manifest.json',bytes:new TextEncoder().encode(JSON.stringify(manifest,null,2))});
  const url=URL.createObjectURL(createZip(entries)),a=document.createElement('a');a.href=url;a.download='rembg-delivery.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(error){status.textContent=`打包失败：${error.message}。`;}
 finally{exporting=false;updateControls();}
};
updateControls();
try{
 store=await openProjectStore();const snapshot=await store.load();
 if(snapshot){batch=snapshot.items;for(const item of batch){try{await validateImageFile(item.file);}catch(error){item.invalidSource=true;item.status='error';item.reviewed=false;item.error=error.message;delete item.output;}}batchSize=snapshot.size;size.value=String(batchSize);reviewedOnly.checked=snapshot.reviewedOnly;saveStatus.textContent=`已恢复 ${batch.length} 张图片，未完成项可继续处理`;}
 else saveStatus.textContent='批次会保存在此浏览器';
}catch(error){store=null;saveStatus.textContent=`本地保存不可用：${error.message}。请及时下载结果。`;}
finally{restoring=false;render();if(!supported)status.textContent='此浏览器不支持所需功能，请使用新版 Chrome、Edge 或 Firefox。';}
