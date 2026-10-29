# Rembg Studio · 新版模型中心 UI

使用 React 19、Radix UI、Tailwind CSS 4、Lucide React 和 shadcn/ui 的开源可复制组件结构（Button/Card/Progress）。该 UI 作为独立的渐进式迁移模块，不会覆盖桌面原编辑器。

- 本地开发：`npm ci && npm run dev`（开发服务通过 Vite 代理 /api 到本机 8042）
- 生产构建：`npm run build`（输出到 `frontend/studio-ui/`，由 FastAPI 提供 `/studio-ui/`）
- 快速入口：旧版编辑器的“打开新版模型中心”链接。
- 初次启动需要网络下载模型；模型版权、商业使用许可必须独立遵守。当前 UI 仅处理模型目录和下载，不代表第三方 ONNX 任意架构都可推理。

组件库以 [shadcn/ui](https://ui.shadcn.com/) 设计规范为基础，Radix UI、Tailwind CSS、Lucide React 及相关依赖为可商用开源软件；发布前应保留相关许可证通知。

## 国际化（i18n）

当前支持简体中文（zh-CN）和英文（en），浏览器语言自动匹配，手动切换保存在 localStorage（不可用时自动降级）。翻译集中管理在 `src/i18n/messages.ts`，使用 `npm test` 检查词条一致性。界面支持模型搜索、按安装状态筛选、安装统计和移动端布局。其他语言可按词典结构扩展。

第三方翻译请阅读 [TRANSLATING.md](TRANSLATING.md)，编辑 `locales/*.json`；导出命令：`npm run i18n:export`。

## GitHub Pages 真正浏览器推理构建

先运行 `cd web && npm ci && npm run build` 准备已有 WebGPU/WASM 运行包，再运行 `cd studio-ui && npm run build:pages`。构建产物位于 `frontend/studio-ui/`，将整个目录部署到 GitHub Pages 的 `rembg-studio-preview/`。此版本使用原 Worker + U2Netp，WebGPU 尝试失败时自动回退 WASM。
