# Rembg Studio Android

这是 Rembg Studio 的原生 Android 端侧入口。图片和模型在应用进程内处理，不依赖桌面服务；从系统相册选择图片、处理完成后点预览即可在原图与结果之间切换，结果保存到系统「下载」目录。原生端同时支持系统分享接收、最多 10 张的顺序批处理和带 `delivery-manifest.json` 的 ZIP 导出。

## 支持范围

- Android 10（API 29）及以上，target SDK 35。
- `arm64-v8a`（主流手机）、`armeabi-v7a`（旧设备）和 `x86_64`（模拟器/部分 ChromeOS）。
- 首次安装内置 `u2netp` 轻量模型；其他模型从模型面板按需下载到应用私有目录。
- 图片解码在后台线程执行；按设备 memory class 将最长边限制为 1280 / 1536 / 2048，避免高像素相册图直接耗尽内存。
- ONNX Runtime 单线程间调度、按设备内存上限限制算子线程；连续处理失败时不会覆盖上一张结果。
- 批处理逐张解码、推理、写入应用缓存后立即回收 Bitmap，不把整批原图或结果同时留在堆中；处理中可停止，重启应用会恢复 URI、状态和仍存在的结果文件。
- 支持从相册或其他应用接收一张/多张图片；结果可保存到 Downloads 或通过系统分享面板发送，不需要申请存储权限。
- 原生端批次输出为透明 PNG，完整的白底/浅灰规格合成、修边和项目备份仍由桌面端与 WASM/PWA 工作台提供。
- 工具栏「授权与额度」可粘贴购买页签发的 `ol1` 令牌；应用内置公钥在本地验证 Ed25519 签名，成功推理按月扣减本机额度，失败会回滚。令牌、安装摘要和额度只保存在应用私有存储，不上传原图，也不包含支付密钥。

## 本地构建

在 `android/` 目录执行（需要 JDK 17 和 Android SDK 35）：

```powershell
./gradlew.bat :app:assembleDebug
./gradlew.bat :app:assembleRelease :app:bundleRelease
```

没有注入签名属性时，release 会生成三个 ABI 拆分的 `*-release-unsigned.apk` 和一个 unsigned AAB。这样可以验证可复现构建，也不会把开发者 debug 证书误当成商业签名。

安装后流程：点击「批量选图」选择 1–10 张 →「处理批次」逐张运行 →「导出 ZIP」写入系统 Downloads。每次处理只保留当前图片的 Bitmap，低内存设备可优先使用内置 `u2netp`；批次中失败项会保留在清单中，重新点击「处理批次」只重试未完成项。

工具栏的「购买专业版」会打开积分购买页；原生端不在 APK 内保存支付密钥或管理员凭据。付款和授权签发仍由服务端完成，Android 与桌面端使用同一 `ol1` 公钥校验格式。Android 的月度账本是离线本机计量，删除应用数据可以重置，跨设备汇总、即时撤销和退款仍由托管服务负责。

离线令牌校验使用 `net.i2p.crypto:eddsa`（Apache-2.0）；发行包应在商店「开放源代码许可」页或随包提供对应许可证文本。

## 商业发布签名

签名只通过 Gradle 属性注入，不提交 keystore、密码或私钥。设置以下属性后，release 变体使用 `commercialRelease`：

```text
REMBG_RELEASE_STORE_FILE
REMBG_RELEASE_STORE_PASSWORD
REMBG_RELEASE_KEY_ALIAS
REMBG_RELEASE_KEY_PASSWORD
```

GitHub Actions 使用加密 secret `REMBG_ANDROID_KEYSTORE_BASE64`（以及四个 `REMBG_RELEASE_*` secret）时会自动解码 keystore；未配置 secret 则保留 unsigned 产物并在构建日志标明。签名 key 的轮换和 Play App Signing 由发行方账户负责。

正式发行时从 `Build & Release` workflow 选择 `require_signed=true`；没有完整签名 secrets 时该任务会直接失败，不会生成可被误认作正式包的 Android 资产。

## 发行产物

`.github/workflows/build.yml` 的 `build-android` job 与 Windows/Linux/macOS 共享同一版本 tag，上传：

- `Rembg-UI-android-arm64-v8a.apk`
- `Rembg-UI-android-armeabi-v7a.apk`
- `Rembg-UI-android-x86_64.apk`
- `Rembg-UI-android.aab`

直接安装时按设备 ABI 选择 APK；Google Play 使用 AAB。没有完成签名配置前，不把 unsigned 包标成面向终端用户的正式商业安装包。
