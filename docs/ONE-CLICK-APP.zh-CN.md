# Rembg Studio 小白一键使用（技术预览）

## 下载后怎么用

1. 从 [多平台下载页面](https://lain42.top/downloads/rembg-ui/index.html) 选择系统的正确安装包。Windows ZIP、Linux tar.gz 等桌面包必须完整解压，不能只复制其中一个可执行文件。
2. 双击启动 Rembg Studio。程序自动打开浏览器工作台，无需手动创建 Python 虚拟环境。
3. 初次启动在左侧的「模型管理」卡片检查模型，推荐 U2Netp 轻量通用模型。若未安装，点击「一键下载」；需要互联网访问模型官方源。
4. 上传图片，点击「去背景」，处理成功后下载透明 PNG。模型已下载后，普通 CPU 推理可以离线使用。
5. 需要高级模型可切换下拉框。部分模型需要从权利人处获得模型文件和相应授权，再手动放入模型目录。

## UI 组件

本次新增模型管理卡片基于 **Bootstrap 5.3.8**（MIT License），使用 Shadow DOM 隔离样式，避免破坏原编辑器。生产构建将 Bootstrap CSS 直接打进安装包，不需要联网调用 CDN。请在正式发行时保留第三方许可证声明。

## 注意

- 「下载即用」指安装包内已包含运行程序和 UI，**AI 模型首次需要单独下载**；不是完全零下载或完全离线首次运行。
- 没有通用的模型官方下载保证，个别上游源可能失效或限制访问。下载失败可通过模型目录手动导入。
- WebGPU 大模型推理仍是实验功能，默认关闭；当前普通模型走现有 CPU/ONNX 推理路径。
- 本次更新尚未验证所有平台的完整下载安装与图形化使用流程，不应标注为已完成正式发布。

## 社区版 / 商用版一键启动器（推荐）

同一个程序包含两种版本，由服务端环境变量 `REMBG_EDITION` 决定；直接双击主程序默认是**商用版公开试用**（每月 30 张、每批 10 张）。想用**免费、本地不限张数**的社区版，请用一键启动器，不必手敲命令：

1. 从 Release 下载 `Rembg-UI-launchers.zip`，解压到程序目录（与 `rembg-ui` / `rembg-ui.exe` 同级）。
2. Windows 双击 `START-Community.bat`、Linux 运行 `START-Community.sh`、macOS 双击 `START-Community.command`；商用版把 `Community` 换成 `Pro`。
3. 浏览器自动打开后，其余步骤与上面的五步一致。

启动器源码与完整说明见仓库 `launchers/README.zh-CN.md`（含 AMD ROCm 加速包用法、两版额度对照、技术预览声明）。文件名用英文是为避免 Windows 各语言版解压中文名乱码。

> 本页与 `launchers/README.zh-CN.md`、Release 说明一致：当前为 **technical preview**，不是正式可售版本；8 条强制合并闸门见 `docs/COMMUNITY-PRO-RELEASE-GATES.md`。
