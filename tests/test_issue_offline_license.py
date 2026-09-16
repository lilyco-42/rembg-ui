import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from offline_license import generate_keypair, verify_offline_license


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "issue_offline_license.py"


class IssueOfflineLicenseTests(unittest.TestCase):
    def test_operator_script_issues_verifiable_file_without_printing_private_key(self):
        private_key, public_key = generate_keypair()
        with tempfile.TemporaryDirectory() as directory:
            private_path = Path(directory) / "private.key"
            output_path = Path(directory) / "pilot.lic"
            private_path.write_text(private_key + "\n", encoding="ascii")
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--plan",
                    "creator",
                    "--subject",
                    "pilot-001",
                    "--days",
                    "2",
                    "--license-id",
                    "ord-001",
                    "--key-id",
                    "pilot-2026",
                    "--private-key-file",
                    str(private_path),
                    "--output",
                    str(output_path),
                ],
                cwd=ROOT,
                env=dict(os.environ),
                capture_output=True,
                text=True,
                check=True,
            )
            token = output_path.read_text(encoding="ascii").strip()
            claims = verify_offline_license(token, public_key, expected_key_id="pilot-2026")
            self.assertEqual(claims["license_id"], "ord-001")
            self.assertNotIn(private_key, result.stdout)
            self.assertIn("离线授权已写入", result.stdout)

    def test_operator_script_requires_private_key_source(self):
        env = dict(os.environ)
        env.pop("REMBG_LICENSE_PRIVATE_KEY", None)
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--plan", "creator", "--subject", "pilot-001"],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("REMBG_LICENSE_PRIVATE_KEY", result.stderr)
        self.assertNotIn("ol1.", result.stdout)


if __name__ == "__main__":
    unittest.main()
