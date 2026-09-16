# 商品样本授权证据模板

这是空白记录模板，不是样本清单，也不代表任何图片已获许可。只有在来源、权利人和使用范围能够相互对应，并且证据已由指定审核人复核后，才可把样本状态写成 `verified`。未收集图片、许可缺失或许可范围不清时，只保留链接和空字段；不得下载、复制、上传或用于抠图验收。

## 单样本记录

每张图片使用一个稳定的 `sample_id`。下面的字段可以作为 `sample-register.csv` 的补充证据卡；CSV 中没有对应列的内容写入 `notes`，不要另造一条无法追溯的记录。

`sample-register.csv` 的首行保持交接约定的最小字段：

```csv
sample_id,source_url,author,license_url,permission_status,category,difficulty,local_path
```

建议把本模板中的 `image_url`、`permission_scope`、`permission_evidence`、`evidence_checked_at`、`restrictions`、`sha256` 和 `reviewer` 追加到同一行的 `notes`，或放入同名证据卡；两处的 `sample_id` 必须一致。

| 字段 | 填写规则 | 空白/未确认时填写 |
| --- | --- | --- |
| `sample_id` | 稳定且唯一，例如 `S001`；不要用作者姓名或文件名代替 | 不创建记录 |
| `source_url` | 可打开的原始页面 URL；记录页面标题和访问日期 | `candidate_only` |
| `image_url` | 图片在原始页面中的直接定位信息；仅记录，不下载 | 留空 |
| `author` | 页面标示的作者或权利人；不从文件名、模型仓库或转载者猜测 | `unknown` |
| `license_url` | 与该图片对应的许可全文或平台条款 URL | `missing` |
| `license_name` | 许可名称及版本；没有明确名称时不要自拟 | `unclear` |
| `permission_status` | 只能填写 `verified`、`pending`、`unclear`、`denied` 或 `not_collected` | `not_collected` |
| `permission_scope` | 逐字概括允许的用途：内部测试、商业使用、修改、再分发等 | `unknown` |
| `permission_evidence` | 许可页 URL、用户提供的授权文件名，或双方已有书面授权的存档标识；不得填写推测 | `none` |
| `evidence_checked_at` | 审核人实际打开并核对证据的日期（YYYY-MM-DD） | 留空 |
| `attribution_required` | `yes` / `no` / `unknown`，只依据许可文本 | `unknown` |
| `restrictions` | 商用、修改、再分发、署名、衍生品等限制；原文不清时保留不确定性 | `unknown` |
| `local_path` | 只有用户已提供或授权后实际收集的本地文件才填写 | `NOT_COLLECTED` |
| `sha256` | 仅对已合法取得的本地文件计算；用于证明测试文件和记录对应 | 留空 |
| `category` | `white_on_white`、`hair_fiber`、`transparent_reflective` 或 `complex_background` | `unknown` |
| `difficulty` | `low` / `medium` / `high`，由验收人依据画面记录 | `unrated` |
| `reviewer` | 实际审核证据和图像的人 | 留空 |
| `notes` | 写明证据缺口、归档位置、人工质量观察和后续动作 | `not verified` |

## 证据核对顺序

1. 只打开候选来源页面，记录 `source_url`、页面标题、作者标示和访问日期。来源能打开不等于图片有使用许可。
2. 打开与该图片对应的许可全文或平台授权条款，确认许可覆盖的具体图片，而不是只覆盖代码、模型权重或整个网站的其他内容。
3. 逐项核对测试所需范围：本地下载/保存、内部或商业测试、裁剪/抠图/生成派生文件、交付给客户、再分发结果，以及是否需要署名。任一项无法确认，状态保持 `unclear` 或 `pending`。
4. 将许可页 URL 或用户提供的授权文件标识写入 `permission_evidence`，同时记录审核日期和审核人。直接授权必须有可保存、可复核的书面证据；没有证据就不能写 `verified`。
5. 只有 `permission_status=verified` 且 `local_path` 指向合法取得的本地文件时，才把样本加入浏览器验收。为避免误用，候选链接不能作为本地文件路径。
6. 若许可后来被撤回、链接失效、权利人不明或范围发生变化，将状态改为 `pending`/`unclear`，停止使用该样本，并在 `notes` 留下变更日期和原因。

## 状态判定

| 状态 | 可以做什么 | 不能宣称什么 |
| --- | --- | --- |
| `verified` | 按记录的范围使用已合法取得的本地文件，并把证据路径带入试用记录 | 不扩大到许可未覆盖的再分发、客户数据或其他图片 |
| `pending` | 保留候选链接，等待许可或审核 | 不能下载、处理、导出或计入样本通过率 |
| `unclear` | 记录缺口，寻找已有证据 | 不能把公开可见、可下载或带水印误当作可用许可 |
| `denied` | 保留拒绝记录以避免重复使用 | 不能使用该图片或其处理结果 |
| `not_collected` | 只能说明尚未收集 | 不能宣称已有样本验收或商业质量结论 |

四类最低目标样本（白底白物、细毛/纤维、透明/反光、复杂背景）都要逐张有证据；用户另指定的品类另行追加。缺少任何最低类别、许可状态不是 `verified`、或 `local_path=NOT_COLLECTED` 时，样本质量结论写 `unverified`；不能用其他类别或软件链路测试替代。

## 记录示例（占位，不是事实）

下面仅展示格式，所有值均不可直接复制为真实记录：

```text
sample_id=S000
source_url=<候选来源页面>
image_url=<页面内定位>
author=<页面标示的权利人或 unknown>
license_url=<对应许可全文或 missing>
permission_status=not_collected
permission_scope=unknown
permission_evidence=none
local_path=NOT_COLLECTED
category=unknown
notes=not verified; 未取得图片，不下载不处理
```
