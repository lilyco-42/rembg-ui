import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from usage import UsageError, UsageLimitError, current_period, release_usage, reserve_usage, usage_snapshot


class UsageLedgerTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "usage.db"
        self.subject = "license:lic_test"

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_reserve_is_atomic_and_reports_remaining(self):
        first = reserve_usage(self.db_path, self.subject, 2, 3, "remove-bg:u2netp", period="2026-09", now="2026-09-17T01:02:03+00:00")
        self.assertEqual(first["used"], 2)
        self.assertEqual(first["remaining"], 1)
        current = usage_snapshot(self.db_path, self.subject, limit=3, period="2026-09")
        self.assertEqual(current["updated_at"], "2026-09-17T01:02:03+00:00")
        with self.assertRaises(UsageLimitError) as context:
            reserve_usage(self.db_path, self.subject, 2, 3, "remove-bg:u2netp", period="2026-09")
        self.assertEqual(context.exception.snapshot["used"], 2)
        self.assertEqual(usage_snapshot(self.db_path, self.subject, limit=3, period="2026-09")["used"], 2)

    def test_release_rolls_back_failed_inference(self):
        reservation = reserve_usage(self.db_path, self.subject, 1, 3, "sam-segment", period="2026-09")
        after = release_usage(
            self.db_path,
            self.subject,
            1,
            "sam-segment:rollback",
            period=reservation["period"],
            limit=3,
        )
        self.assertEqual(after["used"], 0)
        self.assertEqual(after["remaining"], 3)

    def test_period_is_utc_month_and_inputs_fail_closed(self):
        self.assertEqual(current_period(datetime(2026, 10, 1, 0, 30, tzinfo=timezone.utc)), "2026-10")
        self.assertEqual(current_period(datetime(2026, 9, 30, 17, 30, tzinfo=timezone(timedelta(hours=-7)))), "2026-10")
        with self.assertRaises(UsageError):
            reserve_usage(self.db_path, "", 1, 3, "op")
        with self.assertRaises(UsageError):
            reserve_usage(self.db_path, self.subject, 0, 3, "op")
        with self.assertRaises(UsageError):
            usage_snapshot(self.db_path, self.subject, limit=3, period="2026-13")


if __name__ == "__main__":
    unittest.main()
