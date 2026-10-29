import {useEffect,useRef,useState} from "react";
import {Download,ImagePlus,Play,RotateCcw,UploadCloud} from "lucide-react";
import {Button} from "./components/ui/button";
import {Card,CardContent} from "./components/ui/card";
import {translate,type Locale,type MessageKey} from "./i18n/messages";

type Model={installed:boolean;name:string;purpose?:string};
type Props={locale:Locale;models:Record<string,Model>;onManageModels:()=>void};
export function Editor({locale,models,onManageModels}:Props){
 const t=(key:MessageKey)=>translate(locale,key),input=useRef<HTMLInputElement>(null);
 const [file,setFile]=useState<File|null>(null),[source,setSource]=useState<string|null>(null);
 const [output,setOutput]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const [problem,setProblem]=useState(""),[compare,setCompare]=useState(50);
 const [selected,setSelected]=useState("u2netp");
 const available=Object.entries(models).filter(([,m])=>m.installed);
 useEffect(()=>{if(available.length&&!available.some(([id])=>id===selected))setSelected(available[0][0]);},[models,selected]);
 useEffect(()=>{if(!file){setSource(null);return}const url=URL.createObjectURL(file);setSource(url);return()=>URL.revokeObjectURL(url)},[file]);
 function choose(f?:File){setProblem("");setOutput(null);if(!f)return;
  if(!["image/png","image/jpeg","image/webp"].includes(f.type)||f.size>20*1024*1024){setProblem(t("editorFormats"));return}
  setFile(f);setCompare(50);
 }
 async function run(){
  if(!file||busy)return;
  setBusy(true);setProblem("");setOutput(null);
  try{const body=new FormData();body.append("file",file);body.append("model_name",selected);
   const r=await fetch("/api/remove-bg",{method:"POST",body});
   const data=await r.json();if(!r.ok||!data.success||typeof data.image!=="string"||!data.image.startsWith("data:image/"))throw Error(data.detail||t("editorError"));
   setOutput(data.image);
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
    <Button className="w-full py-3" onClick={run} disabled={!file||!available.length||busy}><Play size={16}/>{busy?t("editorRunning"):t("editorRun")}</Button>
    {busy&&<div role="status" className="text-xs text-sky-300">{t("editorRunning")}</div>}
    {problem&&<p role="alert" className="rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-200">{problem}</p>}
    <Button variant="outline" className="w-full" disabled={!output||busy} onClick={save}><Download size={16}/>{t("editorDownload")}</Button>
    <div className="border-t border-slate-700 pt-3 text-xs leading-6 text-slate-400"><ImagePlus size={16} className="mr-1 inline"/>{t("editorHint")}</div>
   </CardContent></Card>
  </div>
 </section>
}
