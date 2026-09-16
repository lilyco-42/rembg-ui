import os
import subprocess
import sys
import unittest

from commerce import verify_license


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "scripts", "issue_license.py")


class IssueLicenseTests(unittest.TestCase):
    def test_operator_script_emits_verifiable_short_lived_token(self):
        env = {**os.environ, "REMBG_LICENSE_SECRET": "test-only-secret-0123456789"}
        result = subprocess.run(
            [sys.executable, SCRIPT, "--plan", "creator", "--subject", "pilot-001", "--days", "2", "--license-id", "ord-001"],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )
        claims = verify_license(result.stdout.strip(), env["REMBG_LICENSE_SECRET"])
        self.assertEqual(claims["license_id"], "ord-001")
        self.assertEqual(claims["plan_id"], "creator")
        self.assertEqual(result.stderr, "")

    def test_operator_script_requires_private_secret(self):
        env = dict(os.environ)
        env.pop("REMBG_LICENSE_SECRET", None)
        result = subprocess.run(
            [sys.executable, SCRIPT, "--plan", "creator", "--subject", "pilot-001"],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("REMBG_LICENSE_SECRET", result.stderr)
        self.assertNotIn("v1.", result.stdout)


if __name__ == "__main__":
    unittest.main()
