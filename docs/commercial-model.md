# Rembg Studio 经营模型（实验版）

日期：2026-09-16。这个模型用于第一轮真实试单，不代表已经收款或承诺长期价格。

## 选择的路径

先把 GitHub Pages 当作免费的本地处理演示，把桌面版作为创作者和小团队的付费入口。浏览器版的价值是让用户在不安装的情况下验证“原图 → 透明底稿 → 统一商品图 → ZIP 交付”；桌面版再承接更大模型、批量任务、局域网工作和支持服务。后续只有在客户要求把图片交给服务端处理时，才另建托管 SaaS。

第一轮价格是假设，用来测试支付意愿与支持成本：公开试用免费；创作者版建议测试价 ¥29/月；小团队版建议测试价 ¥99/月。价格字段在代码中标为 `experiment`，不会被当作已上线的收款页。一次试单必须记录实收、退款、支持分钟、返修分钟和交付结果，不能用 Star、下载量或赞助额代替收入。

## 软件边界

`commerce.py` 提供套餐目录、HMAC 签名授权、Ed25519 离线授权、有效期校验和纯函数用量检查。HMAC 只用于本机服务和私有试单；离线桌面版只需要 Ed25519 公钥，私钥留在发行方签发器，不能放进 GitHub Pages、浏览器 JavaScript 或桌面安装包。没有密钥或没有授权令牌时，系统明确返回受限试用；前端显示一个布尔开关不能成为付费墙。

在支付渠道确定前，可用私有环境中的 `scripts/issue_license.py` 为已核验的手工试单签发短期令牌。脚本只从 `REMBG_LICENSE_SECRET` 读取密钥，标准输出只打印令牌；不要把密钥、客户原图或未核验的客户标识提交到仓库。桌面工作台粘贴令牌后会向本机服务校验，并按签名套餐更新批次上限。

lain42.top 的 `studio-billing` 已部署 USDT/TRC20 试验订单、USDT 充值积分、Rembg 积分兑换、卡密兑换和 `ol1` 自动签发，但这只是首批试单通道，尚未完成真实订单验收。积分账本支持管理员幂等加分、USDT 链上入账、Rembg 原子扣分兑换和流水查询；推理配额仍未接入。支付宝、微信、Stripe、正式商家主体、服务地域和退款规则仍需由经营者冻结；扩大经营前要为订单回调增加唯一订单绑定、金额校验、退款撤销和审计记录。

示例（PowerShell，密钥只存在当前私有环境）：

```powershell
$env:REMBG_LICENSE_SECRET = "在私有密码管理器中读取的随机密钥"
python scripts/issue_license.py --plan creator --subject "pilot-001" --days 30
```

## 离线桌面授权（已实现签名层，尚未接支付）

弱网或空网客户使用 `ol1` 授权文件。签发端只在私有环境生成一次 Ed25519 密钥对；公钥可以放入桌面构建配置，私钥必须留在仓库之外。设备绑定时，发行方只接收本地生成的 SHA-256 设备摘要，不接收原始硬件标识。

```powershell
python scripts/generate_license_keys.py `
  --private-key "$env:USERPROFILE\rembg-keys\private.key" `
  --public-key "$env:USERPROFILE\rembg-keys\public.key"

python scripts/issue_offline_license.py `
  --private-key-file "$env:USERPROFILE\rembg-keys\private.key" `
  --plan creator --subject "pilot-001" --days 30 `
  --output .\pilot-001.lic
```

当前本机服务默认使用 `license_config.py` 中的生产公钥，也可用 `REMBG_LICENSE_PUBLIC_KEY` 覆盖；`REMBG_LICENSE_KEY_ID` 和请求头 `X-Rembg-Device-Hash` 用于轮换与设备绑定。lain42.top 的签发/购买流程记录在 `docs/studio-billing-rembg-deployment.md`。`REMBG_LICENSE_SECRET` 仍只服务于旧的 HMAC 试单，不应写入安装包。过期会在离线端立即生效；撤销、换机和退款需要下一次在线刷新或签发替换文件，尚未接入支付回调和撤销账本。

月度用量账本和自动续费仍属于托管授权服务职责；当前本地工作台只对签名令牌做有效期和每批上限校验，不能把手工令牌流程描述成完整支付系统。

## 放行门槛

1. 使用 `quality/sample-authorization-template.md` 收集并核验至少 30 张、至少 3 个目标品类的可商用样本；没有许可的图片不进入商业质量统计。
2. 在目标 Windows、macOS 和至少一台手机浏览器上完成连续批次、恢复、修边和 ZIP 验收，记录首载、单图耗时、峰值内存、直接交付率和返修时间。
3. 做至少 3 次真实付费试单，保留订单、退款、支持和交付证据；若支持分钟与返修成本吃掉价格，先调整产品边界再接支付。
4. 冻结商家主体、价格、税务/发票、退款和服务区域后，才把现有试验通道升级为正式支付适配器和生产授权服务。

## 当前结论

技术产品已经可公开试用，商业质量和收入仍为 `unverified`。本轮最值得投入的商业方向是“卖家统一商品图交付工作流”：用户为可交付结果、批量一致性和返修时间付费，而不是单纯为一次背景移除付费。AI 场景、商城、团队协作和多语言暂不投入，直到真实试单证明它们能降低获客或交付成本。
