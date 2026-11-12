# Rembg Studio Community / Pro — release gates

Status: implementation plan; **not a claim that paid enforcement is implemented**.
Base: PR #11 (`04f8914126c7ab5552eecb353d9fce1fd2ff236f`).

## Editions

- **Community**: local CPU/WebGPU inference, U2Netp and supported bring-your-own models, transparent PNG, local batching. No accounts, credit checks or per-image fees. Must not promise commercial use rights for third-party weights.
- **Pro local**: licensed advanced editing, templates and automation capabilities. A local client or browser must not be treated as a trustworthy per-inference metering authority.
- **Pro cloud**: all billable operations require authenticated **server** authorization, idempotent reservation, server-controlled execution and success settlement/failure refund. Any anonymous or exhausted balance must fail closed. A local browser Worker cannot be treated as billable usage proof.

## Existing PR #11 risks

1. `frontend/index.html` calls `runDesktopWebGPU` and returns before `/api/remove-bg`; the model endpoint in `main.py` checks `X-Rembg-Token` and `REMBG_ENABLE_WEBGPU_EXPERIMENT=1` but does **not** account for inference.
2. `studio-ui/src/editor.tsx` invokes a worker in `pagesMode` without invoking the old billing API; audit which deployed artifacts enable this path.
3. `offline_points.py` implements a demonstrator local grant ledger; it is not wired into inference and cannot guarantee anti-rollback or anti-replay on a user-controlled device.
4. `.github/workflows/build.yml` adds `continue-on-error: true` to release/upload steps and can conceal incomplete releases. `webgpu-cross-platform.yml` currently lacks a generic PR trigger and verifies CPU graph equivalence rather than actual browser GPU execution.

## Mandatory merge gates — safe Community integration

- [ ] Introduce a single backend-owned edition/capability declaration; do **not** use a UI checkbox or query parameter as authority for Pro privileges.
- [ ] Make the desktop WebGPU model endpoint disabled by default in all production/Pro builds until explicitly validated; never assume the existing experiment flag is a billing control.
- [ ] Make Community local inference explicitly unlimited and independent of Pro cloud billing.
- [ ] Ensure Pro cloud tasks cannot execute unless the service holds a valid reserved entitlement; preserve old `/api/remove-bg` behavior.
- [ ] Add automated negative tests for unauthenticated/exhausted balance, replayed job ID, racing requests, model-cached browser worker, and error refund paths.
- [ ] Remove or narrow release-related `continue-on-error`; fail if mandatory platform assets are absent.
- [ ] Prove no unlicensed model weights are bundled, redistributed, or represented as commercially cleared.
- [ ] Require green CI for both editions and resolve GitHub mergeability / branch protection blockers.

## Experimental WebGPU release gates

- [ ] Verify AMD Radeon 780M actual GPU execution in Chrome/Chromium/Edge with a known mask image, and confirm clear error on missing GPU/device loss.
- [ ] Validate ONNX operators with WebGPU execution (not only CPU-to-CPU graph comparison); detect silent CPU fallback.
- [ ] Install a release artifact in a clean offline environment, then check worker JS, ORT JS/WASM, ONNX assets and imports.
- [ ] Present honest model name U2Netp, processing status and elapsed time; no BRIA WebGPU claim.
- [ ] Keep experimental feature OFF for public releases until these tests succeed.

## Proposed minimal CI split

- `community-ci`: Python backend tests; studio-ui tests/build; JS syntax; free path; no paid route.
- `pro-security-ci`: server-side quota denial; reserve/settle/refund; parallel requests; edition boundaries.
- `webgpu-experimental-ci`: cross-platform assets + offline integrity; manual 780M browser GPU smoke with attached logs.
- `release-ci`: required per-edition artifacts, checksums, licenses, and hard failure on incomplete uploads.

## Next implementation order

1. Isolate free local WebGPU capability from paid cloud capability, including both legacy UI and `pagesMode`.
2. Add quota security tests and explicit Pro cloud failure-closed server guard.
3. Restore CI/release hard failure for missing deliverables.
4. Resolve license provenance of models/assets.
5. Verify WebGPU on AMD 780M; ship Community preview first, then Pro capabilities.

**Do not merge or mark PR #11 sale-ready based on this document alone.**

## 2026-11-12 780M 真机验证证据（本机实测，非合并结论）

- 对应上方第 32 行闸门：**Chromium 156 / RADV PHOENIX / AMD Radeon 780M** 已完成真实 GPU 执行验证；Chrome/Edge 与 Windows/macOS 真机仍未测，故该闸门整体保持未勾选。
- 执行证据：`scripts/bench_webgpu_u2netp.cjs` → adapter `amd/rdna-3`（非 SwiftShader/CPU）、sessionCreate 1116.8ms、warmMedian **88.6ms**、8 次前向输出均 102400 个有限值（No fallback to CPU）。
- 已知图像 mask：真实测试图经 WebGPU `session.run` 产出 mask，合成 640×480 RGBA 透明 PNG（alpha 0..255 / 256 级 / 91023 透明 + 9526 不透明像素），见 `docs/WEBGPU_GUIDE.zh-CN.md` 的 2026-11-12 复验小节。
- 错误路径：无 `navigator.gpu` → worker 返回「当前浏览器没有 WebGPU，无法启用 GPU 推理」；推理期 device-lost 类异常 → worker catch 以 `error` 字段回传，不伪装成 CPU 的 GPU 加速。两者均由 Playwright + Chromium CDP 实跑验证。
- 桌面 ONNX Runtime 路径（非 WebGPU）：MIGraphX EP 在 780M 上 u2netp p50 60–63ms vs CPU 102ms（约 1.7×），`remove-bg` 端到端 200，见 `docs/AMD-ROCM-GPU.zh-CN.md`。

> 本节仅记录硬件与错误路径的实测结果，**不代表上方 8 条强制合并闸门已解除**，也不代表可标记 sale-ready。
