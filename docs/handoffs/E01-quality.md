# E01：商品样本与质量验收包（可直接转发）

你负责 rembg-ui 的质量资料，不负责模型或代码。基线 88646de，当前使用 U2Netp 浏览器推理、10 张批次、原图对比和 ZIP。项目多人协作，不能覆盖他人修改。

仅可写 `docs/quality/`。第一阶段先交 5 条有公开来源和明确使用条件的候选样本记录；无法取得许可的样本只留链接，不能下载、转传或冒充可用数据。得到用户许可再收集实际图片。不要联系作者或客户。

交付：
1. `sample-register.csv`：sample_id、source_url、author、license_url、permission_status、category、difficulty、local_path。至少覆盖白底白物、细毛/纤维、透明/反光、复杂背景；不知道的字段留空并注明。
2. `acceptance.md`：对每张查看主体是否完整、背景是否残留、边缘是否明显光晕、颜色/尺寸是否正确；记录直接可用/需返修/失败，不伪造人工评价。
3. `results-template.csv`：sample_id、model、browser_version、device、cold_load_ms、infer_ms、review_outcome、repair_minutes、notes。没有实际运行就交空模板，不填估计数。

验收：来源可打开、许可链接与图片对应、每条状态可追溯；不能用模型仓库代码许可证推断所有示例照片权利。先交 5 条记录供审核，再扩展到 30 条，不需要一次产出长篇市场报告。

回报格式：任务 ID、修改文件、资料来源、实际做过的验证、未验证项目。禁止改 web/、安装依赖、push 或发布。
