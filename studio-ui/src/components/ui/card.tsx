import type{HTMLAttributes}from "react";import{cn}from "../../lib";
export function Card({className,...props}:HTMLAttributes<HTMLDivElement>){return <div className={cn("rounded-xl border border-slate-700 bg-slate-900/80 shadow-sm",className)} {...props}/>;}
export function CardContent({className,...props}:HTMLAttributes<HTMLDivElement>){return <div className={cn("p-5",className)} {...props}/>;}
