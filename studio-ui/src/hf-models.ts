export type HubModel={id:string;downloads:number;lastModified?:string;gated?:boolean;tags?:string[];siblings?:{rfilename:string}[]};
export type HubEntry={id:string;downloads:number;license:string;updated:string;onnx:string[];gated:boolean};
const searchTerms=['background-removal','u2net','rembg'];
export async function searchHubModels(signal?:AbortSignal):Promise<HubEntry[]>{
 const groups=await Promise.all(searchTerms.map(async term=>{
  const qs=new URLSearchParams({search:term,sort:'downloads',direction:'-1',limit:'35',full:'true'});
  const result=await fetch('https://huggingface.co/api/models?'+qs,{signal});
  if(!result.ok)throw Error('Hugging Face HTTP '+result.status);
  return await result.json() as HubModel[];
 }));
 const seen=new Map<string,HubEntry>();
 for(const model of groups.flat()){
  if(!/^[\w.-]+\/[\w.-]+$/.test(model.id)||model.gated)continue;
  const onnx=(model.siblings||[]).map(x=>x.rfilename).filter(n=>n.endsWith('.onnx')&&!n.includes('..')&&!n.startsWith('/')&&n.split('/').length<=5);
  if(!onnx.length)continue;
  const license=model.tags?.find(t=>t.startsWith('license:'))?.slice(8)||'unknown';
  seen.set(model.id,{id:model.id,downloads:model.downloads||0,updated:model.lastModified||'',license,onnx,gated:!!model.gated});
 }
 return [...seen.values()].sort((a,b)=>b.downloads-a.downloads).slice(0,60);
}
export function modelFileURL(repo:string,filename:string){
 if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||filename.includes('..')||filename.startsWith('/'))throw Error('Invalid model path');
 return 'https://huggingface.co/'+repo+'/resolve/main/'+filename.split('/').map(encodeURIComponent).join('/');
}
