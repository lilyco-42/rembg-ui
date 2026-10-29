# Rembg Studio · 新版模型中心 UI

使用 React 19、Radix UI、Tailwind CSS 4、Lucide React 和 shadcn/ui 的开源可复制组件结构（Button/Card/Progress）。该 UI 作为独立的渐进式迁移模块，不会覆盖桌面原编辑器。

- 本地开发：`npm ci && npm run dev`（开发服务通过 Vite 代理 /api 到本机 8042）
- 生产构建：`npm run build`（输出到 `frontend/studio-ui/`，由 FastAPI 提供 `/studio-ui/`）
- 快速入口：旧版编辑器的“打开新版模型中心”链接。
- 初次启动需要网络下载模型；模型版权、商业使用许可必须独立遵守。当前 UI 仅处理模型目录和下载，不代表第三方 ONNX 任意架构都可推理。

组件库以 [shadcn/ui](https://ui.shadcn.com/) 设计规范为基础，Radix UI、Tailwind CSS、Lucide React 及相关依赖为可商用开源软件；发布前应保留相关许可证通知。
