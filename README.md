# Rembg Studio

基于 AI 的图像背景去除 + 智能抠图工具。**纯后端架构**：FastAPI 只提供服务，UI 由浏览器加载，一套前端同时适配桌面与手机。

## 功能

| 功能 | 说明 |
|------|------|
| **Rembg 去背景** | 一键去除图片背景，支持多种模型 |
| **SAM 智能抠图** | MobileSAM 点选分割，正点/负点精确控制 |
| **自动检测** | 一键识别图中所有物体，选中最需要的遮罩 |
| **剔除优化** | 结果图上直接点击多余区域，自动加负点重跑 |
| **裁剪旋转** | 预处理工具：拖拽裁剪、90° 旋转、任意角度 |
| **批量抠图** | 多图排队处理，一次下载全部结果 |
| **手机访问** | 同一 WiFi 扫码即用，触屏可直接框选/点选/涂画 |

## 架构

```
┌─────────────── 后端（FastAPI，仅提供服务）──────────────┐
│  rembg / MobileSAM 抠图 API       前端静态资源（单文件）│
└──────────────────────────┬───────────────────────────────┘
                           │  http://127.0.0.1:8042
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   桌面浏览器          手机浏览器          远程设备
  （自动打开）      （同一 WiFi 扫码）   （tailscale/frp 等）
```

- **后端**：Python + FastAPI + Uvicorn，无任何原生窗口 / pywebview 依赖
- **前端**：单文件 HTML（原生 CSS/JS），移动端响应式 + 触屏交互
- 后端启动后自动打开本机浏览器；手机/远程设备通过浏览器访问

## 使用方式

### 从源码运行

```bash
# 需要 Python 3.10+，推荐用 uv
uv sync
uv run python main.py
```

启动后自动打开浏览器 `http://127.0.0.1:8042`。首次运行会自动下载模型，请保持网络连接。

### 手机 / 局域网访问

默认只监听 `127.0.0.1`（仅本机）。想让手机（iOS/Android）访问，二选一：

```bash
uv run python main.py --lan            # 一键开启局域网访问
# 或
REMBG_HOST=0.0.0.0 uv run python main.py
```

开启后：

1. 桌面浏览器里点左下角 **「📱 手机连接」**，会弹出二维码
2. 手机浏览器扫码，或直接输入二维码下方的地址（如 `http://192.168.1.23:8042`）
3. 手机端界面自动适配，SAM 框选 / 点选 / 画笔均支持触屏操作

> ⚠️ 监听 `0.0.0.0` 表示同一局域网内任何设备都能调用本工具，请仅在可信网络中使用。

### 公网访问（可选）

局域网之外（如出差时从手机连家里的电脑），需配合内网穿透，任选其一：

- **Tailscale**：两端装客户端，登录后手机浏览器访问 `http://<tailscale-ip>:8042`
- **frp / ngrok**：把本地 `8042` 端口暴露到公网域名，手机浏览器访问该域名

这些工具只做「隧道」，后端本身无需改动；建议绑定 `0.0.0.0` 后配合穿透使用。

### 直接下载

- **Windows**：从 [Releases](https://github.com/lilyco-42/rembg-ui/releases) 下载 `Rembg-UI-windows.zip`，解压运行 `rembg-ui.exe`
- **Linux**：下载 `Rembg-UI-linux.tar.gz`，解压后运行 `./rembg-ui.bin`
- **macOS**：下载 `Rembg-UI-macOS.dmg`（或 `.app` 压缩包），拖入「应用程序」运行

> macOS 未签名应用首次打开如提示「无法验证开发者」，右键 → 打开 即可；或用 `xattr -dr com.apple.quarantine "Rembg Studio.app"` 解除隔离。

## 工作流

### 一键去背景

```
拖入图片 → 选择模型 → 点击「开始抠图」→ 保存
```

### SAM 精准抠图（抠衣服、物体）

```
① 拖入图片 → 切换到「SAM 抠图」模式
② 点「载入到 SAM」
③ 选工具：▭ 框选 / ✏ 画笔 / ◉ 点选
④ 应用 → 浏览候选遮罩，选中结果
⑤ 结果图上点多余区域自动剔除
⑥ 满意后保存
```

> 桌面端：框选用**右键拖拽**；移动端：直接用手指在图上框选 / 涂画 / 点选。双击可缩放，缩放后可单指拖动平移。

### 先裁剪再处理

```
拖入图片 → 工具栏点「裁剪」→ 拖拽选区 → Enter 确认 → 再执行去背景或 SAM 抠图
```

## SAM 模式说明

SAM（Segment Anything Model）是 Meta 开源的分割模型，本工具使用 **MobileSAM** 轻量版本，CPU 即可运行。

- 首次使用自动下载模型 `mobile_sam.pt`（~40MB）
- 支持正点（前景）和负点（背景）组合
- 自动检测模式下最多输出 26 个候选遮罩
- 结果图点击自动转换为负点，即时优化

## 技术栈

- **后端**: Python + FastAPI + Uvicorn
- **前端**: 原生 HTML/CSS/JS（无框架依赖，响应式 + 触屏）
- **去背景**: rembg (BRIA-RMBG / BiRefNet / U²-Net)
- **分割**: MobileSAM (via ultralytics)
- **打包**: Nuitka（Windows / Linux）、PyInstaller（Windows）

## 打包

各平台由 `build_nuitka.py` 按系统自动生成对应应用格式（Windows `rembg-ui.exe` / Linux `rembg-ui.bin` / macOS `rembg-ui.app` 并附带 `.dmg`）：

```powershell
# Windows - Nuitka（产物 dist/rembg-ui.dist/rembg-ui.exe）
.\nuitka.ps1
# Windows - PyInstaller（备用）
.\pyinstaller.ps1
```

```bash
# Linux - Nuitka（产物 dist/Rembg-UI-linux.tar.gz）
./build_nuitka_linux.sh
```

```bash
# macOS - Nuitka（产物 dist/rembg-ui.app + dist/Rembg Studio.dmg，需在 macOS 上执行）
uv run python build_nuitka.py release
```

CI 会在打 `v*` tag 时构建 Windows / Linux / macOS 三平台产物并发布到同一 Release（见 `.github/workflows/build.yml`，Linux/macOS 仅在打 tag 或手动触发时运行）。

## 项目结构

```
rembg-ui/
├── main.py                  # 应用入口 + API 路由（启动、浏览器、模型、抠图、SAM、网络）
├── sponsor/                 # 赞助与教程模块（FastAPI Router + 前端注入）
├── processors/              # 处理器模块
│   ├── sam_processor.py     # MobileSAM 分割
│   ├── fastsam.py           # FastSAM（备用）
│   └── cloth_seg.py         # 服装解析（备用）
├── frontend/                # 前端静态资源
│   └── index.html           # 单文件 UI（响应式 + 触屏 + 内嵌离线二维码）
├── build_nuitka.py          # Nuitka 跨平台构建脚本（按平台生成参数）
├── build_nuitka_linux.sh    # Linux Nuitka 打包 + 压缩
├── nuitka.ps1               # Windows Nuitka 打包脚本
├── pyinstaller.ps1          # Windows PyInstaller 打包脚本
└── pyproject.toml           # 项目配置（uv）
```
