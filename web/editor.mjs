import {validateImageFile} from './image-limits.mjs?v=editor-2';
import {composeProduct} from './composition.mjs?v=editor-2';

// History stores brush coordinates, never full-size image snapshots.
export async function editCutout(item,size){
 let original,base,canvas,dialog;
 try{
  await validateImageFile(item.file);
  original=await createImageBitmap(item.file);base=await createImageBitmap(item.output.transparent);
  if(original.width!==base.width||original.height!==base.height)throw Error('底稿与原图尺寸不一致');
  if(base.width*base.height>16e6)throw Error('修边仅支持 1600 万像素以内图片');
  dialog=document.createElement('dialog');dialog.className='editor';
  dialog.innerHTML='<h2>修边 · <span></span></h2><p>拖动擦除残留背景，或恢复原图细节。保存后需要重新确认交付。</p><label>画笔模式 <select aria-label="画笔模式"><option value="erase">擦除</option><option value="restore">恢复原图</option></select></label><label>画笔直径 <input aria-label="画笔直径" type="range" min="2" max="160" value="30"></label><button type="button" data-undo>撤销</button><button type="button" data-redo>重做</button><div class="edit-surface"><canvas aria-label="修边画布"></canvas></div><p role="status"></p><button type="button" data-save>保存修边</button><button type="button" data-cancel>取消</button>';
  dialog.querySelector('span').textContent=item.source;
  canvas=dialog.querySelector('canvas');canvas.width=base.width;canvas.height=base.height;
  const ctx=canvas.getContext('2d'),mode=dialog.querySelector('select'),radius=dialog.querySelector('input');
  const undo=dialog.querySelector('[data-undo]'),redo=dialog.querySelector('[data-redo]'),save=dialog.querySelector('[data-save]'),cancel=dialog.querySelector('[data-cancel]'),message=dialog.querySelector('[role=status]');
  let strokes=[],future=[],active=null,saving=false,points=0;
  const stamp=(stroke,x,y)=>{
   ctx.save();ctx.beginPath();ctx.arc(x,y,stroke.radius,0,Math.PI*2);ctx.clip();
   if(stroke.mode==='erase')ctx.clearRect(x-stroke.radius,y-stroke.radius,stroke.radius*2,stroke.radius*2);
   else{ctx.clearRect(x-stroke.radius,y-stroke.radius,stroke.radius*2,stroke.radius*2);ctx.drawImage(original,0,0);}
   ctx.restore();
  };
  const segment=(stroke,a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/Math.max(1,stroke.radius/3)));for(let i=1;i<=n;i++)stamp(stroke,a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n);};
  const controls=()=>{undo.disabled=saving||!strokes.length;redo.disabled=saving||!future.length;save.disabled=saving||!strokes.length;cancel.disabled=saving;mode.disabled=saving;radius.disabled=saving;};
  const repaint=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(base,0,0);for(const s of strokes){stamp(s,s.points[0].x,s.points[0].y);for(let i=1;i<s.points.length;i++)segment(s,s.points[i-1],s.points[i]);}controls();};
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(canvas.width,(e.clientX-r.left)*canvas.width/r.width)),y:Math.max(0,Math.min(canvas.height,(e.clientY-r.top)*canvas.height/r.height))};};
  canvas.onpointerdown=e=>{if(saving||active)return;if(strokes.length>=200||points>=10000){message.textContent='本次最多 200 笔 / 10000 个采样点，请保存后继续。';return;}e.preventDefault();canvas.setPointerCapture(e.pointerId);active={pointer:e.pointerId,mode:mode.value,radius:Number(radius.value)/2,points:[point(e)]};future=[];strokes.push(active);points++;stamp(active,active.points[0].x,active.points[0].y);controls();};
  canvas.onpointermove=e=>{if(!active||active.pointer!==e.pointerId||points>=10000)return;const next=point(e);segment(active,active.points.at(-1),next);active.points.push(next);points++;};
  canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>{active=null;controls();};
  undo.onclick=()=>{active=null;future.push(strokes.pop());repaint();};
  redo.onclick=()=>{active=null;strokes.push(future.pop());repaint();};
  document.body.append(dialog);dialog.showModal();repaint();
  return await new Promise(resolve=>{
   cancel.onclick=()=>resolve(null);
   dialog.oncancel=e=>{e.preventDefault();if(!saving)resolve(null);};
   save.onclick=async()=>{
    saving=true;active=null;controls();message.textContent='正在生成商品图与底稿…';
    const offscreen=new OffscreenCanvas(canvas.width,canvas.height);
    try{offscreen.getContext('2d').drawImage(canvas,0,0);const transparent=await offscreen.convertToBlob({type:'image/png'});const product=size?await composeProduct(offscreen,size):transparent;resolve({transparent,product});}
    catch(error){message.textContent=error.message;saving=false;controls();}
    finally{offscreen.width=offscreen.height=1;}
   };
  });
 }finally{original?.close();base?.close();if(canvas)canvas.width=canvas.height=1;dialog?.remove();}
}
