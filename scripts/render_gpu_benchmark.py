#!/usr/bin/env python3
"""Render local SVG benchmark comparison chart, no third-party dependencies."""
import json
import statistics
from pathlib import Path
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'docs/benchmarks/amd-rdna3-2026-10-28.json').read_text())
rows=[]
for threads,runs in data['cpu']['runs_ms'].items():
    rows.append((f'CPU {threads} thread'+('' if threads=='1' else 's'),statistics.median(runs[3:]),'#697895'))
rows.append(('AMD WebGPU',statistics.median(data['gpu']['runs_ms'][3:]),'#188d9e'))
width=840;height=430; start=260;barmax=490
lines=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="U2Netp 320x320 inference warm-median CPU vs WebGPU benchmark">', '<rect width="100%" height="100%" fill="#101827"/>',
'<text x="35" y="47" fill="#eff5ff" font-family="sans-serif" font-size="23" font-weight="bold">Rembg Studio · U2Netp 320×320</text>',
'<text x="35" y="78" fill="#b4c6e3" font-family="sans-serif" font-size="15">CachyOS · AMD RDNA 3 · 2026-10-28 · Warm median (runs 4–8)</text>']
for i,(label,ms,color) in enumerate(rows):
 y=115+i*56;length=barmax*ms/420
 lines.extend([f'<text x="35" y="{y+26}" fill="#e7edf9" font-family="sans-serif" font-size="16">{label}</text>',
 f'<rect x="{start}" y="{y}" width="{length:.1f}" height="32" rx="5" fill="{color}"/>',
 f'<text x="{start+length+12:.1f}" y="{y+23}" fill="#ffffff" font-family="sans-serif" font-size="16">{ms:.1f} ms</text>'])
lines.append('<text x="35" y="403" fill="#b4c6e3" font-family="sans-serif" font-size="13">Lower is better. Kernel inference only; cold initialization and image I/O excluded.</text>')
lines.append('</svg>')
target=root/'docs/benchmarks/cpu-vs-webgpu-rdna3.svg'
target.write_text('\n'.join(lines))
print(target)
