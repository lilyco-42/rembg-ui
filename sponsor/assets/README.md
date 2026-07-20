# Sponsor Assets

按类型分类存放：

## 二维码图片
- `wechat_pay.png` — 微信收款码
- `alipay.png` — 支付宝收款码
- `qq_pay.png` — QQ 钱包（可选）

## 截图 / 封面
- `tutorial_cover.png` — 教程封面图（可选）

## 使用方式
配置文件 `config.py` 中的 `SponsorMethod.qr_image` 填写文件名即可。
前端会自动从 `/sponsor/assets/xxx.png` 加载。

如果二维码是外部 URL（比如图床），直接填完整链接也行。
