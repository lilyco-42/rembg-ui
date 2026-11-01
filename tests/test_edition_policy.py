"""Fail-closed tests for browser model delivery."""
import os
import unittest
from unittest.mock import patch
from edition_policy import current_edition, allow_local_webgpu, community_entitlement, require_trusted_cloud_billing

class EditionPolicyTests(unittest.TestCase):
    def test_default_is_pro_and_no_webgpu(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(current_edition(), "pro")
            self.assertFalse(allow_local_webgpu())

    def test_pro_flag_is_not_billing_authority(self):
        with patch.dict(os.environ, {"REMBG_EDITION": "pro", "REMBG_ENABLE_WEBGPU_EXPERIMENT": "1"}, clear=True):
            self.assertFalse(allow_local_webgpu())

    def test_community_requires_experiment_opt_in(self):
        with patch.dict(os.environ, {"REMBG_EDITION": "community"}, clear=True):
            self.assertFalse(allow_local_webgpu())
        with patch.dict(os.environ, {"REMBG_EDITION": "community", "REMBG_ENABLE_WEBGPU_EXPERIMENT": "1"}, clear=True):
            self.assertTrue(allow_local_webgpu())

    def test_invalid_edition_fails_closed(self):
        with patch.dict(os.environ, {"REMBG_EDITION": "unknown", "REMBG_ENABLE_WEBGPU_EXPERIMENT": "1"}, clear=True):
            with self.assertRaises(ValueError): current_edition()
            with self.assertRaises(ValueError): allow_local_webgpu()

    def test_community_entitlement_is_free_and_explicit(self):
        entitlement = community_entitlement()
        self.assertEqual(entitlement["plan_id"], "community")
        self.assertEqual(entitlement["status"], "active")
        self.assertIsNone(entitlement["monthly_images"])
        self.assertEqual(entitlement["max_batch_images"], 10)

    def test_hosted_pro_fails_closed_without_trusted_ledger(self):
        with patch.dict(os.environ, {"REMBG_EDITION": "pro", "REMBG_HOSTED_PAID_MODE": "1"}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "paid inference is disabled"):
                require_trusted_cloud_billing()

    def test_local_pro_and_free_community_do_not_claim_cloud_billing(self):
        with patch.dict(os.environ, {"REMBG_EDITION": "pro"}, clear=True):
            self.assertIsNone(require_trusted_cloud_billing())
        with patch.dict(os.environ, {"REMBG_EDITION": "community", "REMBG_HOSTED_PAID_MODE": "1"}, clear=True):
            self.assertIsNone(require_trusted_cloud_billing())
