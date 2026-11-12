# Rembg Studio 一键启动器（社区版 / 商用版）

同一个程序包内含两种版本，由服务端环境变量 `REMBG_EDITION` 决定；**界面上勾选不会授予权限**。
直接双击 `rembg-ui` / `rembg-ui.exe` 默认启动商用版（公开试用：每月 30 张、每批 10 张）。
想用免费且本地不限张数的社区版，请用本目录的启动器。

文件名故意用英文：Windows 不同语言版本解压中文名可能乱码；中文说明都在这里。

## 小白三步

1. 下载对应系统的安装包，**完整解压**（不能只复制一个 exe / 一个二进制）。
2. 把 `Rembg-UI-launchers.zip` 里对应系统的启动器复制到解压目录（与 `rembg-ui` / `rembg-ui.exe` 同级）。
3. 双击启动器 → 浏览器自动打开工作台 → 在「模型管理」里一键下载 U2Netp（首次需联网）→ 上传图片 → 去背景 → 下载透明 PNG。

| 系统 | 社区版（免费本地、不限张数） | 商用版（授权试用） |
| --- | --- | --- |
| Windows | 双击 `START-Community.bat` | 双击 `START-Pro.bat` |
| Linux | 运行 `START-Community.sh` | 运行 `START-Pro.sh` |
| macOS | 双击 `START-Community.command` | 双击 `START-Pro.command` |

Linux 首次使用先给执行权限：`chmod +x START-Community.sh`，或直接 `bash START-Community.sh`。
Windows 请勿关闭黑色命令行窗口；macOS / Linux 请勿关闭终端窗口，关掉即退出程序。
启动器会自动识别同目录的 `rembg-ui`、`Rembg-UI-linux-x86_64.AppImage` 或 `rembg-ui.app`；AppImage 在无 FUSE 时自动解包运行。

## 两个版本的区别（以服务端返回为准）

| | 社区版 Community | 商用版 Pro |
| --- | --- | --- |
| 本地推理额度 | 不限张数（`monthly_images: null`） | 公开试用每月 30 张 |
| 每批上限 | 10 张 | 10 张（试用档） |
| 授权 | 不需要 | Ed25519 离线授权 / 云计费（正式售卖尚未开放） |
| 默认模型 | U2Netp（宽松许可） | 可切换模型市场 |

商用版正式付费档（创作者版 / 小团队版）仍为实验定价，云计费未上线；`REMBG_HOSTED_PAID_MODE=1` 时会 **fail closed**（直接报错停用），不会偷偷按浏览器上报计费。

## AMD Radeon 780M / ROCm 加速包

Linux 用户如果是 AMD RDNA3 集显（如 Radeon 780M），下载 `Rembg-UI-linux-amd-rocm.tar.gz` 并先装 ROCm 用户态：

```bash
sudo pacman -S --needed rocm-hip-sdk migraphx rocminfo   # Arch / CachyOS
```

然后用同一个 `START-Community.sh` 启动，日志出现 `[GPU] Provider: MIGraphXExecutionProvider` 即生效。
首次运行会编译模型缓存（约 5 分钟、`~/.cache/rembg-ui-migraphx/*.mxr` 约 312MB），之后启动约 5 秒。
没有 ROCm 时程序自动回退 CPU，不会崩溃。详见 `docs/AMD-ROCM-GPU.zh-CN.md`。

## 技术预览声明

本 Release 是 **technical preview，不是正式可售版本**。合并闸门见 `docs/COMMUNITY-PRO-RELEASE-GATES.md`（8 条强制项仍未全部解除）；
Android 包未签名；AI 模型首次需单独下载；Windows / macOS 的 WebGPU 真机与全像素画质回归尚未完成。
