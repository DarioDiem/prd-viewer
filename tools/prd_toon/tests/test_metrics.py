"""Tests for prd_toon.metrics."""

import unittest
from tools.prd_toon.metrics import calculate_savings

class TestMetrics(unittest.TestCase):
    def test_calculate_savings(self):
        # 100 bytes to 75 bytes = 25% savings
        savings = calculate_savings(100, 75, 10.0)
        self.assertEqual(savings["percent"], 25.0)
        self.assertTrue(savings["useful"])

    def test_calculate_savings_not_useful(self):
        # 100 bytes to 95 bytes = 5% savings < 10%
        savings = calculate_savings(100, 95, 10.0)
        self.assertEqual(savings["percent"], 5.0)
        self.assertFalse(savings["useful"])

    def test_calculate_savings_zero(self):
        savings = calculate_savings(0, 0, 10.0)
        self.assertEqual(savings["percent"], 0.0)
        self.assertFalse(savings["useful"])

if __name__ == "__main__":
    unittest.main()
