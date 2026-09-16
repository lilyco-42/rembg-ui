"""Issue an Ed25519 signed offline license for a verified pilot customer.

The private key is read from a file outside the repository or from
``REMBG_LICENSE_PRIVATE_KEY``. It is never accepted as a command-line
argument, and only the signed token is written to stdout.
"""

from __future__ import annotations

import argparse
import os
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from commerce import PLANS
from offline_license import issue_offline_license


def _positive_days(value: str) -> int:
    try:
        days = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("天数必须是整数") from error
    if not 1 <= days <= 3650:
        raise argparse.ArgumentTypeError("天数必须在 1 到 3650 之间")
    return days


def _device_hash(value: str) -> str:
    if len(value) != 64 or any(character not in "0123456789abcdef" for character in value):
        raise argparse.ArgumentTypeError("设备哈希必须是 64 位小写 SHA-256 十六进制摘要")
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="为已核验的手工试单签发 Rembg Studio 离线授权文件")
    parser.add_argument("--plan", choices=tuple(plan_id for plan_id in PLANS if plan_id != "trial"), required=True)
    parser.add_argument("--subject", required=True, help="已核验的客户标识；不要填入不必要的个人信息")
    parser.add_argument("--days", type=_positive_days, default=30, help="有效期天数，默认 30")
    parser.add_argument("--license-id", default=None, help="可选的内部订单/授权编号")
    parser.add_argument("--key-id", default="default", help="公钥轮换编号，默认 default")
    parser.add_argument("--device-hash", type=_device_hash, default=None, help="可选的设备 SHA-256 摘要")
    parser.add_argument("--private-key-file", type=Path, help="仓库之外的私钥文件；不传则读取 REMBG_LICENSE_PRIVATE_KEY")
    parser.add_argument("--output", type=Path, default=None, help="可选的 .lic 输出文件；不传则打印到 stdout")
    return parser


def _read_private_key(args: argparse.Namespace, parser: argparse.ArgumentParser) -> str:
    if args.private_key_file is not None:
        try:
            value = args.private_key_file.read_text(encoding="ascii").strip()
        except OSError as error:
            parser.error(f"无法读取私钥文件：{error}")
        if not value:
            parser.error("私钥文件为空")
        return value
    value = os.environ.get("REMBG_LICENSE_PRIVATE_KEY", "").strip()
    if not value:
        parser.error("请使用 --private-key-file 或在私有环境设置 REMBG_LICENSE_PRIVATE_KEY")
    return value


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    private_key = _read_private_key(args, parser)
    issued_at = int(datetime.now(timezone.utc).timestamp())
    claims = {
        "schema_version": 1,
        "license_id": args.license_id or f"lic_{secrets.token_urlsafe(12)}",
        "subject": args.subject,
        "plan_id": args.plan,
        "issued_at": issued_at,
        "expires_at": issued_at + args.days * 24 * 60 * 60,
        "device_hash": args.device_hash,
    }
    try:
        token = issue_offline_license(claims, private_key, key_id=args.key_id)
        if args.output is None:
            print(token)
        else:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(token + "\n", encoding="ascii", newline="\n")
            print(f"离线授权已写入：{args.output}")
    except (OSError, ValueError) as error:
        print(f"离线授权签发失败：{error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
