# Rembg Studio

基于 AI 的图像背景去除 + 智能抠图桌面工具。支持一键去背景、SAM 精准分割、裁剪旋转预处理。

## 功能

| 功能 | 说明 |
|------|------|
| **Rembg 去背景** | 一键去除图片背景，支持多种模型 |
| **SAM 智能抠图** | MobileSAM 点选分割，正点/负点精确控制 |
| **自动检测** | 一键识别图中所有物体，选中最需要的遮罩 |
| **剔除优化** | 结果图上直接点击多余区域，自动加负点重跑 |
| **裁剪旋转** | 预处理工具：拖拽裁剪、90° 旋转、重置原图 |
| **模型管理** | 内置模型目录管理，自动下载 |

## 使用方式

### 从源码运行

```bash
# 1. 安装 Python 3.10+
# 2. 安装依赖
pip install -r requirements.txt

# 或者用 uv（推荐）
uv sync

# 3. 运行
python main.py
```

### 直接下载（Windows）

从 [Releases](https://github.com/lilyco-42/rembg-ui/releases) 下载最新版 `rembg-ui-v*.zip`，解压运行 `main.exe`。

首次运行会自动下载模型文件，请确保网络连接。

## 工作流

### 一键去背景

```
拖入图片 → 选择模型 → 点击「开始抠图」→ 保存
```

### SAM 精准抠图（抠衣服、物体）

```
① 拖入图片 → 切换到「SAM 抠图」模式
② 点「载入到 SAM」
③ 点「自动检测全部物体」→ 浏览候选遮罩
④ 选中最像的候选
⑤ 结果图上点击多余区域自动剔除
⑥ 满意后保存
```

### 先裁剪再处理

```
拖入图片 → 工具栏点「裁剪」→ 拖拽选区 → Enter 确认
→ 再执行去背景或 SAM 抠图
```

## SAM 模式说明

SAM（Segment Anything Model）是 Meta 开源的分割模型，本工具使用 **MobileSAM** 轻量版本，CPU 即可运行。

- 首次使用自动下载模型 `mobile_sam.pt`（~40MB）
- 支持正点（前景）和负点（背景）组合
- 自动检测模式下最多输出 26 个候选遮罩
- 结果图点击自动转换为负点，即时优化

## 技术栈

- **后端**: Python + FastAPI + Uvicorn
- **前端**: 原生 HTML/CSS/JS（无框架依赖）
- **桌面**: pywebview（系统 WebView2）
- **去背景**: rembg (BRIA-RMBG / BiRefNet / U²-Net)
- **分割**: MobileSAM (via ultralytics)
- **打包**: Nuitka（可选）

## 项目结构

```
rembg-ui/
├── main.py                  # 应用入口 + API 路由
├── processors/              # 处理器模块
│   ├── sam_processor.py     # MobileSAM 分割
│   ├── fastsam.py           # FastSAM（备用）
│   └── cloth_seg.py         # 服装解析（备用）
├── frontend/                # 前端静态文件
│   ├── index.html           # 主界面
│   ├── wechatpay.png        # 赞助二维码
│   └── alipay.png
├── sponsors/                # 赞助配置
├── nuitka.ps1               # Nuitka 打包脚本
└── pyproject.toml           # 项目配置
```
