# Rembg Studio WASM

The Pages build is installable as a lightweight PWA on Android and other
mobile browsers. `sw.js` caches the same-origin runtime and model after the
first successful load; bump `CACHE_NAME` when changing the static shell.

[在线打开](https://lilyco-42.github.io/rembg/) · [构建验证](https://github.com/lilyco-42/rembg-ui/actions/runs/34851787578)

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

已支持原图对比、逐图确认、按确认状态筛选的 ZIP 交付和 JSON 清单；ZIP 同时包含商品图和透明底稿。文件名使用唯一序号，清单保留未导出项和失败原因。

已加入 IndexedDB 批次恢复：保存原文件、结果、规格和确认状态；中断项恢复待处理，已完成项不会再次推理。仅在同一浏览器/站点恢复，清除站点数据会丢失。新选图片追加到当前批次，清空后可改变规格。ZIP 输入内容超过 64 MB 时提示逐图下载。

项目备份已支持：点击“导出项目备份”可将原图、当前结果、透明底稿、规格、确认状态和失败信息打包为 `.rembg.zip`；点击“导入项目备份”可在另一台同源站点恢复并继续处理。备份上限为 64 MiB，导入会校验路径、大小和 CRC，未完成项恢复为待处理；备份不包含模型缓存或授权密钥。桌面端模型选择仍待后续版本；GitHub Pages 版本用于公开演示，付费 SaaS 托管需另行安排。

验证：`npm test` 检查黑图输入、CHW 排列、mask 归一化和异常输出；真实浏览器测试覆盖模型加载、抠图、PNG 下载。浏览器 Canvas 重采样与桌面 Pillow Lanczos 不保证逐像素一致。

2026-09-14：本地连续两图完成；GitHub Pages 发布成功（站点提交 `26b2749`），公网真实图片完成 WASM 推理及 1200×1200 PNG 下载。脚本响应为 `text/javascript`，WASM 为 `application/wasm`。首次迁移链路已验证，尚未验收移动端、低内存设备及商品样本质量。

2026-09-15 多代理迭代：GPT-6 产出项目存储模块与测试，Sol 产出规格模块与测试，Luna 产出质量清单；主代理完成界面集成及实际浏览器验证。18 项 Node 测试通过（含存储事务模拟、配额失败和版本冲突）；真实浏览器验证原图恢复、完成结果/确认恢复、多页面冲突与恢复结果 ZIP。没有把模拟测试当作真实配额耗尽或设备崩溃验证。


### 2026-09-15：修边与交付修订

已提供擦除、恢复原图、当前编辑会话内撤销/重做、取消及保存。保存会同时重建透明底稿和商品图，递增 imageRevision，并清除 reviewedRevision；重新确认后才能进入“仅导出已确认”交付。关闭编辑器后笔画历史不保留，最终图像仍随批次保存。画笔为硬边圆笔，不包含软边、缩放或专业蒙版工具。

解码和原图预览前解析 PNG/JPEG/WebP 文件头，限制 25 MiB、1600 万像素及 8192 单边。商品图按 64 行扫描透明度；ZIP 使用 Blob 分片组合，输入限制 64 MiB。限制是分配上界控制，不代表低内存设备不会失败；真实移动设备满批压力测试仍待执行。

验证：35 项 Node 测试通过；真实浏览器执行擦除、撤销、重做、保存、刷新、确认失效、恢复原图笔画及重新确认导出。项目备份模块覆盖往返恢复、未完成项恢复和 CRC 篡改拒绝；交付 ZIP CRC 校验通过，交付清单 imageRevision=reviewedRevision=2。修订后的模块使用统一 URL 版本，避免已打开页面混用旧依赖。
