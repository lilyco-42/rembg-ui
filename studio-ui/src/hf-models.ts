export type HubModel={id:string;downloads:number;lastModified?:string;gated?:boolean;tags?:string[];siblings?:{rfilename:string}[]};
export type HubEntry={id:string;downloads:number;license:string;updated:string;onnx:string[];gated:boolean};
const searchTerms=['background-removal','u2net','rembg'];
export async function searchHubModels(signal?:AbortSignal):Promise<HubEntry[]>{
 const groups=await Promise.allSettled(searchTerms.map(async term=>{
  const qs=new URLSearchParams({search:term,sort:'downloads',direction:'-1',limit:'35',full:'true'});
  const result=await fetch('https://huggingface.co/api/models?'+qs,{signal});
  if(!result.ok)throw Error('Hugging Face HTTP '+result.status);
  return await result.json() as HubModel[];
 }));
 const successful=groups.filter((item):item is PromiseFulfilledResult<HubModel[]>=>item.status==='fulfilled');
 if(!successful.length)throw Error('Hugging Face API unavailable on all search endpoints');
 const seen=new Map<string,HubEntry>();
 for(const model of successful.flatMap(item=>item.value)){
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

/** Manually audited U2Net-family repositories. A filename alone does not prove compatibility. */
const compatibleRepos=new Set(['BritishWerewolf/U-2-Netp','BritishWerewolf/U-2-Net','BritishWerewolf/U-2-Net-Human-Seg','tomjackson2023/rembg','jellybox/u2net','jellybox/u2net-human-seg']);
export function isCompatibleHubModel(repo:string,filename:string):boolean{
 if(!compatibleRepos.has(repo))return false;
 if(repo==='tomjackson2023/rembg')return /^(u2netp|u2net|u2net_human_seg|silueta)\.onnx$/i.test(filename);
 return /^([\w-]+\/)?(model|u2net|u2netp|u2net-human-seg_320)\.onnx$/i.test(filename);
}
