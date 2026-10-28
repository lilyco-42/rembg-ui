# Rembg Studio 多平台下载与安装

**稳定版与 WebGPU 实验版请区分。** 稳定版最新可用版本：v0.2.7-20261011-0249。WebGPU 大模型 FP16 仍在试验（BRIA 512 GPU 未跑通），不应向客户标注为正式稳定 GPU 支持。

**全部已发布文件**：[GitHub Releases](https://github.com/lilyco-42/rembg-ui/releases/latest)
**WebGPU 技术预览**：[PR #11](https://github.com/lilyco-42/rembg-ui/pull/11)
**GPU 教程与性能图**：[WebGPU 中文指南](WEBGPU_GUIDE.zh-CN.md)

| 平台 | 安装包 / 使用入口 | 安装方式与注意事项 |
|---|---|---|
| Windows 10/11 x64 | `Rembg-UI-windows.zip` | 解压完整目录后运行 rembg-ui.exe；不要单独取出 EXE。实验 WebGPU 需 Chromium/Edge 和支持 WebGPU 的 GPU/驱动。 |
| Linux x86_64 | `Rembg-UI-linux.tar.gz` | 完整解压后在目录中运行 `./rembg-ui`。如果 SIGABRT，请先检查二进制和依赖，当前实验版尚未通过 Nuitka 安装包回归。 |
| macOS | `Rembg-UI-macOS.zip` | 解压 .app 后在 Finder 打开；留意签名、公证与 Apple Silicon/Intel 架构。 |
| Android ARM64 | `Rembg-UI-android-arm64-v8a.apk` | 手机安装对应 ABI 的 APK，启用系统安装授权；签名状态以 Release 文件名/说明为准。 |
| Android ARM32 | `Rembg-UI-android-armeabi-v7a.apk` | 适用于支持 armeabi-v7a 的旧设备。 |
| Android x86_64 | `Rembg-UI-android-x86_64.apk` | 通常用于兼容的模拟器或 x86_64 设备。 |
| Android 商店渠道 | `Rembg-UI-android.aab` | AAB 不是用户可直接安装的 APK，需 Play 分发及签名。 |
| iOS / iPadOS | [Web/PWA 版](https://lilyco-42.github.io/rembg-ui/) | Safari 访问后“分享 → 添加到主屏幕”。**目前没有已构建、签名并发布的 iOS IPA**；PWA 不是原生 IPA。 |

## 国内下载与 WebGPU 说明

项目大文件由 GitHub Releases 分发，国内访问速度取决于网络条件；不要把 GitHub Release 下载 URL 擅自改写成非官方镜像。WebGPU 的 U2Netp 模型优先从 hf-mirror.com 下载，ONNX Runtime Web 运行时优先从 npmmirror 获取；开发版可以参考 [中文 WebGPU 安装及性能对比](WEBGPU_GUIDE.zh-CN.md) 运行脚本完成断点续传与校验。

## 发布验收标准

只有实际构建成功并出现在 Release 资产列表中的二进制，才可标记“可下载”。只有完成签名、公证或真机测试的包，才可标注相应验证状态。新版 WebGPU 大模型在 AMD、Apple 和 NVIDIA 上的稳定性、商业额度及质量回归完成之前，应保持预览版标签。

如果在 lain42.top 建立软件下载页，建议链接到以上 Release 资产或可验证的官方镜像，并分别标识平台架构与状态，不要上传缺失或未经签名的 iOS 安装包。
