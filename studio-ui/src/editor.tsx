import {useEffect,useRef,useState} from "react";
import {Download,ImagePlus,Play,RotateCcw,UploadCloud} from "lucide-react";
import {Button} from "./components/ui/button";
import {Card,CardContent} from "./components/ui/card";
import {searchHubModels,modelFileURL,isCompatibleHubModel,type HubEntry} from "./hf-models";
import {recommendedModels} from "./recommended-models";
import {downloadModel,mirrorCandidates} from "./model-sources";
import {translate,type Locale,type MessageKey} from "./i18n/messages";

type Model={installed:boolean;name:string;purpose?:string};
type Props={locale:Locale;models:Record<string,Model>;onManageModels:()=>void};
export function Editor({locale,models,onManageModels}:Props){
 const t=(key:MessageKey)=>translate(locale,key),input=useRef<HTMLInputElement>(null);
 const [file,setFile]=useState<File|null>(null),[source,setSource]=useState<string|null>(null);
 const [output,setOutput]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const [problem,setProblem]=useState(""),[compare,setCompare]=useState(50);
 const [transfer,setTransfer]=useState<{received:number;total:number|null}|null>(null);
 const [stage,setStage]=useState("");
 const [selected,setSelected]=useState("u2netp");
 const pagesMode=import.meta.env.VITE_BROWSER_DEMO==="true";
 const workerRef=useRef<Worker|null>(null);
 const [customModel,setCustomModel]=useState<File|null>(null);
 const [modelUrl,setModelUrl]=useState("");
 const [hubModels,setHubModels]=useState<HubEntry[]>([]);
 const [hubBusy,setHubBusy]=useState(false);
 const [hubSearch,setHubSearch]=useState("");
 const [hubError,setHubError]=useState("");
 const [hubFile,setHubFile]=useState("");
 const [showUnverified,setShowUnverified]=useState(false);
 const [recommendedData,setRecommendedData]=useState<Record<string,ArrayBuffer>>({});
 const [customData,setCustomData]=useState<ArrayBuffer|null>(null);
 const [modelStatus,setModelStatus]=useState("");
 const [modelBusy,setModelBusy]=useState(false);
 const customFileRef=useRef<HTMLInputElement>(null);
 const available=pagesMode?[
  ["u2netp",{installed:true,name:"U2Netp"}] as [string,Model],
  ...recommendedModels.filter(m=>m.id!=="u2netp"&&recommendedData[m.id]).map(m=>[m.id,{installed:true,name:m.name}] as [string,Model]),
  ...(customData?[["user-onnx",{installed:true,name:customModel?.name||"Custom ONNX"}] as [string,Model]]:[])
 ]:Object.entries(models).filter(([,m])=>m.installed);
 useEffect(()=>{if(available.length&&!available.some(([id])=>id===selected))setSelected(available[0][0]);},[models,selected]);
 useEffect(()=>()=>{workerRef.current?.terminate()},[]);
 useEffect(()=>{if(!file){setSource(null);return}const url=URL.createObjectURL(file);setSource(url);return()=>URL.revokeObjectURL(url)},[file]);
 function choose(f?:File){setProblem("");setOutput(null);if(!f)return;
  if(!["image/png","image/jpeg","image/webp"].includes(f.type)||f.size>20*1024*1024){setProblem(t("editorFormats"));return}
  setFile(f);setCompare(50);
 }
 async function run(){
  if(!file||busy)return;
  setBusy(true);setProblem("");setOutput(null);setTransfer(null);setStage("");
  try{const body=new FormData();body.append("file",file);body.append("model_name",selected);
   if(pagesMode){
    const bitmap=await createImageBitmap(file);
    if(selected==="user-onnx"&&!customData)throw Error("Import a model first");
    const worker=workerRef.current??new Worker(new URL(import.meta.env.BASE_URL+"browser/worker.mjs",location.origin),{type:"module"});
    workerRef.current=worker;
    const id=crypto.randomUUID();
    const png=await new Promise<Blob>((resolve,reject)=>{
     const timeout=setTimeout(()=>{worker.removeEventListener("message",receive);reject(new Error("Inference timed out"))},180000);
     const receive=(event:MessageEvent)=>{const data=event.data;if(data.id!==id)return;
      if(data.download){setTransfer(data.download);return;}
      if(data.status){setStage(data.status);return;}
      clearTimeout(timeout);worker.removeEventListener("message",receive);
      if(data.error)reject(new Error(data.error));else if(data.transparent instanceof Blob)resolve(data.transparent);else reject(new Error("Invalid inference result"));
     };
     worker.addEventListener("message",receive);
     const bytes=selected==="user-onnx"&&customData?customData.slice(0):recommendedData[selected]?.slice(0);
     worker.postMessage({id,bitmap,modelId:selected,modelBytes:bytes},bytes?[bitmap,bytes]:[bitmap]);
    });
    setOutput(await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Cannot read PNG"));reader.readAsDataURL(png)}));
   }else{
    const r=await fetch("/api/remove-bg",{method:"POST",body});
    const data=await r.json();if(!r.ok||!data.success||typeof data.image!=="string"||!data.image.startsWith("data:image/"))throw Error(data.detail||t("editorError"));
    setOutput(data.image);
   }
  }catch(e){setProblem(e instanceof Error?e.message:t("editorError"))}finally{setBusy(false)}
 }
 function save(){if(!output)return;const a=document.createElement("a");a.href=output;a.download=(file?.name.replace(/\.[^.]+$/,"")||"image")+"-transparent.png";a.click()}
 return <section className="space-y-5">
  <div><h2 className="text-2xl font-semibold sm:text-3xl">{t("editorTitle")}</h2><p className="mt-2 text-sm text-slate-400">{t("editorSubtitle")}</p></div>
  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
   <Card><CardContent className="p-4 sm:p-6">
    {!source?<div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();input.current?.click()}}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();choose(e.dataTransfer.files[0])}} onClick={()=>input.current?.click()} className="flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/40 px-5 text-center hover:border-sky-400 focus-visible:outline-2 focus-visible:outline-sky-400">
      <UploadCloud size={42} className="mb-4 text-sky-400"/><p className="font-semibold">{t("editorDrop")}</p><p className="mt-2 text-xs text-slate-400">{t("editorFormats")}</p></div>:
     <div className="space-y-3"><div className="flex items-center justify-between"><span className="text-sm text-slate-300">{output?t("editorResult"):t("editorOriginal")}</span><Button variant="ghost" onClick={()=>input.current?.click()}><RotateCcw size={15}/>{t("editorReset")}</Button></div>
      <div className="relative min-h-56 overflow-hidden rounded-xl border border-slate-700 bg-[linear-gradient(45deg,#384454_25%,transparent_25%),linear-gradient(-45deg,#384454_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#384454_75%),linear-gradient(-45deg,transparent_75%,#384454_75%)] bg-[length:22px_22px] bg-[position:0_0,0_11px,11px_-11px,-11px_0]">
        <img src={output||source} alt={t("editorPreview")} className="max-h-[520px] w-full object-contain"/>
        {output&&<div className="absolute inset-0 overflow-hidden" style={{clipPath:`inset(0 ${100-compare}% 0 0)`}}><img src={source} alt={t("editorOriginal")} className="h-full w-full object-contain"/></div>}
      </div>
      {output&&<label className="block text-xs text-slate-300">{t("editorCompare")}<input type="range" min="0" max="100" value={compare} onChange={e=>setCompare(Number(e.target.value))} className="mt-2 w-full accent-sky-400" aria-label={t("editorCompare")}/></label>}
     </div>}
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>choose(e.target.files?.[0])}/>
   </CardContent></Card>
   <Card><CardContent className="space-y-4">
    <div><label htmlFor="editor-model" className="mb-2 block text-sm font-medium">{t("editorModel")}</label>
     <select id="editor-model" className="w-full rounded-lg border border-slate-600 bg-slate-800 p-3 text-sm" value={selected} onChange={e=>setSelected(e.target.value)} disabled={!available.length||busy}>
      {available.map(([id])=><option value={id} key={id}>{id}</option>)}</select>
     {!available.length&&<button className="mt-2 text-left text-xs text-sky-300 underline" onClick={onManageModels}>{t("editorNoModel")}</button>}
    </div>
    {pagesMode&&<div className="space-y-2 rounded-lg border border-slate-700 p-3 text-xs">
     <p className="font-semibold">{locale==="zh-CN"?"Hugging Face 实时模型列表":"Hugging Face live models"}</p>
     <p className="text-slate-400">{locale==="zh-CN"?"来自官方 Hub API，显示含 ONNX 文件的公开仓库。仅已知 U2Net 兼容模型可保证按当前推理方式运行。":"Live public ONNX repositories. Most require a separate inference adapter; only U2Net-compatible models may run here."}</p>
     <Button variant="outline" className="w-full" disabled={hubBusy||modelBusy} onClick={async()=>{setHubBusy(true);setHubError("");try{setHubModels(await searchHubModels())}catch(e){setHubError(String(e))}finally{setHubBusy(false)}}}>{hubBusy?"Loading…":locale==="zh-CN"?"刷新 Hugging Face 列表":"Refresh Hugging Face models"}</Button>
     {hubError&&<p role="alert" className="text-rose-300">{hubError}</p>}
     {hubModels.length>0&&<><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={showUnverified} onChange={e=>setShowUnverified(e.target.checked)}/>{locale==="zh-CN"?"显示未适配模型（仅查看）":"Show unsupported models (browse only)"}</label><input value={hubSearch} onChange={e=>setHubSearch(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-900 p-2" placeholder={locale==="zh-CN"?"搜索仓库":"Filter repositories"}/>
      <div className="max-h-64 space-y-2 overflow-y-auto">{hubModels.filter(m=>m.id.toLowerCase().includes(hubSearch.toLowerCase())&&(showUnverified||m.onnx.some(n=>isCompatibleHubModel(m.id,n)))).slice(0,12).map(m=><div key={m.id} className="rounded-lg bg-slate-800 p-2">
       <a className="break-all font-medium text-sky-300 hover:underline" href={'https://huggingface.co/'+m.id} target="_blank" rel="noopener noreferrer">{m.id}</a>
       <p className="text-slate-400">↓ {m.downloads.toLocaleString()} · {m.license} · {m.onnx.length} ONNX · {m.onnx.some(n=>isCompatibleHubModel(m.id,n))?(locale==="zh-CN"?"已知兼容":"Known-compatible"):(locale==="zh-CN"?"需适配":"Adapter required")}</p>
       <select aria-label={m.id} className="mt-1 w-full rounded bg-slate-900 p-2" onChange={e=>(setModelUrl(modelFileURL(m.id,e.target.value)),setHubFile(m.id+"/"+e.target.value))} value=""><option value="" disabled>{locale==="zh-CN"?"选择 ONNX 文件并填入下载栏":"Select ONNX file for download"}</option>{m.onnx.map(name=><option key={name} value={name} disabled={!isCompatibleHubModel(m.id,name)}>{name}{isCompatibleHubModel(m.id,name)?"":" · adapter required"}</option>)}</select>
      </div>)}</div></>}
    </div>}
    {pagesMode&&<div className="space-y-2 rounded-lg border border-slate-700 p-3 text-xs">
      <p className="font-semibold">{locale==="zh-CN"?"推荐模型 · 按用途选择":"Recommended models"}</p>
      {recommendedModels.map(m=><div key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/70 p-2">
       <div><p className="font-semibold">{m.name}</p><p className="text-slate-400">{locale==="zh-CN"?m.zh:m.en}</p><p className="text-[10px] text-amber-300">{m.license}</p></div>
       <Button variant="outline" disabled={busy||modelBusy} onClick={async()=>{
        if(!m.url||recommendedData[m.id]){setSelected(m.id);return}
        setModelBusy(true);setProblem("");setTransfer(null);setModelStatus((locale==="zh-CN"?"测速并下载 ":"Downloading ")+m.name);
        try{const data=await downloadModel(mirrorCandidates(m.url),setTransfer);setRecommendedData(v=>({...v,[m.id]:data}));setSelected(m.id);setModelStatus(m.name+" ✓")}
        catch(e){setProblem(String(e))}finally{setModelBusy(false)}
       }}>{m.id==="u2netp"||recommendedData[m.id]?(locale==="zh-CN"?"选择":"Use"):(locale==="zh-CN"?"下载":"Get")}</Button>
      </div>)}
     </div>}
    {pagesMode&&<div className="space-y-2 rounded-lg border border-slate-700 p-3 text-xs">
      <p className="font-semibold">{locale==="zh-CN"?"第三方 ONNX 模型（U2Netp 兼容）":"Third-party ONNX (U2Netp-compatible)"}</p>
      <p className="text-slate-400">{locale==="zh-CN"?"仅支持 RGB 320×320 输入和单通道 320×320 遮罩输出；不保证其他架构兼容。":"Requires RGB 320×320 input and a 320×320 single-channel mask."}</p>
      <input ref={customFileRef} className="hidden" type="file" accept=".onnx" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>512*1024*1024){setProblem("Model exceeds 512 MiB");return}setCustomModel(f);setCustomData(await f.arrayBuffer());setSelected("user-onnx");setModelStatus(f.name)}}/>
      <Button variant="outline" className="w-full" disabled={modelBusy||busy} onClick={()=>customFileRef.current?.click()}>{locale==="zh-CN"?"导入本地 ONNX":"Import local ONNX"}</Button>
      <input className="w-full rounded-md border border-slate-600 bg-slate-900 p-2" type="url" placeholder="https://huggingface.co/.../model.onnx" value={modelUrl} onChange={e=>{setModelUrl(e.target.value);setHubFile("")}}/>
      <Button variant="outline" className="w-full" disabled={modelBusy||busy||!modelUrl.trim()} onClick={async()=>{setModelBusy(true);setProblem("");setTransfer(null);try{
        if(hubFile && !hubModels.some(m=>m.onnx.some(name=>m.id+"/"+name===hubFile&&isCompatibleHubModel(m.id,name)))){
         throw Error(locale==="zh-CN"?"该 ONNX 未验证与 U2Netp 推理适配器兼容。为防止浪费流量，请选择推荐模型，或自行导入兼容模型。":"This model has not been validated with the U2Netp adapter. Use a recommended model or an explicitly compatible ONNX.");
        }
        const urls=mirrorCandidates(modelUrl);setModelStatus(locale==="zh-CN"?"镜像测速并下载中…":"Benchmarking mirrors and downloading…");
        const data=await downloadModel(urls,setTransfer);setCustomModel(new File([data],"downloaded.onnx"));setCustomData(data);setSelected("user-onnx");setModelStatus(locale==="zh-CN"?"模型已下载，点击一键抠图":"Model ready");
       }catch(e){setProblem(String(e))}finally{setModelBusy(false)}}}>{locale==="zh-CN"?"智能测速并下载":"Benchmark mirrors & download"}</Button>
      {modelStatus&&<p role="status" className="text-sky-300">{modelStatus}</p>}
      {modelBusy&&transfer&&<><progress className="h-2 w-full accent-sky-400" value={transfer.received} max={transfer.total||undefined}/><p>{(transfer.received/1048576).toFixed(1)} MiB{transfer.total?` / ${(transfer.total/1048576).toFixed(1)} MiB · ${Math.floor(transfer.received/transfer.total*100)}%`:""}</p></>}
     </div>}
    <Button className="w-full py-3" onClick={run} disabled={!file||!available.length||busy}><Play size={16}/>{busy?t("editorRunning"):t("editorRun")}</Button>
    {busy&&<div role="status" className="space-y-2 text-xs text-sky-300">
     <p>{stage||t("editorRunning")}</p>
     {pagesMode&&transfer&&<><progress className="h-2 w-full accent-sky-400" max={transfer.total||undefined} value={transfer.total?transfer.received:undefined} aria-label={locale==="zh-CN"?"模型下载进度":"Model download progress"}/>
      <p>{(transfer.received/1048576).toFixed(1)} MiB{transfer.total?` / ${(transfer.total/1048576).toFixed(1)} MiB · ${Math.floor(transfer.received/transfer.total*100)}%`:""}</p></>}
    </div>}
    {problem&&<p role="alert" className="rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-200">{problem}</p>}
    <Button variant="outline" className="w-full" disabled={!output||busy} onClick={save}><Download size={16}/>{t("editorDownload")}</Button>
    <div className="border-t border-slate-700 pt-3 text-xs leading-6 text-slate-400"><ImagePlus size={16} className="mr-1 inline"/>{t("editorHint")}</div>
   </CardContent></Card>
  </div>
 </section>
}
