# Rembg Studio WASM

独立浏览器移植验证版，全部抠图在设备上执行。JavaScript 调度 + ONNX Runtime Web 1.22.0 的 WASM CPU 内核，未引入 Python/Rust 运行时。U2Netp 仅是轻量验证模型，不等同桌面端 BRIA 质量。

## 构建与预览

需要 Node.js 22+，构建时联网下载约 4.6 MB U2Netp 权重及许可文本。

```powershell
cd web
npm ci
npm test
npm run build
python serve.py
```

预览地址 http://127.0.0.1:8056/ 。Windows 普通 `python -m http.server` 可能按系统注册表将 `.mjs` 返回 `text/plain`，因此使用附带的 `serve.py`。

将 `dist/` 全部内容复制到 GitHub Pages 的独立 `/rembg/` 目录。所有运行时、模型和链接均使用相对路径，不需要 API、密钥或 COOP/COEP 配置。模型 MD5 与 rembg 上游记录比对；npm 依赖由 lockfile 固定。

当前支持：最多 10 张串行处理，原尺寸透明 PNG、1200/1600 白底商品图、透明底稿下载、失败逐项提示、3 分钟单图超时。输入限制为每张 25 MB / 1600 万像素。首次需下载约 16 MB 模型及运行时资源，后续缓存由浏览器 HTTP 缓存策略决定；不承诺离线可用。

尚未移植：SAM 修图、批次恢复、复核清单、ZIP、桌面端模型选择。刷新会清空结果。GitHub Pages 版本用于公开演示；付费 SaaS 托管需另行安排。

验证：`npm test` 检查黑图输入、CHW 排列、mask 归一化和异常输出；真实浏览器测试覆盖模型加载、抠图、PNG 下载。浏览器 Canvas 重采样与桌面 Pillow Lanczos 不保证逐像素一致。
