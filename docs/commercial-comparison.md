# /lyco 商业对比与优化决策（2026-09-12）

需求：沿用本地商品图旗舰方向，让卖家批量交付可靠、可复核，复用现有 Python/rembg，不重做模型。

| 候选 | gh 核验 | 适配与决策 |
|---|---|---|
| [rembg](https://github.com/danielgatis/rembg) | 24,695 stars；MIT；push 2026-09-08 | 已采用；继续复用推理/模型会话，补交付流程 |
| [backgroundremover](https://github.com/nadermx/backgroundremover) | 8,052 stars；MIT；push 2026-07-10 | 图像/视频 CLI；替换现有底座没有明确收益 |
| [bgbye](https://github.com/MangoLion/bgbye) | 563 stars；API license null；push 2024-07-12 | 参考界面与模型选择；授权未明确，不复制源码 |

仓库代码许可证不等于模型权重商用许可证。star 是关注度，不是付款或活跃使用证据。

[Photoroom](https://www.photoroom.com/pricing) 已有批量、修图、模板和不同导出额度方案。不要以“有抠图”作为差异；重点验证本地处理、可预期成本、交付可靠性。[remove.bg](https://www.remove.bg/pricing) 有批量与 API，云调用要计入单张成本。两者都不能作为本地离线嵌入式交付底座直接替换。

社区线索：[批量额度变化讨论](https://www.reddit.com/r/Flipping/comments/1op1gc0/photoroom_removing_bulk_background_from_prepaid/)、[批量丢失与返修反馈](https://www.reddit.com/r/Flipping/comments/1rt664m/photoroom_issues/)。这些是个别用户体验，不能外推市场规模或把旧价格当成现价；提示我们优先关注恢复、复核和稳定交付。

决策：extend 当前应用 + adopt rembg。当前没有证据证明替换整个应用能覆盖本地 SKU 交付需求的 80%；推理能力已经被现有依赖覆盖，不另建引擎。商业优势假设仍待卖家付费样批验证。

本轮最小优化：逐图确认、可选只导出已确认项、ZIP 内包含全部任务的 JSON 清单（原名/输出名/状态/是否复核/是否导出/失败原因/批次设置），便于发现漏图。默认仍可导出全部完成项，不强制逐图操作。清单不是机器质量保证。

商用标注修正：已安装 rembg/sessions/bria_rmbg.py 下载 bria-rmbg-2.0.onnx；[官方 RMBG-2.0 模型页](https://huggingface.co/briaai/RMBG-2.0) 声明非商业许可，商用需协议。移除“商业级”名称并显示来源链接；未替用户签约、购买或认定其已有授权。

2026-09-13：已实现浏览器内批次持久化、刷新恢复与多页面写入冲突保护，真实验证见 product-workflow-development.md。它仍不替代可迁移的项目备份。

后续优先级：P0 透明底稿及返修回写；P0 项目备份与异常恢复验证；P1 模型商用授权/替代权重核验；P1 安装成功率与耗时基准。卖软件和服务的试价必须覆盖安装支持、模型授权与持续维护，当前不承诺永久无限服务。
