"""Generate an Ed25519 key pair for the private licensing workflow.

The private key file belongs outside the repository and outside any desktop
distribution. The public key may be copied to the build configuration after
the operator has verified the release process.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from offline_license import generate_keypair


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="生成 Rembg Studio 离线授权 Ed25519 密钥对")
    parser.add_argument("--private-key", type=Path, required=True, help="私钥输出路径；请放在仓库之外")
    parser.add_argument("--public-key", type=Path, required=True, help="公钥输出路径")
    parser.add_argument("--force", action="store_true", help="允许覆盖已有文件")
    return parser


def _write_key(path: Path, value: str, *, force: bool) -> None:
    if path.exists() and not force:
        raise ValueError(f"文件已存在：{path}；如确认覆盖请加 --force")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value + "\n", encoding="ascii", newline="\n")
    try:
        os.chmod(path, 0o600)
    except OSError:
        # Windows ACLs are managed by the operator; chmod is best effort.
        pass


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.private_key.resolve() == args.public_key.resolve():
        parser.error("私钥和公钥必须写入不同文件")
    try:
        private_key, public_key = generate_keypair()
        _write_key(args.private_key, private_key, force=args.force)
        try:
            _write_key(args.public_key, public_key, force=args.force)
        except Exception:
            if not args.force and args.private_key.exists():
                args.private_key.unlink()
            raise
    except (OSError, ValueError) as error:
        print(f"密钥生成失败：{error}", file=sys.stderr)
        return 2
    print(f"公钥已写入：{args.public_key}")
    print("私钥已写入指定路径；不要提交仓库、不要放入桌面安装包。", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
