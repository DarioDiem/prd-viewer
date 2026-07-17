#!/usr/bin/env python3
"""Tests for GitHub-only delivery tracking validation."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.validate_delivery_tracking import (
    validate_issue_body,
    validate_pull_request,
    validate_tracking,
)


def sample_prd(*, refs: list[str], status: str = "in_progress") -> dict:
    return {
        "project_tracking": {
            "pending_work": [
                {
                    "work_item_id": "PTW-001",
                    "status": status,
                    "external_refs": refs,
                }
            ],
            "issues_found": [],
            "blockers": [],
            "notes": [],
        }
    }


class DeliveryTrackingValidationTest(unittest.TestCase):
    def test_active_work_requires_github_issue(self) -> None:
        errors = validate_tracking(sample_prd(refs=[]))
        self.assertEqual(
            errors,
            ["PTW-001: in_progress work requires a GitHub issue URL in external_refs."],
        )

    def test_tracking_rejects_non_github_refs(self) -> None:
        errors = validate_tracking(
            sample_prd(refs=["https://jira.example.com/browse/PRD-1"])
        )
        self.assertEqual(len(errors), 2)
        self.assertIn("external_refs must use https://github.com URLs only", errors[0])

    def test_pull_request_requires_ptw_and_closing_issue(self) -> None:
        event = {"pull_request": {"body": "PTW-001\n\nCloses #12"}}
        with tempfile.TemporaryDirectory() as temp_dir:
            event_path = Path(temp_dir) / "event.json"
            event_path.write_text(json.dumps(event), encoding="utf-8")
            with patch.dict(os.environ, {"GITHUB_EVENT_NAME": "pull_request"}):
                self.assertEqual(
                    validate_pull_request(
                        sample_prd(
                            refs=["https://github.com/example/project/issues/12"]
                        ),
                        event_path,
                    ),
                    [],
                )

    def test_large_issue_must_be_split(self) -> None:
        body = """
## Parent
PTW-001
## Design
TRD-001
## Outcome
One result
## Acceptance criteria
Observable completion
## Verification
One command
## Dependencies
None
## Size
Large — split before implementation
"""
        self.assertEqual(
            validate_issue_body(body, {"PTW-001"}),
            ["Large issues must be split before implementation."],
        )


if __name__ == "__main__":
    unittest.main()
