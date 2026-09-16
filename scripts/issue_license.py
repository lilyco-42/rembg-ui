"""Issue a manual pilot entitlement without exposing the signing secret.

This is an operator-only bridge for paid trials before a payment provider is
chosen. Keep REMBG_LICENSE_SECRET in a private environment and send only the
printed token to the verified pilot customer.
"""

from __future__ import annotations

import argparse
import os
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

# Running the file directly places only scripts/ on sys.path; add the project
# root explicitly so the shared commerce module is found without installation.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from commerce import PLANS, issue_license


def _positive_days(value: str) -> int:
    try:
        days = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("天数必须是整数") from error
    if not 1 <= days <= 3650:
        raise argparse.ArgumentTypeError("天数必须在 1 到 3650 之间")
    return days


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="为已核验的手工试单签发 Rembg Studio 授权令牌")
    parser.add_argument("--plan", choices=tuple(plan_id for plan_id in PLANS if plan_id != "trial"), required=True)
    parser.add_argument("--subject", required=True, help="已核验的客户标识；不要填入不必要的个人信息")
    parser.add_argument("--days", type=_positive_days, default=30, help="有效期天数，默认 30")
    parser.add_argument("--license-id", default=None, help="可选的内部订单/授权编号")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    secret = os.environ.get("REMBG_LICENSE_SECRET")
    if not secret:
        parser.error("请先在私有环境设置 REMBG_LICENSE_SECRET；不要把密钥写入仓库或命令行参数")
    issued_at = int(datetime.now(timezone.utc).timestamp())
    claims = {
        "schema_version": 1,
        "license_id": args.license_id or f"lic_{secrets.token_urlsafe(12)}",
        "subject": args.subject,
        "plan_id": args.plan,
        "issued_at": issued_at,
        "expires_at": issued_at + args.days * 24 * 60 * 60,
    }
    try:
        print(issue_license(claims, secret))
    except ValueError as error:
        print(f"签发失败：{error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
