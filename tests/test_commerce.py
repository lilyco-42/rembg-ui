import unittest

from commerce import (
    LicenseError,
    can_process,
    entitlement_view,
    issue_license,
    public_plan_catalog,
    resolve_entitlement,
    trial_entitlement,
    verify_license,
)


class CommerceTests(unittest.TestCase):
    secret = "test-only-secret-0123456789"
    claims = {
        "schema_version": 1,
        "license_id": "lic_001",
        "subject": "seller@example.test",
        "plan_id": "creator",
        "issued_at": 1_700_000_000,
        "expires_at": 1_800_000_000,
    }

    def test_catalog_is_hypothesis_and_does_not_expose_secret(self):
        catalog = public_plan_catalog()
        self.assertEqual([item["id"] for item in catalog], ["trial", "creator", "studio"])
        self.assertTrue(all(item["pricing_status"] == "experiment" for item in catalog))
        self.assertTrue(all("secret" not in item for item in catalog))

    def test_signed_license_round_trip_uses_server_plan_limits(self):
        token = issue_license(self.claims, self.secret)
        verified = verify_license(token, self.secret, now=1_750_000_000)
        self.assertEqual(verified["plan_id"], "creator")
        view = entitlement_view(verified, now=1_750_000_000)
        self.assertEqual(view["max_batch_images"], 50)
        self.assertTrue(can_process(view, used_this_period=499, requested=1))
        self.assertFalse(can_process(view, used_this_period=499, requested=2))

    def test_tamper_expiry_and_wrong_secret_are_rejected(self):
        token = issue_license(self.claims, self.secret)
        header, payload, signature = token.split(".")
        self.assertRaises(LicenseError, verify_license, f"{header}.{payload}.{signature[:-1]}x", self.secret, now=1_750_000_000)
        self.assertRaises(LicenseError, verify_license, token, "wrong-secret-012345", now=1_750_000_000)
        self.assertRaises(LicenseError, verify_license, token, self.secret, now=1_800_000_000)

    def test_missing_configuration_is_bounded_trial(self):
        trial = resolve_entitlement(None, None, now=1_750_000_000)
        self.assertEqual(trial["plan_id"], "trial")
        self.assertEqual(trial["max_batch_images"], 10)
        self.assertEqual(trial_entitlement(now=1)["status"], "trial")
        self.assertRaises(LicenseError, resolve_entitlement, "v1.bad.bad", None, now=1)

    def test_invalid_claims_and_quota_inputs_fail_closed(self):
        with self.assertRaises(LicenseError):
            issue_license({**self.claims, "plan_id": "admin"}, self.secret)
        with self.assertRaises(ValueError):
            can_process(trial_entitlement(), used_this_period=-1, requested=1)


if __name__ == "__main__":
    unittest.main()
