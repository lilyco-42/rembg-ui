# AMD ROCm / 780M GPU 加速（含 NPU 现状）

本项目的去背景主管线走 ONNX Runtime。默认发布包面向「有 NVIDIA 显卡或纯 CPU」的机器：
装的是 `onnxruntime-gpu`（CUDA EP，无 N 卡时自动回退 CPU），macOS 走 CoreML。
**AMD 核显/独显（如 Radeon 780M / gfx1103）需要另一个构建变体**：把 ORT 发行版换成
`onnxruntime-migraphx`，由 `MIGraphXExecutionProvider` 在 ROCm 上真正跑推理。

同一份应用代码 `gpu_providers.detect_providers()` 会自动识别当前环境实际可用的 EP，
按 **MIGraphX → CUDA → CoreML → CPU** 顺序选择，不需要用户改配置或勾选。

## 实测数据（本机 Ryzen 7 8845HS + Radeon 780M，u2netp 320×320，20 次）

| 方案 | 建会话 | p50 | p95 | 备注 |
| --- | --- | --- | --- | --- |
| CPU（ORT 1.26 默认发布包） | 0.1s | 153.6ms | 214.7ms | AVX512_VNNI |
| CPU（ORT 1.27.1） | 0.1s | 102.1ms | 110.0ms | 对照基线 |
| **MIGraphX 780M（冷编译）** | 338.9s | **63.1ms** | 86.0ms | 首次 u2netp 编译约 5 分半 |
| **MIGraphX 780M（命中缓存）** | **4.6s** | **60.4ms** | 64.4ms | 推荐常态 |

→ 相对同一版 CPU 约 **1.7×** 加速，且确实在 GPU 上执行（`get_providers()` 返回
`MIGraphXExecutionProvider`，不是静默回退 CPU）。

> **首次编译缓存很重要**：MIGraphX 是 AOT 编译执行，不设缓存首启会像卡死 5 分钟。
> 应用默认把编译结果放 `~/.cache/rembg-ui-migraphx`（`*.mxr`，约 312MB），
> 命中后建会话降到约 5 秒。可用 `REMBG_MIGRAPHX_CACHE_DIR` 改路径。
> 缓存与 GPU/驱动/ROCm 版本绑定，**不随发布包分发**，换机器或升级驱动后会自动重建。

## 小白使用步骤（Linux）

1. 安装 ROCm 用户态（系统级，一次即可）。Arch / CachyOS：
   ```bash
   sudo pacman -S --needed rocm-hip-sdk migraphx rocminfo
   ```
   Ubuntu/Debian 参考 AMD 官方 `repo.radeon.com/rocm/` 的 apt 源，装
   `rocm-hip-sdk` + `migraphx`；确认 `/opt/rocm/lib/libmigraphx_c.so.3` 存在、
   `ldconfig -p | grep migraphx` 能查到。
   验证：`/opt/rocm/bin/rocminfo` 能看到 `gfx1103 / AMD Radeon 780M`。
2. 下载本变体包 `Rembg-UI-linux-amd-rocm.tar.gz`，**完整解压到纯英文路径**，双击
   `rembg-ui` 即可，浏览器会自动打开。无需 Python、无需 pip、无需配环境变量。
3. 启动日志出现 `[GPU] Provider: MIGraphXExecutionProvider` 即已点亮 780M；
   显示 `CPUExecutionProvider` 说明缺 ROCm 运行库（已自动回退，功能照常可用）。
4. 第一次点「去背景」请耐心等 3~6 分钟（编译模型）；之后每次都是秒级。

Windows AMD 卡请用默认包（DirectML 未接入）；NVIDIA 卡用默认包走 CUDA；
macOS 用默认包走 CoreML。**AMD 变体只在 Linux 有意义。**

## 从源码构建本变体

两个 ORT 发行版共享 `onnxruntime/capi` 目录，**绝不能共存**，必须用
`--no-install-package onnxruntime-gpu` 排除 CUDA 版：

```bash
uv sync --extra amd --no-install-package onnxruntime-gpu
uv run python build_nuitka.py release
# 产物：dist/rembg-ui.dist/；把整个目录打成 tar.gz 分发
```

`build_nuitka.py` 的 `_bundle_ort_providers()` 会把
`libonnxruntime_providers_migraphx.so` 等运行期 dlopen 的 EP 库补进产物
（Nuitka 的依赖追踪看不到它们）。ROCm 用户态本身属系统库，需用户预先安装。

## NPU（XDNA / RyzenAI）现状

本机 `/dev/accel0` + `amdxdna` 内核模块 + `rocminfo` 的 `aie2 / RyzenAI-npu1`
Agent 都在，但 **ONNX Runtime 没有可用的 NPU ExecutionProvider**：
需要 AMD Ryzen AI 软件栈（XRT + VitisAI EP / `vaip` / `onnxruntime-vitisai`），
本机未安装，系统 ORT 1.29 与 AMD 变体 ORT 1.27.1 的
`get_available_providers()` 都只列出 MIGraphX / CPU（+Dnnl），没有 VitisAI/QNN。
因此当前 NPU 无法用于本应用推理，属「硬件在、软件栈缺」，不是应用 bug。
后续若要接入，需要单独提供 Ryzen AI SDK 与匹配的 ORT 发行版，再在本模块加
`VitisAIExecutionProvider` 分支。

其它不适用：TensorRT/CUDA（需 NVIDIA）、DirectML/QNN（Windows/Qualcomm）、
CoreML/ANE（Apple）、OpenVINO（Intel，本项目未装 `onnxruntime-openvino`）、
ARM NN / XNNPACK（移动端，Android 走 TFLite/NNAPI 另行评估）。
