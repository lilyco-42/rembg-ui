import sqlite3
import unittest

from points import PointsError, adjust_points, ensure_schema, parse_points, snapshot


class PointsLedgerTests(unittest.TestCase):
    def setUp(self):
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row
        ensure_schema(self.connection)

    def tearDown(self):
        self.connection.close()

    def test_grant_and_snapshot_keep_audit_entry(self):
        entry = adjust_points(
            self.connection,
            7,
            100,
            "测试额度",
            reference="pilot-7",
            now="2026-09-16T00:00:00+00:00",
        )
        self.assertEqual(entry["balance_after"], 100)
        self.assertFalse(entry["idempotent"])
        result = snapshot(self.connection, 7)
        self.assertEqual(result["balance"], 100)
        self.assertEqual(result["entries"][0]["reference"], "pilot-7")

    def test_same_reference_is_idempotent_and_conflicts_fail(self):
        first = adjust_points(self.connection, 7, 100, "测试额度", reference="same")
        retry = adjust_points(self.connection, 7, 100, "测试额度", reference="same")
        self.assertEqual(retry["id"], first["id"])
        self.assertTrue(retry["idempotent"])
        self.assertEqual(snapshot(self.connection, 7)["balance"], 100)
        with self.assertRaisesRegex(PointsError, "另一笔变更"):
            adjust_points(self.connection, 7, 101, "测试额度", reference="same")

    def test_consume_cannot_make_balance_negative(self):
        adjust_points(self.connection, 7, 10, "充值")
        with self.assertRaisesRegex(PointsError, "余额不足"):
            adjust_points(self.connection, 7, -11, "消费")
        self.assertEqual(snapshot(self.connection, 7)["balance"], 10)

    def test_parse_points_rejects_non_integer_values(self):
        self.assertEqual(parse_points("12"), 12)
        for value in (True, 0, -1, 1.5, "1.5", ""):
            with self.subTest(value=value):
                with self.assertRaises(PointsError):
                    parse_points(value)


if __name__ == "__main__":
    unittest.main()
