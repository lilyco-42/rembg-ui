export type DownloadProgress={received:number;total:number|null};
export function mirrorCandidates(raw:string):string[]{
 const url=new URL(raw.trim());
 if(url.protocol!=="https:")throw Error("HTTPS required");
 const sources=[url.href];
 // Browser fetch cannot read GitHub Release redirects without CORS.
 if(url.hostname==="github.com" && /^\/danielgatis\/rembg\/releases\/download\/v0\.0\.0\/[a-z0-9_-]+\.onnx$/.test(url.pathname)){
  sources.unshift("https://huggingface.co/tomjackson2023/rembg/resolve/main/"+url.pathname.split("/").at(-1));
 }
 if(url.hostname==="huggingface.co" || sources.some(s=>s.startsWith("https://huggingface.co/"))){
  const mirror=new URL(sources.find(s=>s.startsWith("https://huggingface.co/"))!);mirror.hostname="hf-mirror.com";sources.push(mirror.href);
 }
 return sources;
}
export async function probeSource(url:string,timeout=4500):Promise<number>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeout);
 const started=performance.now();
 try{
  const r=await fetch(url,{headers:{Range:"bytes=0-65535"},signal:controller.signal,cache:"no-store"});
  if(!r.ok)throw Error(String(r.status));
  await r.body?.cancel();
  return Math.max(1,performance.now()-started);
 }finally{clearTimeout(timer);controller.abort()}
}
export async function downloadModel(urls:string[],onProgress:(p:DownloadProgress)=>void):Promise<ArrayBuffer>{
 const ranked=await Promise.all(urls.map(async url=>({url,latency:await probeSource(url).catch(()=>Infinity)})));
 ranked.sort((a,b)=>a.latency-b.latency);
 let lastError:unknown;
 for(const {url} of ranked){
  const controller=new AbortController();
  try{
   const r=await fetch(url,{signal:controller.signal});
   if(!r.ok)throw Error(`HTTP ${r.status}`);
   const total=Number(r.headers.get("content-length"))||null;
   if(total&&total>512*1024*1024)throw Error("Model is larger than 512 MiB");
   const reader=r.body?.getReader();
   if(!reader)throw Error("Streaming downloads are not supported");
   const chunks:Uint8Array[]=[];let received=0;
   for(;;){const {done,value}=await reader.read();if(done)break;
    received+=value.byteLength;if(received>512*1024*1024)throw Error("Model is larger than 512 MiB");
    chunks.push(value);onProgress({received,total});
   }
   const output=new Uint8Array(received);let offset=0;
   for(const part of chunks){output.set(part,offset);offset+=part.byteLength}
   return output.buffer;
  }catch(e){lastError=e;controller.abort()}
 }
 throw new Error("All download sources failed (check CORS / URL): "+String(lastError));
}
