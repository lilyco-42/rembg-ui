// Shared by inference and manual edits so the product always follows its cutout.
export async function composeProduct(cutout,size){
 if(!size)return cutout.convertToBlob({type:'image/png'});
 const ctx=cutout.getContext('2d');
 let left=cutout.width,top=cutout.height,right=-1,bottom=-1;
 // Scan bounded strips rather than allocating another full-resolution RGBA image.
 for(let y=0;y<cutout.height;y+=64){
  const height=Math.min(64,cutout.height-y),pixels=ctx.getImageData(0,y,cutout.width,height).data;
  for(let dy=0;dy<height;dy++)for(let x=0;x<cutout.width;x++)if(pixels[(dy*cutout.width+x)*4+3]>8){
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y+dy);bottom=Math.max(bottom,y+dy);
  }
 }
 if(right<left)throw Error('未检测到主体，请恢复一部分原图后再保存');
 const w=right-left+1,h=bottom-top+1,scale=size*.8/Math.max(w,h);
 const canvas=new OffscreenCanvas(size,size),c=canvas.getContext('2d');
 try{c.fillStyle='#fff';c.fillRect(0,0,size,size);c.drawImage(cutout,left,top,w,h,(size-w*scale)/2,(size-h*scale)/2,w*scale,h*scale);return await canvas.convertToBlob({type:'image/png'});}
 finally{canvas.width=canvas.height=1;}
}
