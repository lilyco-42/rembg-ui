# 网站资源软件 P0

用户要求把批量抠图工具及 ADB、scrcpy 放到网站。基线来自 2026-10-28 线上下载页，保留 123 个原有条目，新增 Rembg Studio Windows 完整包、scrcpy 官方 Windows 完整包（附带 ADB）及 Google 独立 Platform-Tools 入口。没有接触支付或账户数据库。

Rembg 使用最新公开 Release `v0.2.7-20261028-1536`，源提交 `c1b65d10f0477d79a3423423ab2fafdae2f2baae`，原始构建 Actions `40717411511` 成功。本次不重编或发布新软件版本。公开源与摘要固定在 packages.json；上传保持原包字节。scrcpy 使用 Genymobile 官方 `v5.0.1`，保留完整包与随附组件。

只在 GitHub Actions `Validate software resource downloads` 验证网站交互、移动布局、深浅色、原有条目保留、两个 ZIP 的摘要与 CRC、包内文件夹选择界面，以及 Windows scrcpy/ADB 版本输出。版本输出不证明真实手机连接；Rembg 本次未新增实际模型质量或真实客户批量效果验收。

发布只替换 `deployment-baseline.json` 中三个既有文件，并新增教程及两个版本固定 ZIP。共享 studio.css、studio.js 是当前线上只读预览依赖，不发布。部署前核对线上 SHA-256；若有他人修改则停下重合并。备份存于网站目录之外，文件逐个原子替换；下载目录最后发布引用。Google 独立 Platform-Tools 通过官方页面提供，没有代用户接受 SDK 条款。

用户可直接分享 `/downloads/rembg/index.html` 或 `/downloads/index.html?q=rembg`；搜索 query 只是当前页面筛选，不含凭据。下载目录、软件授权和模型使用条件分别处理。

2026-10-29 维护更新：新包先通过相同 Actions 的全包摘要、CRC 和固定 Release 前端源码比对，再用 `scripts/update-rembg.py` 发布。该更新只新增版本目录并替换现有教程、目录 JSON；既有 ZIP、scrcpy、CSS、导航和其他 123 个资源保持原样。部署基线在 `rembg-update-baseline.json`，任一线上字节变更即停止，发布异常按原摘要回滚。
