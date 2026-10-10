export const MIN_REGION=16;

export function normalizeBox(a,b,width,height){
 if(![a?.x,a?.y,b?.x,b?.y,width,height].every(Number.isFinite))return null;
 if(![width,height].every(value=>Number.isSafeInteger(value)&&value>0))return null;
 const x=Math.max(0,Math.min(width,Math.floor(Math.min(a.x,b.x))));
 const y=Math.max(0,Math.min(height,Math.floor(Math.min(a.y,b.y))));
 const right=Math.max(0,Math.min(width,Math.ceil(Math.max(a.x,b.x))));
 const bottom=Math.max(0,Math.min(height,Math.ceil(Math.max(a.y,b.y))));
 const w=right-x,h=bottom-y;
 return w<MIN_REGION||h<MIN_REGION?null:{x,y,w,h};
}

// Validate at the worker boundary as well as in the selection dialog.
export function validateRegion(region,width,height){
 if(![width,height].every(value=>Number.isSafeInteger(value)&&value>0)||
    ![region?.x,region?.y,region?.w,region?.h].every(Number.isSafeInteger)||
    region.x<0||region.y<0||region.w<MIN_REGION||region.h<MIN_REGION||
    region.x+region.w>width||region.y+region.h>height){
  throw Error('选区必须位于原图内，且至少为 16 × 16 像素');
 }
 return {x:region.x,y:region.y,w:region.w,h:region.h};
}
