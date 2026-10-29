import * as ProgressPrimitive from "@radix-ui/react-progress";
export function Progress({value=0}:{value?:number}){return <ProgressPrimitive.Root value={value} className="relative h-2 w-full overflow-hidden rounded-full bg-slate-700"><ProgressPrimitive.Indicator style={{transform:`translateX(-${100-value}%)`}} className="h-full w-full bg-sky-400 transition-transform"/></ProgressPrimitive.Root>}
