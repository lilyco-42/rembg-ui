import unittest

from commerce import LicenseError, resolve_entitlement
from offline_license import (
    OfflineLicenseError,
    generate_keypair,
    hash_device_id,
    issue_offline_license,
    verify_offline_license,
)


class OfflineLicenseTests(unittest.TestCase):
    claims = {
        "schema_version": 1,
        "license_id": "lic_offline_001",
        "subject": "pilot-001",
        "plan_id": "creator",
        "issued_at": 1_700_000_000,
        "expires_at": 1_800_000_000,
        "device_hash": None,
    }

    def setUp(self):
        self.private_key, self.public_key = generate_keypair()

    def test_round_trip_uses_public_key_only_and_preserves_plan_policy(self):
        token = issue_offline_license(self.claims, self.private_key, key_id="prod-2026")
        claims = verify_offline_license(token, self.public_key, expected_key_id="prod-2026", now=1_750_000_000)
        self.assertEqual(claims["license_id"], "lic_offline_001")
        entitlement = resolve_entitlement(token, None, public_key=self.public_key, now=1_750_000_000)
        self.assertEqual(entitlement["plan_id"], "creator")
        self.assertEqual(entitlement["max_batch_images"], 50)

    def test_tamper_wrong_key_expiry_and_missing_public_key_fail_closed(self):
        token = issue_offline_license(self.claims, self.private_key)
        header, payload, signature = token.split(".")
        changed_signature = ("A" if signature[0] != "A" else "B") + signature[1:]
        self.assertRaises(
            OfflineLicenseError,
            verify_offline_license,
            f"{header}.{payload}.{changed_signature}",
            self.public_key,
            now=1_750_000_000,
        )
        _, wrong_public_key = generate_keypair()
        self.assertRaises(OfflineLicenseError, verify_offline_license, token, wrong_public_key, now=1_750_000_000)
        self.assertRaises(OfflineLicenseError, verify_offline_license, token, self.public_key, now=1_800_000_000)
        self.assertRaises(LicenseError, resolve_entitlement, token, None, now=1_750_000_000)

    def test_device_bound_license_requires_matching_hash_and_can_be_reissued(self):
        device_a = hash_device_id("machine-a-local-secret")
        device_b = hash_device_id("machine-b-local-secret")
        token = issue_offline_license({**self.claims, "device_hash": device_a}, self.private_key)
        self.assertEqual(
            verify_offline_license(token, self.public_key, device_hash=device_a, now=1_750_000_000)["device_hash"],
            device_a,
        )
        self.assertRaises(
            OfflineLicenseError,
            verify_offline_license,
            token,
            self.public_key,
            device_hash=device_b,
            now=1_750_000_000,
        )
        replacement = issue_offline_license({**self.claims, "license_id": "lic_offline_002", "device_hash": device_b}, self.private_key)
        self.assertEqual(verify_offline_license(replacement, self.public_key, device_hash=device_b, now=1_750_000_000)["license_id"], "lic_offline_002")

    def test_invalid_plan_is_rejected_by_commerce_policy(self):
        token = issue_offline_license({**self.claims, "plan_id": "unlisted"}, self.private_key)
        self.assertRaises(
            LicenseError,
            resolve_entitlement,
            token,
            None,
            public_key=self.public_key,
            now=1_750_000_000,
        )


if __name__ == "__main__":
    unittest.main()
