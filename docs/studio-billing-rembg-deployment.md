# lain42.top 商业化部署记录

日期：2026-09-16。Rembg Studio 复用服务器已有的 `studio-billing`，没有另起支付服务。

## 已上线的入口

- 购买页：`https://lain42.top/sub/buy.html`
- 运营控制台：`https://lain42.top/sub/admin.html`（管理员密码换取 8 小时 Bearer 会话，页面 `noindex`，密码不写入前端）
- 产品接口：`https://lain42.top/studio/api/products`
- 健康检查：`https://lain42.top/studio/api/health`
- Rembg 验证公钥：`https://lain42.top/studio/api/rembg/public-key`
- 现有服务：systemd `studio-billing.service`，本机 `127.0.0.1:4700`
- 反代：Pingap `/studio/api/` → `127.0.0.1:4700`

## 产品映射

| 产品码 | Rembg 套餐 | 积分价 | 参考价 | 权益有效期 |
|---|---|---:|---:|---:|
| `rembg_creator` | `creator` | 420 分 | 约 ¥29 | 30 天 |
| `rembg_studio` | `studio` | 1450 分 | 约 ¥99 | 30 天 |

Rembg 的默认购买方式是积分兑换，USDT 只负责充值积分；代理、游戏和旧订单仍可走 USDT / 卡密。订单、卡密兑换和管理员手工发放沿用现有 `billing.db`。发放 Rembg 产品时，服务端用 `/opt/studio-billing/keys/rembg-private.key` 签出 `ol1`；私钥权限为 600，从不通过 API 返回。桌面包内置的公钥为 `license_config.py` 中的 `rembg-2026`，公钥接口只返回验证所需信息。

## 运营流程

