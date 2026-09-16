# Rembg Studio 平台矩阵

这张表把“代码能构建”“可以安装”和“已经完成商业质量验收”分开。不同入口共享商品图工作流的规格和交付概念，但推理引擎、设备限制和授权接入并不完全相同。

| 平台 | 构建入口 | 交付格式 | 当前能力 | 商业放行前仍要测 |
|---|---|---|---|---|
| Windows x64 | `build_nuitka.py` / `nuitka.ps1` | `Rembg-UI-windows.zip` | 完整桌面工作台、SAM、批次、离线授权 | Windows 目标设备压力、显卡/CPU 变体、签名安装包 |
| Linux x64 | `build_nuitka.py` / `build_nuitka_linux.sh` | `Rembg-UI-linux.tar.gz` | 完整桌面工作台、CPU/GPU 变体 | 发行版依赖、显卡驱动、桌面会话 |
| macOS arm64（CI）/ x64（本地） | `build_nuitka.py` | `.app.zip` | 完整桌面工作台；CPU/系统后端按平台选择 | Apple Silicon/Intel 真机、未签名提示、公证与签名 |
| Android arm64-v8a / armeabi-v7a / x86_64 | `android/gradlew` | ABI 拆分 APK + AAB | 原生端侧单图与最多 10 张顺序批处理、原图/结果切换、系统分享接收、可停止与重启恢复、ZIP 清单导出、模型按需下载、`ol1` 公钥离线授权和本机月度额度 | 真机耗时、峰值内存、相册分享、后台切换和签名安装；本机额度不能替代跨设备托管计量 |
| Android 移动浏览器 | `web/npm run build` | 可安装 PWA | 浏览器 WASM 批次、原图对比、规格合成、ZIP；首载后可缓存运行时/模型 | 多浏览器触控、存储配额、弱网/离线恢复和长批次 |
| iOS / iPadOS 浏览器 | `web/npm run build` | Safari PWA/网页 | 同上，受 Safari WASM、内存和文件系统限制 | iPhone/iPad 真机、后台回收、文件导出 |
| GitHub Pages | `web/build.mjs` | 静态站点 | 免费公开演示，不上传原图 | 只作为演示；不能把 Pages 状态当作付费授权或托管推理 |

## 暂不宣称的原生目标

- Windows ARM64、Linux aarch64：Python、ONNX Runtime 和 MobileSAM 的发行 wheel/本地依赖尚未形成稳定的交叉构建链。用户可以先用 Android 或移动浏览器入口；需要真实设备和依赖证据后再排期。
- 原生 iOS、HarmonyOS：需要 Swift/ONNX Runtime Mobile 或 ArkTS/NAPI 壳，不能由当前 Python 桌面包直接交叉编译。现阶段先提供浏览器/PWA，避免把未验证的二进制标为可发行产品。

## CI 和签名

`.github/workflows/android-ci.yml` 在 Android 目录或 PR 改动时快速编译 debug 与 unsigned release，便于移动端回归；`.github/workflows/build.yml` 的 `build-android` job 与桌面 job 复用同一版本 tag，构建三个 ABI APK 和 AAB。没有 `REMBG_ANDROID_KEYSTORE_BASE64` 等 secrets 时，CI 仍会上传 unsigned 产物用于安装测试；配置签名后才适合上传 Play Console。CUDA 桌面变体只在手动运行工作流并勾选 `include_cuda` 时启用，因为它可能超过 GitHub Release 的单资产大小限制。Android 具体属性、内存策略和本地命令见 [`android/README.md`](../android/README.md)。
