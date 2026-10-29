import {useEffect,useState} from "react";import{createRoot}from"react-dom/client";
import{Download,HardDrive,RefreshCw,ShieldAlert,Box}from"lucide-react";
import{Button}from"./components/ui/button";import{Card,CardContent}from"./components/ui/card";import{Progress}from"./components/ui/progress";import"./index.css";
type Model={name:string;purpose?:string;license?:string;installed:boolean;source?:string|null;path?:string};
const securityToken=document.querySelector<HTMLMetaElement>('meta[name="rembg-token"]')?.content||"";
function App(){
 const[models,setModels]=useState<Record<string,Model>>({});const[busy,setBusy]=useState<string|null>(null);const[message,setMessage]=useState("请选择模型，首次下载完成后支持离线使用。");
 async function refresh(){const r=await fetch("/api/models");if(!r.ok)throw Error("模型目录读取失败");setModels((await r.json()).models||{});}
 useEffect(()=>{refresh().catch(e=>setMessage(e.message))},[]);
 async function download(id:string){setBusy(id);setMessage("正在后台下载 "+id+"，请保持应用开启…");
 try{const r=await fetch("/api/models/"+encodeURIComponent(id)+"/download",{method:"POST",headers:{"X-Rembg-Token":securityToken}});const d=await r.json();if(!r.ok)throw Error(d.detail||"下载启动失败");
 for(let n=0;n<720;n++){await new Promise(ok=>setTimeout(ok,1500));const x=await fetch("/api/models/download/"+d.job_id);if(!x.ok)throw Error("下载状态不可用");const status=await x.json();if(status.state==="failed")throw Error(status.error||"下载失败");if(status.state==="completed"){await refresh();setMessage(id+" 已就绪，可以离线使用");return;}}
 throw Error("下载尚未完成，请稍后查看");
 }catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(null)}}
 return <main className="mx-auto max-w-6xl px-5 py-10"><header className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold tracking-widest text-sky-400">REMBG STUDIO</p><h1 className="mt-2 text-3xl font-bold tracking-tight">模型中心</h1><p className="mt-3 text-slate-400">选择、下载和管理你的 AI 抠图模型。模型文件不会预装在安装包中。</p></div><Button variant="outline" onClick={()=>refresh().catch(e=>setMessage(e.message))}><RefreshCw size={16}/>刷新模型</Button></header>
 <div role="status" aria-live="polite" className="mb-5 rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">{message}</div>
 <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(models).map(([id,model])=><Card key={id}><CardContent><div className="flex items-center justify-between gap-3"><Box size={20} className="text-sky-400"/><span className={model.installed?"text-xs text-emerald-400":"text-xs text-slate-400"}>{model.installed?"已安装":"待下载"}</span></div><h2 className="mt-4 font-semibold text-lg">{model.name||id}</h2><p className="mt-1 min-h-10 text-sm text-slate-400">{model.purpose||"第三方模型"}</p><div className="my-3 flex items-start gap-2 text-xs text-amber-300"><ShieldAlert size={14} className="shrink-0"/><span>{model.license||"请核对模型许可证"}</span></div>{busy===id&&<div className="mb-3"><Progress value={45}/><span className="text-xs text-slate-400">后台下载中，正在校验文件…</span></div>}<Button className="w-full" disabled={model.installed||!!busy||!model.source} onClick={()=>download(id)}><Download size={16}/>{model.installed?"已就绪":model.source?"一键下载":"需要授权后导入"}</Button></CardContent></Card>)}</section>
 <p className="mt-7 text-sm text-slate-500"><HardDrive size={14} className="mr-1 inline"/>开源组件：shadcn/ui 风格、Radix UI 与 Tailwind CSS。模型授权以模型提供者条款为准。</p></main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
