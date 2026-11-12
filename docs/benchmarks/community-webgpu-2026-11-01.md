# PR #12 AMD RDNA 3 WebGPU smoke verification

Date: 2026-11-01
Environment: AgentDock CachyOS Linux node; system Chromium; local U2Netp converted ONNX model.
Source: `scripts/bench_webgpu_u2netp.cjs` from PR #12 branch tarball.

Reproduction:
```sh
python scripts/install_webgpu_runtime.py
npm install --no-save --no-package-lock --prefix /tmp/rembg-webgpu-smoke playwright-core --registry=https://registry.npmmirror.com
NODE_PATH=/tmp/rembg-webgpu-smoke/node_modules node scripts/bench_webgpu_u2netp.cjs
```

Output:
```json
{
  "provider": "webgpu",
  "adapter": {"vendor": "amd", "architecture": "rdna-3"},
  "sessionCreateMs": 715.4,
  "runsMs": [273, 103.1, 97.8, 104.5, 101.4, 100.2, 98.5, 99.3],
  "warmMedianMs": 100.2,
  "output": {"length": 102400, "first8": [0.009373052977025509, 0.012357029132544994, 0.018036793917417526, 0.007674034219235182, 0.005535784177482128, 0.005402596667408943, 0.005201274063438177, 0.005307808052748442]}
}
```

Result: **PASS** — Chromium reports AMD RDNA 3 WebGPU adapter, session provider is set exclusively to WebGPU, eight inference runs succeeded and returned finite 320x320 output.

Limits: This is a browser inference smoke test, **not** a packaged-app end-to-end test, visual segmentation accuracy assessment, legal weight review, security audit or assurance against every ONNX CPU fallback path. The browser script was not independently instrumented for GPU workload profiling.
