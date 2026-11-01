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
