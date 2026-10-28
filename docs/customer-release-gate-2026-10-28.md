# Customer release gate — Rembg Studio (2026-10-28)

**Status: NOT READY FOR PAID CUSTOMER DELIVERY.** Do not advertise AMD/Intel cross-platform desktop GPU acceleration or a downloadable AppImage before they pass acceptance tests.

## Current build facts
- Linux AppImage CI integration: PR #9, merged commit `4c50dc99`.
- Build & Release run: https://github.com/lilyco-42/rembg-ui/actions/runs/40703585834 (in progress when checked).
- The latest confirmed public Release was `v0.2.7-20261011-0249` and **did not contain an AppImage** when checked.
- Browser WebGPU-first inference: PR #7 merged, but real GPU inference on AMD Radeon 780M and other cards has not been accepted.
- Desktop Python backend uses ONNX Runtime CPU/CUDA/CoreML; the browser WebGPU branch does **not** enable desktop GPU.
- Desktop mask brush: PR #8 merged, browser interaction/export test still required.

## Release checklist (blocking)
1. Confirm Actions run completed successfully and upload contains `Rembg-UI-linux-x86_64.AppImage`. Check SHA-256 and file size; keep the tar.gz fallback.
2. Clean-install the AppImage on an x86-64 Linux system and test running from an actual Unicode directory such as `~/下载`. No dependency installation and no SIGABRT. Test both with and without FUSE (extract-and-run if needed).
3. Test real alpha-matting inference and transparent PNG output with representative customer-owned images on CPU; verify editor restore/erase and undo/redo, save, ZIP export.
4. **GPU correctness:** record ONNX Runtime actual provider or browser WebGPU adapter, not just provider availability. Test NVIDIA CUDA on a supported host, AMD Radeon 780M WebGPU on a browser with WebGPU support, and CPU fallback. Do not label Python desktop backend as cross-platform WebGPU.
5. Benchmark using same input/model on each device: initialization, 1-image latency, 10-image batch, peak RAM/VRAM, errors, GPU utilization and output accuracy.
6. Audit model weight licenses **per model and exact version** for commercial distribution and use (especially BRIA), plus dependency redistribution notices. Do not redistribute weights without a verified license.
7. Test paid entitlement issue/verification, offline use, expiry, quota, refund/revocation and payment recovery. Never embed private payment credentials in distributed software.
8. Test macOS/Windows installers and Android separately; success on one platform does not certify other platforms.
9. Package source attribution, licenses, privacy disclosure, support address, refund terms, platform requirements, release checksums and bug-report instructions.
10. Pilot on at least three external customer devices before promoting paid distribution. Freeze a tested release tag; avoid selling unverified CI head builds.

## Customer-facing claim rules
- Acceptable after verified: `Local AI background removal with manual mask restoration and a CPU fallback.`
- Only after successful GPU tests: `GPU acceleration available on tested [backend + GPU + OS + browser/driver] configurations.`
- Never promise universal GPU acceleration, automatic hand regeneration, compatibility with all Linux distributions, or full offline WebGPU on browsers without a tested bundled runtime.
