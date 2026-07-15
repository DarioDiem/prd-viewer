"""Tests for prd_toon.validation."""

import unittest
from pathlib import Path
from tools.prd_toon.validation import first_diff, validate_schema

class TestValidation(unittest.TestCase):
    def test_first_diff_identical(self):
        data = {"a": 1, "b": [2, 3], "c": {"d": 4}}
        self.assertIsNone(first_diff(data, data))

    def test_first_diff_type(self):
        diff = first_diff({"a": 1}, {"a": "1"})
        self.assertIn("type differs", diff)

    def test_first_diff_keys(self):
        diff = first_diff({"a": 1}, {"b": 1})
        self.assertIn("keys differ", diff)

    def test_first_diff_list_length(self):
        diff = first_diff([1, 2], [1, 2, 3])
        self.assertIn("list length differs", diff)

    def test_first_diff_value(self):
        diff = first_diff({"a": 1}, {"a": 2})
        self.assertIn("value differs", diff)

if __name__ == "__main__":
    unittest.main()
