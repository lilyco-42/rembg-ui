import * as React from "react";
import {Slot} from "@radix-ui/react-slot";
import {cva,type VariantProps} from "class-variance-authority";
import {cn} from "../../lib";
const styles=cva("inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-50 disabled:pointer-events-none px-4 py-2",{
 variants:{variant:{default:"bg-sky-500 text-slate-950 hover:bg-sky-400",outline:"border border-slate-600 bg-slate-800 hover:bg-slate-700",ghost:"hover:bg-slate-800"}},defaultVariants:{variant:"default"}});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,VariantProps<typeof styles>{asChild?:boolean}
export function Button({asChild=false,className,variant,...props}:ButtonProps){const Comp=asChild?Slot:"button";return <Comp className={cn(styles({variant}),className)} {...props}/>;}
