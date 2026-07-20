"""赞助与教程模块配置"""
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class TutorialLink:
    """教程链接"""
    title: str
    url: str
    icon: str = "▶"
    desc: str = "点击在系统浏览器中打开"


@dataclass
class SponsorMethod:
    """单个赞助方式"""
    name: str           # 显示名：微信支付 / 爱发电 / GitHub Sponsors
    icon: str           # 图标 emoji 或文字
    url: str = ""       # 赞助链接（爱发电、GitHub Sponsors 等）
    qr_image: str = ""  # 二维码图片路径（相对于 assets/ 或完整 URL）


@dataclass
class SponsorConfig:
    """赞助配置"""
    # 赞助方式列表
    methods: List[SponsorMethod] = field(default_factory=lambda: [
        SponsorMethod(name="微信支付", icon="💚", qr_image="assets/wechat_pay.png"),
        SponsorMethod(name="支付宝", icon="💙", qr_image="assets/alipay.png"),
        SponsorMethod(name="爱发电", icon="🧡", url="https://afdian.net/"),
        SponsorMethod(name="GitHub Sponsors", icon="💛", url="https://github.com/sponsors"),
    ])

    # 教程链接
    tutorials: List[TutorialLink] = field(default_factory=lambda: [
        TutorialLink(title="B 站教程视频", url="https://www.bilibili.com/video/BV1xx411c7mD"),
    ])

    # 项目信息
    project_name: str = "Rembg Studio"
    project_version: str = "1.0.0"
    project_repo: str = ""  # GitHub 仓库地址
    project_desc: str = "AI 智能抠图工具"


# 默认配置（各项目可覆盖）
DEFAULT_CONFIG = SponsorConfig()
