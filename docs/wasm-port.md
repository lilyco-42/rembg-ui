# WASM / GitHub Pages 移植决策

需求：静态站点放在 github.io，图片在用户浏览器内处理，无 Python 服务。

2026-09-13 预研：gh 同义词搜索后确认 imgly/background-removal-js（7315 stars，AGPL-3.0，2025-07-18 更新）已有浏览器方案；只读研究其 packages/web/src/onnx.ts，未复制代码。选择直接采用 MIT 的 microsoft/onnxruntime（21838 stars，2026-09-13 更新）WASM 内核。Pyodide（MPL-2.0）增加 Python 运行时，现有原生 ONNX Runtime/PyTorch 依赖不能直接搬进去。Rust 可用于后续像素处理，首轮没有必要替换成熟推理内核。

首轮范围：独立 web/ 静态入口、U2Netp 320px 推理、透明 PNG 与商品白底画布、浏览器本地处理、Pages 构建。入口现在带有 manifest 与 service worker，可在 Android 等移动浏览器安装为 PWA，并在首次成功加载后缓存同站点运行时和模型。保留桌面端。此入口尚未移植 SAM、原有批次恢复和复核流程。

2026-09-14 验证：Windows 默认静态服务器将 .mjs 返回 text/plain 导致页面模块不执行，已添加显式 MIME 的 web/serve.py。真实浏览器 WASM 完成仓库测试 JPG 的抠图；实际 PNG 下载验证为 1200×1200 不透明白底，以及 736×1104 透明底稿（alpha 0–255）。两项像素单元测试通过。图片是建筑样本，细边缘和部分浅色主体存在丢失；这证明运行链路，不构成商品图质量验收。首轮发布使用轻量模型，并明确标为移植验证版。

只读研究 imgly 提交：12f56cc4f2a90d624e165a715748d22efc7a1d93。运行时固定 1.22.0，分发附带 MIT 许可和第三方声明；U2Net 许可取自 ac7e1c817ecab7c7dff5ce6b1abba61cd213ff29。

采用专用 Worker + 单线程 WASM，避免依赖 Pages 上的跨源隔离响应头。相对路径支持仓库子目录。构建时取模型并校验 rembg 公布的 MD5；模型和 WASM 同站点托管，图片不上传。U2Netp 画质需独立验收，不能把 BRIA 的效果承诺搬过来。

参考：
- https://onnxruntime.ai/docs/tutorials/web/deploy.html
- https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html
- https://pyodide.org/en/stable/usage/faq.html
- https://github.com/imgly/background-removal-js
- https://github.com/microsoft/onnxruntime/issues/22113 （Worker 路径报错的用户复现；实现以官方部署文档为准）
- https://github.com/xuebinqin/U-2-Net （Apache-2.0，保留上游许可；转换权重来自 rembg release）
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits （Pages 不用于经营商业 SaaS；本轮为公开静态演示）