1. 用户在购买页注册/登录，点击“USDT 兑换积分”，填写 1–1000 USDT；系统创建带唯一尾数的 TRC20 充值订单。
2. watcher 每 30 秒查询 TRC20 交易；充值订单变为 `paid` 后，以链上交易号为幂等引用写入积分账本。
3. 用户选择 Rembg 套餐并点击“用积分兑换”。服务端在同一 SQLite 事务内扣分、签出 30 天 `ol1`、写入已支付兑换订单；余额不足或签发失败都会回滚。
4. 用户在“我的权益”点击“复制授权”，下载 [Releases](https://github.com/lilyco-42/rembg-ui/releases) 的桌面版，把令牌粘贴到工作台。
5. 换机或退款暂时由运营方重新签发/停用处理；离线文件在下一次在线校验前不能即时感知撤销，不能把当前版本描述成完整的自动退款系统。

购买页现在会在提交、处理中、成功/失败和订单到账时显示持久状态卡与短时 Toast；提交中的按钮会锁定，成功兑换的按钮会变为“已兑换 · 查看权益”。浏览器会为每个套餐保存会话级引用，服务端另外对无引用的旧客户端启用 5 分钟内同账号同套餐已支付订单保护，重复点击只返回原订单，不再次扣分。被运营方补回积分的重复订单会在权益列表显示“已撤销”，不再提供可复制的失效授权。

watcher 已使用 `pending → processing → paid` 的原子事务：同一笔交易再次轮询时不会重复签发；签名或写库失败会回滚到 `pending`，由下一轮重试。交易匹配仍按试验通道的金额窗口工作，正式经营前要改为订单唯一备注/回调并保留完整的幂等账本。

## 积分接口

积分与支付分离，使用整数账本；积分兑换会生成 `payment_method=points` 的已支付 Rembg 订单，USDT 充值订单只有链上确认后才会入账：

- `GET /studio/api/points`：登录用户查询余额和最近流水。
- `POST /studio/api/points/consume`：登录用户消费积分，JSON 为 `{ "points": 125, "reason": "商品图测试消耗", "reference": "job-001" }`；引用号可安全重试，余额不足返回 400。
- `POST /studio/api/points/topup`：登录用户创建 USDT 充值积分订单，JSON 为 `{ "usdt": "10" }`（也可传整数 `points`）；兑换比例为 `1 USDT = 100 分`，单笔 1–1000 USDT，链上确认后自动入账。
- `POST /studio/api/points/purchase`：登录用户兑换 Rembg 授权，JSON 为 `{ "product": "rembg_creator", "reference": "可选的客户端引用" }`；创作者版 420 分，小团队版 1450 分，扣分与 `ol1` 签发在一个事务中完成。
- `POST /studio/api/admin/points/grant`：管理员加分，JSON 为 `{ "username": "lilyco42", "points": 1000, "reason": "封闭测试额度", "reference": "admin-test-lilyco42-20260916-v1" }`，通过 `X-Admin-Token` 认证。
- `GET /studio/api/admin/points/{username}`：管理员查看指定账号余额和流水。

运营控制台使用 `POST /studio/api/admin/login` 换取 8 小时短期会话，之后以 `Authorization: Bearer <token>` 调用管理接口；旧的 `X-Admin-Token` 入口继续保留给脚本。控制台提供概览、精确账号查询、积分发放、用户密码重置、卡密生成、订单筛选、积分订单退款/授权撤销和审计查看。退款在服务端事务内完成，积分订单使用 `refund:<order_no>` 幂等引用补回积分并撤销匹配授权；积分充值订单不会由页面自动退款，必须人工核对链上入账后处理。

账本表为 `points_accounts` 与 `points_ledger`；每笔记录保存变更量、变更后余额、原因、引用号和时间。USDT 充值、积分兑换和管理员加分都使用幂等引用，重复回调不会重复入账或重复签发。

## 密钥轮换与回滚

- 轮换时在服务器生成新密钥，设置新的 `REMBG_OFFLINE_KEY_ID`，把新公钥写入 `license_config.py` 后再构建发行包；旧发行包需要在过渡期继续接受旧 key id，因此生产代码应扩展为公钥集合后再切换。
- 本次部署前备份位于 `/opt/studio-billing/backups/rembg-commercial-20260916-103830/`，含 `app.py`、`.env`、`billing.db`、购买页和 README。
- 幂等修复前的线上代码另存为该目录下的 `app.py.before-idempotency`；当前线上 `app.py` SHA-256 为 `b236ee1202f9e622b9f1e9b8143dfa1efebcfa2181714d003b5f6d4bc4974752`。
- 积分接口部署前备份位于 `/opt/studio-billing/backups/rembg-commercial-20260916-1235-points/`。
- 积分兑换上线前备份位于 `/opt/studio-billing/backups/rembg-commercial-20260916-points-exchange/`。
- 请求体校验补丁上线前备份位于 `/opt/studio-billing/backups/rembg-commercial-20260916-points-exchange-v2/`。
- 首页积分提示上线前备份位于 `/opt/studio-billing/backups/rembg-commercial-20260916-points-exchange-v3/`。
- 购买反馈与无引用重复兑换保护上线前备份位于 `/opt/studio-billing/backups/rembg-commercial-20260916-points-exchange-v4/`；该备份包含当前账本（含重复点击退款记录）。
- 无引用幂等回归前的账本快照位于 `/opt/studio-billing/backups/rembg-commercial-20260916-points-exchange-v5/`；回归误触发的测试兑换已退款并撤销，当前余额已恢复。
- 五分钟保护范围与会话引用修正上线前备份位于 `/opt/studio-billing/backups/rembg-commercial-20260916-points-exchange-v6/`。
- 页面错误态修正上线前备份位于 `/opt/studio-billing/backups/rembg-commercial-20260916-points-exchange-v7/`。
- 已撤销权益隐藏失效令牌上线前备份位于 `/opt/studio-billing/backups/rembg-commercial-20260916-points-exchange-v8/`。
- 运营控制台与管理员会话上线前备份位于 `/opt/studio-billing/backups/rembg-commercial-20260917-admin-v1/`，含 `app.py`、`points.py`、`.env` 和账本快照。
- 当前线上 `app.py` SHA-256 为 `1ec933ee4cdaab57bf7ed07dee3a8919629056d8ac2f8afba893e90a7e086a0d`，购买页 SHA-256 为 `f1972d1b234d83fd2b200e73584bdf069abddd70ff09dd7d517a54b046e66692`，首页 SHA-256 为 `1447a997f5f231ebebb4be75d51996c57c7bae8d3459f79af0dfd4004351e479`。
- 管理员会话版线上 `app.py` SHA-256 为 `b3059474c9f9a59b8cfa274702a87cb985b5222d66df38e228cb6948054799e5`，运营控制台 `admin.html` SHA-256 为 `db91efc6948c2b76215af7cfcf9329fe5d2d2393e97e6fba2b8b762f73b38037`。
- 回滚顺序：恢复备份的 `app.py` 与购买页，删除新模块/密钥（保留备份），`systemctl restart studio-billing.service`，再检查 `/studio/api/health` 和 `/studio/api/products`。

## 当前限制

- USDT/TRC20 是现有试验支付方式；支付宝/微信/Stripe、发票、退款回调和自动撤销账本尚未接入。
- 420/1450 分沿用约 ¥29/¥99 的实验价格，积分兑换比例暂定为 1 USDT = 100 分；汇率、链上手续费与实际收款成本需要首批充值订单验证。
- 服务资源有限（2 vCPU、约 1.6 GiB 内存），服务器只承载授权/支付，不在云端跑商品图推理；图片仍在本地桌面或 Pages/WASM 处理。
- 运营控制台是单管理员短期会话面板；管理员密码哈希只存在服务器受限 `.env`，不会提交仓库。正式多人运营仍需增加角色权限、CSRF/审计留存策略和商家主体对应的退款流程。
