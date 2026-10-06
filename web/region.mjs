export const MIN_REGION=16;

export function normalizeBox(a,b,width,height){
 if(![a?.x,a?.y,b?.x,b?.y,width,height].every(Number.isFinite))return null;
 const x=Math.max(0,Math.min(width,Math.floor(Math.min(a.x,b.x))));
 const y=Math.max(0,Math.min(height,Math.floor(Math.min(a.y,b.y))));
 const right=Math.max(0,Math.min(width,Math.ceil(Math.max(a.x,b.x))));
 const bottom=Math.max(0,Math.min(height,Math.ceil(Math.max(a.y,b.y))));
 const w=right-x,h=bottom-y;
 return w<MIN_REGION||h<MIN_REGION?null:{x,y,w,h};
}
