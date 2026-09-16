# lain42.top 商业化部署记录

日期：2026-09-16。Rembg Studio 复用服务器已有的 `studio-billing`，没有另起支付服务。

## 已上线的入口

- 购买页：`https://lain42.top/sub/buy.html`
- 产品接口：`https://lain42.top/studio/api/products`
- 健康检查：`https://lain42.top/studio/api/health`
- Rembg 验证公钥：`https://lain42.top/studio/api/rembg/public-key`
- 现有服务：systemd `studio-billing.service`，本机 `127.0.0.1:4700`
- 反代：Pingap `/studio/api/` → `127.0.0.1:4700`

## 产品映射

| 产品码 | Rembg 套餐 | 试验价 | 权益有效期 |
|---|---|---:|---:|
| `rembg_creator` | `creator` | 4.2 USDT（约 ¥29） | 30 天 |
| `rembg_studio` | `studio` | 14.5 USDT（约 ¥99） | 30 天 |

订单、卡密兑换和管理员手工发放沿用现有 `billing.db`。发放 Rembg 产品时，服务端用 `/opt/studio-billing/keys/rembg-private.key` 签出 `ol1`；私钥权限为 600，从不通过 API 返回。桌面包内置的公钥为 `license_config.py` 中的 `rembg-2026`，公钥接口只返回验证所需信息。

## 运营流程

1. 用户在购买页注册/登录，选择 Rembg 套餐，按订单显示的精确 USDT 金额转入页面钱包。
2. watcher 每 30 秒查询 TRC20 交易；订单变为 `paid` 后自动写入 30 天权益和 `ol1` 授权。
3. 用户在“我的权益”点击“复制授权”，下载 [Releases](https://github.com/lilyco-42/rembg-ui/releases) 的桌面版，把令牌粘贴到工作台。
4. 换机或退款暂时由运营方重新签发/停用处理；离线文件在下一次在线校验前不能即时感知撤销，不能把当前版本描述成完整的自动退款系统。

## 密钥轮换与回滚

- 轮换时在服务器生成新密钥，设置新的 `REMBG_OFFLINE_KEY_ID`，把新公钥写入 `license_config.py` 后再构建发行包；旧发行包需要在过渡期继续接受旧 key id，因此生产代码应扩展为公钥集合后再切换。
- 本次部署前备份位于 `/opt/studio-billing/backups/rembg-commercial-20260916-103830/`，含 `app.py`、`.env`、`billing.db`、购买页和 README。
- 回滚顺序：恢复备份的 `app.py` 与购买页，删除新模块/密钥（保留备份），`systemctl restart studio-billing.service`，再检查 `/studio/api/health` 和 `/studio/api/products`。

## 当前限制

- USDT/TRC20 是现有试验支付方式；支付宝/微信/Stripe、发票、退款回调和自动撤销账本尚未接入。
- 4.2/14.5 USDT 是把本地 ¥29/¥99 假设换算后的试验价，汇率与实际收款成本需要首批订单验证。
- 服务资源有限（2 vCPU、约 1.6 GiB 内存），服务器只承载授权/支付，不在云端跑商品图推理；图片仍在本地桌面或 Pages/WASM 处理。
