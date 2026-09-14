export function normalize(rgba) {
 const n=rgba.length/4, tensor=new Float32Array(n*3),mean=[.485,.456,.406],std=[.229,.224,.225];
 let max=1e-6;
 for(let i=0;i<n;i++) for(let c=0;c<3;c++) max=Math.max(max,rgba[i*4+c]);
 for(let i=0;i<n;i++) for(let c=0;c<3;c++) tensor[c*n+i]=(rgba[i*4+c]/max-mean[c])/std[c];
 return tensor;
}
export function maskPixels(values) {
 let min=Infinity,max=-Infinity;
 for(const x of values){if(!Number.isFinite(x)) throw Error('模型输出异常'); min=Math.min(min,x);max=Math.max(max,x);}
 const result=new Uint8ClampedArray(values.length*4),range=max-min;
 for(let i=0;i<values.length;i++){result[i*4]=result[i*4+1]=result[i*4+2]=255;result[i*4+3]=range>1e-8?Math.round((values[i]-min)/range*255):0;}
 return result;
}
