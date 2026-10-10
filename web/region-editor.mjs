import {validateImageFile} from './image-limits.mjs?v=region-2';
import {normalizeBox,validateRegion} from './region.mjs?v=region-2';

export async function selectRegion(item){
 let original,canvas,dialog;
 try{
  await validateImageFile(item.file);
  original=await createImageBitmap(item.file);
  dialog=document.createElement('dialog');dialog.className='editor region-editor';
  dialog.setAttribute('aria-labelledby','region-title');
  dialog.innerHTML='<h2 id="region-title"></h2><p>拖动鼠标或手指框选要保留的主体，也可填写原图像素坐标。Enter 开始，Esc 取消。</p><label>抠图方式 <select aria-label="抠图方式"><option value="replace">只保留框内主体</option><option value="add">添加到当前结果</option></select></label><div class="edit-surface"><canvas aria-label="局部抠图画布"></canvas></div><fieldset class="region-coordinates"><legend>选区坐标（原图像素）</legend><label>起点 X <input aria-label="选区起点 X" type="number" min="0" step="1" value="0" data-coordinate="x"></label><label>起点 Y <input aria-label="选区起点 Y" type="number" min="0" step="1" value="0" data-coordinate="y"></label><label>宽度 <input aria-label="选区宽度" type="number" min="16" step="1" value="0" data-coordinate="w"></label><label>高度 <input aria-label="选区高度" type="number" min="16" step="1" value="0" data-coordinate="h"></label></fieldset><p role="status" aria-live="polite"></p><button type="button" data-cut disabled>在框内抠图</button><button type="button" data-reset>清除选区</button><button type="button" data-cancel>取消</button>';
  dialog.querySelector('h2').textContent=`局部抠图 · ${item.source}`;
  canvas=dialog.querySelector('canvas');
  // Preview allocation and display are bounded; selection uses original pixels.
  const scale=Math.min(1,1200/original.width,1200/original.height,
   Math.max(100,window.innerWidth*.9-64)/original.width,
   Math.max(100,window.innerHeight*.4)/original.height);
  canvas.width=Math.max(1,Math.floor(original.width*scale));
  canvas.height=Math.max(1,Math.floor(original.height*scale));
  const ctx=canvas.getContext('2d'),mode=dialog.querySelector('select');
  const cut=dialog.querySelector('[data-cut]'),cancel=dialog.querySelector('[data-cancel]');
  const reset=dialog.querySelector('[data-reset]'),message=dialog.querySelector('[role=status]');
  const coordinates=[...dialog.querySelectorAll('[data-coordinate]')];
  mode.querySelector('option[value="add"]').disabled=item.status!=='done'||!item.output?.transparent;
  let box=null,active=null;
  const controls=()=>{
   cut.disabled=!box||Boolean(active);mode.disabled=Boolean(active);reset.disabled=Boolean(active);
   for(const input of coordinates)input.disabled=Boolean(active);
  };
  const repaint=()=>{
   ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(original,0,0,canvas.width,canvas.height);
   if(box){
    const x=box.x*canvas.width/original.width,y=box.y*canvas.height/original.height;
    const w=box.w*canvas.width/original.width,h=box.h*canvas.height/original.height;
    ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(original,0,0,canvas.width,canvas.height);ctx.restore();
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);
   }
   controls();
  };
  const showBox=()=>{
   for(const input of coordinates)input.value=String(box?.[input.dataset.coordinate]??0);
   message.textContent=box?`已选 ${box.w} × ${box.h} 像素；原图 ${original.width} × ${original.height} 像素。`:'区域太小，请至少框选 16 × 16 像素';
   repaint();
  };
  const point=e=>{
   const r=canvas.getBoundingClientRect();
   return {x:Math.max(0,Math.min(original.width,(e.clientX-r.left)*original.width/r.width)),
    y:Math.max(0,Math.min(original.height,(e.clientY-r.top)*original.height/r.height))};
  };
  const update=e=>{box=normalizeBox(active.start,point(e),original.width,original.height);showBox();};
  canvas.onpointerdown=e=>{
   if(active||e.button!==0)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);
   active={pointer:e.pointerId,start:point(e),previous:box};box=null;update(e);
  };
  canvas.onpointermove=e=>{if(active?.pointer===e.pointerId)update(e);};
  canvas.onpointerup=e=>{
   if(active?.pointer!==e.pointerId)return;update(e);active=null;
   if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
   controls();
  };
  canvas.onpointercancel=canvas.onlostpointercapture=e=>{
   if(active?.pointer!==e.pointerId)return;box=active.previous;active=null;showBox();
  };
  for(const input of coordinates)input.onchange=()=>{
   if(active)return;
   try{
    const values=Object.fromEntries(coordinates.map(field=>[field.dataset.coordinate,field.value===''?NaN:Number(field.value)]));
    box=validateRegion(values,original.width,original.height);message.textContent=`已选 ${box.w} × ${box.h} 像素。`;
   }catch(error){box=null;message.textContent=error.message;}
   repaint();
  };
  reset.onclick=()=>{box=null;showBox();message.textContent='选区已清除，请重新框选。';};
  document.body.append(dialog);dialog.showModal();repaint();
  return await new Promise(resolve=>{
   cut.onclick=()=>{if(box&&!active)resolve({region:box,mode:mode.value});};
   cancel.onclick=()=>resolve(null);
   dialog.oncancel=e=>{e.preventDefault();resolve(null);};
   dialog.onkeydown=e=>{if(e.key==='Enter'&&e.target.tagName!=='BUTTON'&&e.target.tagName!=='SELECT'){e.preventDefault();if(e.target.tagName==='INPUT')e.target.blur();cut.click();}};
  });
 }finally{original?.close();if(canvas)canvas.width=canvas.height=1;dialog?.remove();}
}
