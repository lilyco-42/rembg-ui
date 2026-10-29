import {useCallback,useEffect,useMemo,useState} from "react";
import{createRoot}from"react-dom/client";
import{Download,HardDrive,RefreshCw,ShieldAlert,Box,Search,ArrowLeft,Languages}from"lucide-react";
import{Button}from"./components/ui/button";
import{Card,CardContent}from"./components/ui/card";
import{Progress}from"./components/ui/progress";
import {useLocale} from "./i18n/use-locale";
import "./index.css";

type Model={name:string;purpose?:string;license?:string;installed:boolean;source?:string|null;path?:string};
const securityToken=document.querySelector<HTMLMetaElement>('meta[name="rembg-token"]')?.content||"";
const localizedPurpose:Record<string,{zh:string;en:string}>={
 "u2netp":{zh:"轻量通用",en:"Fast general-purpose"},"u2net":{zh:"通用抠图",en:"General background removal"},
 "u2net_human_seg":{zh:"人像",en:"Portraits"},"u2net_cloth_seg":{zh:"服装分割",en:"Clothing segmentation"},
 "silueta":{zh:"轻量模型",en:"Compact model"},"isnet-anime":{zh:"动漫插画",en:"Anime & illustration"},
 "isnet-general-use":{zh:"通用细节",en:"General fine detail"},"bria-rmbg":{zh:"高精度；商业用途需另行授权",en:"High precision; commercial license required"},
};
const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
function App(){
 const {locale,setLocale,t}=useLocale();
 const[models,setModels]=useState<Record<string,Model>>({});
 const[busy,setBusy]=useState<string|null>(null);
 const[downloadProgress,setDownloadProgress]=useState<{received:number;total:number|null}|null>(null);
 const[loading,setLoading]=useState(true);
 const[message,setMessage]=useState("");
 const[search,setSearch]=useState("");
 const[filter,setFilter]=useState<"all"|"installed"|"missing">("all");
 const[error,setError]=useState(false);
 const refresh=useCallback(async()=>{
  const r=await fetch("/api/models");if(!r.ok)throw Error(t("fetchError"));
  const data=await r.json();setModels(data.models||{});
 },[locale]);
 useEffect(()=>{let active=true;refresh().catch(e=>{if(active){setMessage(e.message);setError(true)}}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[refresh]);
 const items=useMemo(()=>Object.entries(models).filter(([id,m])=>
  (filter==="all"||(filter==="installed" ? m.installed:!m.installed))&&
  [id,m.purpose||"",localizedPurpose[id]?.[locale==="zh-CN"?"zh":"en"]||""].join(" ").toLowerCase().includes(search.trim().toLowerCase())
 ),[models,filter,search,locale]);
 const installedCount=Object.values(models).filter(m=>m.installed).length;
 async function download(id:string){
  setBusy(id);setDownloadProgress(null);setError(false);setMessage(t("downloading",{name:id}));
  try{
   const r=await fetch("/api/models/"+encodeURIComponent(id)+"/download",{method:"POST",headers:{"X-Rembg-Token":securityToken}});
   const d=await r.json();if(!r.ok)throw Error(d.detail||t("startError"));
   for(let n=0;n<720;n++){
    await delay(1500);
    const x=await fetch("/api/models/download/"+encodeURIComponent(d.job_id));
    if(!x.ok)throw Error(t("statusError"));
    const status=await x.json();
    if(typeof status.bytes_received==="number")setDownloadProgress({received:status.bytes_received,total:status.bytes_total??null});
    if(status.state==="failed")throw Error(status.error||t("downloadError"));
    if(status.state==="completed"){await refresh();setMessage(t("finished",{name:id}));return}
   }
   throw Error(t("timeout"));
  }catch(e){setMessage(e instanceof Error?e.message:String(e));setError(true)}
  finally{setBusy(null);setDownloadProgress(null)}
 }
 return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
  <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
   <div className="max-w-2xl"><p className="text-xs font-bold tracking-[.22em] text-sky-400">REMBG STUDIO</p>
    <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
    <p className="mt-3 text-sm leading-7 text-slate-400">{t("subtitle")}</p>
   </div>
   <div className="flex items-center gap-2">
    <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
     <Languages size={16} aria-hidden="true"/><span className="sr-only">{t("language")}</span>
     <select aria-label={t("language")} className="cursor-pointer bg-transparent outline-none" value={locale} onChange={e=>setLocale(e.target.value as typeof locale)}>
      <option value="zh-CN">简体中文</option><option value="en">English</option>
     </select>
    </label>
    <Button variant="outline" disabled={loading} onClick={()=>{setLoading(true);refresh().catch(e=>{setMessage(e.message);setError(true)}).finally(()=>setLoading(false))}}><RefreshCw size={16} aria-hidden="true"/>{t("refresh")}</Button>
   </div>
  </header>
  <div className="mb-6 grid grid-cols-3 gap-3">
   {([{k:"total",v:Object.keys(models).length},{k:"available",v:installedCount},{k:"requiresDownload",v:Object.keys(models).length-installedCount}] as const).map(item=>
    <Card key={item.k}><CardContent className="p-4"><p className="text-xs text-slate-400">{t(item.k)}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{item.v}</p></CardContent></Card>
   )}
  </div>
  <div className="mb-5 flex flex-col gap-3 sm:flex-row">
   <label className="relative flex-1"><Search size={17} aria-hidden="true" className="absolute left-3 top-3 text-slate-400"/>
    <input className="h-11 w-full rounded-lg border border-slate-700 bg-slate-900 pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-500" placeholder={t("search")} value={search} onChange={e=>setSearch(e.target.value)} aria-label={t("search")}/>
   </label>
   <div className="flex gap-2" aria-label={t("all")}>
    {(["all","installed","missing"] as const).map(k=><Button key={k} variant={filter===k?"default":"outline"} onClick={()=>setFilter(k)}>{t(k==="missing"?"notInstalled":k)}</Button>)}
   </div>
  </div>
  <div role="status" aria-live="polite" className={"mb-6 rounded-lg border px-4 py-3 text-sm "+(error?"border-rose-700 bg-rose-950/40 text-rose-200":"border-slate-700 bg-slate-900 text-slate-300")}>{loading?t("loading"):message||t("start")}</div>
  <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
   {items.map(([id,model])=><Card key={id} className="h-full"><CardContent className="flex h-full flex-col">
    <div className="flex items-center justify-between"><Box size={22} className="text-sky-400" aria-hidden="true"/><span className={model.installed?"rounded-full bg-emerald-950 px-2 py-1 text-xs text-emerald-300":"rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300"}>{t(model.installed?"ready":"missing")}</span></div>
    <h2 className="mt-4 text-lg font-semibold">{model.name||id}</h2>
    <p className="mt-1 min-h-11 text-sm text-slate-400">{localizedPurpose[id]?.[locale==="zh-CN"?"zh":"en"]||model.purpose||t("unknown")}</p>
    <div className="my-3 flex flex-1 items-start gap-2 text-xs leading-5 text-amber-300"><ShieldAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0"/><span>{model.license||t("licenseHint")}</span></div>
    {busy===id&&<div className="mb-3"><Progress value={downloadProgress?.total?Math.min(100,Math.round(downloadProgress.received/downloadProgress.total*100)):0}/><p className="mt-2 text-xs text-slate-400">{downloadProgress?.total?`${(downloadProgress.received/1024/1024).toFixed(1)} / ${(downloadProgress.total/1024/1024).toFixed(1)} MiB`:t("checking")}</p></div>}
    <Button className="w-full" disabled={model.installed||!!busy||!model.source} onClick={()=>download(id)}><Download size={16} aria-hidden="true"/>{model.installed?t("installedButton"):model.source?t("download"):t("licenseImport")}</Button>
   </CardContent></Card>)}
  </section>
  {!loading&&items.length===0&&<p className="py-16 text-center text-slate-400">{t("empty")}</p>}
  <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-5 text-xs text-slate-500">
   <span><HardDrive size={14} aria-hidden="true" className="mr-1 inline"/>{t("footer")}</span>
   <a href="/" className="inline-flex items-center gap-2 text-sky-300 hover:underline"><ArrowLeft size={14} aria-hidden="true"/>{t("back")}</a>
  </footer>
 </main>
}
createRoot(document.getElementById("root")!).render(<App/>);
