import {validateImageFile} from './image-limits.mjs?v=region-1';
import {normalizeBox} from './region.mjs?v=region-1';

export async function selectRegion(item){
 let original,canvas,dialog;
 try{
  await validateImageFile(item.file);
  original=await createImageBitmap(item.file);
  dialog=document.createElement('dialog');dialog.className='editor';
  dialog.innerHTML='<h2></h2><p>在图上拖出要抠的区域，只处理框内主体。</p><label>抠图方式 <select aria-label="抠图方式"><option value="replace">只保留框内主体</option><option value="add">添加到当前结果</option></select></label><div class="edit-surface"><canvas aria-label="局部抠图画布"></canvas></div><p role="status"></p><button type="button" data-cut disabled>在框内抠图</button><button type="button" data-cancel>取消</button>';
  dialog.querySelector('h2').textContent=`局部抠图 · ${item.source}`;
  canvas=dialog.querySelector('canvas');canvas.width=original.width;canvas.height=original.height;
  const ctx=canvas.getContext('2d'),mode=dialog.querySelector('select'),cut=dialog.querySelector('[data-cut]'),cancel=dialog.querySelector('[data-cancel]'),message=dialog.querySelector('[role=status]');
  const add=mode.querySelector('option[value="add"]');add.disabled=item.status!=='done';
  let box=null,active=null;
  const controls=()=>{cut.disabled=!box;mode.disabled=Boolean(active);};
  const repaint=()=>{
   ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(original,0,0);
   if(box){
    ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.save();ctx.beginPath();ctx.rect(box.x,box.y,box.w,box.h);ctx.clip();ctx.drawImage(original,0,0);ctx.restore();
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(box.x+1,box.y+1,Math.max(0,box.w-2),Math.max(0,box.h-2));
   }
   controls();
  };
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(canvas.width,(e.clientX-r.left)*canvas.width/r.width)),y:Math.max(0,Math.min(canvas.height,(e.clientY-r.top)*canvas.height/r.height))};};
  const update=e=>{box=normalizeBox(active.start,point(e),canvas.width,canvas.height);message.textContent=box?'':'区域太小，请至少框选 16 × 16 像素';repaint();};
  canvas.onpointerdown=e=>{if(active)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);active={pointer:e.pointerId,start:point(e)};box=null;message.textContent='';update(e);};
  canvas.onpointermove=e=>{if(!active||active.pointer!==e.pointerId)return;update(e);};
  canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=e=>{
   if(!active||active.pointer!==e.pointerId)return;
   if(e.type==='pointerup')update(e);
   active=null;controls();
  };
  document.body.append(dialog);dialog.showModal();repaint();
  return await new Promise(resolve=>{
   cut.onclick=()=>{if(box)resolve({region:box,mode:mode.value});};
   cancel.onclick=()=>resolve(null);
   dialog.oncancel=e=>{e.preventDefault();resolve(null);};
  });
 }finally{original?.close();if(canvas)canvas.width=canvas.height=1;dialog?.remove();}
}
