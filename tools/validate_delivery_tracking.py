#!/usr/bin/env python3
"""Validate GitHub-only PRD delivery tracking and pull-request linkage."""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


ACTIVE_WORK_STATUSES = {"in_progress", "blocked"}
TRACKING_COLLECTIONS = ("pending_work", "issues_found", "blockers", "notes")
ISSUE_PATH = re.compile(r"^/[^/]+/[^/]+/issues/[1-9][0-9]*$")
PTW_ID = re.compile(r"\bPTW-[0-9]{3}\b")
CLOSING_ISSUE = re.compile(
    r"(?i)\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+"
    r"(?P<reference>#\d+|[\w.-]+/[\w.-]+#\d+|"
    r"https://github\.com/[^/\s]+/[^/\s]+/issues/\d+)"
)
ISSUE_SECTION_ALIASES = (
    ("parent work item", "parent"),
    ("design reference", "design"),
    ("outcome",),
    ("acceptance criteria",),
    ("verification",),
    ("dependencies and blockers", "dependencies"),
    ("delivery size", "size"),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate GitHub-only delivery tracking in a canonical PRD."
    )
    parser.add_argument("prd_path", type=Path)
    parser.add_argument(
        "--event-path",
        type=Path,
        default=Path(os.environ["GITHUB_EVENT_PATH"])
        if os.environ.get("GITHUB_EVENT_PATH")
        else None,
        help="GitHub event payload. Defaults to GITHUB_EVENT_PATH.",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object.")
    return payload


def is_github_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme == "https" and parsed.netloc.lower() == "github.com"


def is_github_issue_url(value: str) -> bool:
    return is_github_url(value) and ISSUE_PATH.fullmatch(urlparse(value).path) is not None


def validate_tracking(prd: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    tracking = prd.get("project_tracking")
    if not isinstance(tracking, dict):
        return ["project_tracking must be present for delivery enforcement."]

    for collection in TRACKING_COLLECTIONS:
        records = tracking.get(collection, [])
        if not isinstance(records, list):
            errors.append(f"project_tracking.{collection} must be an array.")
            continue
        for index, record in enumerate(records):
            if not isinstance(record, dict):
                continue
            label = (
                record.get("work_item_id")
                or record.get("issue_id")
                or record.get("blocker_id")
                or record.get("note_id")
                or f"{collection}[{index}]"
            )
            refs = record.get("external_refs", [])
            if not isinstance(refs, list):
                errors.append(f"{label}: external_refs must be an array.")
                continue
            non_github = [ref for ref in refs if not isinstance(ref, str) or not is_github_url(ref)]
            if non_github:
                errors.append(f"{label}: external_refs must use https://github.com URLs only.")
            if (
                collection == "pending_work"
                and record.get("status") in ACTIVE_WORK_STATUSES
                and not any(isinstance(ref, str) and is_github_issue_url(ref) for ref in refs)
            ):
                errors.append(
                    f"{label}: {record.get('status')} work requires a GitHub issue URL in external_refs."
                )
    return errors


def issue_sections(body: str) -> dict[str, str]:
    sections: dict[str, str] = {}
    current: str | None = None
    values: list[str] = []
    for line in body.splitlines():
        heading = re.match(r"^#{2,3}\s+(.+?)\s*$", line)
        if heading:
            if current is not None:
                sections[current] = "\n".join(values).strip()
            current = heading.group(1).strip().lower()
            values = []
        elif current is not None:
            values.append(line)
    if current is not None:
        sections[current] = "\n".join(values).strip()
    return sections


def validate_issue_body(body: str, referenced_ptws: set[str]) -> list[str]:
    sections = issue_sections(body)
    errors: list[str] = []
    resolved: dict[str, str] = {}
    for aliases in ISSUE_SECTION_ALIASES:
        value = next((sections[alias] for alias in aliases if sections.get(alias)), "")
        resolved[aliases[0]] = value
        if not value:
            errors.append(f"Linked issue is missing the required '{aliases[0]}' section.")
    parent_ids = set(PTW_ID.findall(resolved.get("parent work item", "")))
    if parent_ids and not parent_ids.intersection(referenced_ptws):
        errors.append("Linked issue and pull request must reference the same PTW.")
    if resolved.get("delivery size", "").lower().startswith("large"):
        errors.append("Large issues must be split before implementation.")
    return errors


def resolve_issue_api_url(reference: str, repository: str) -> str:
    if reference.startswith("https://github.com/"):
        parsed = urlparse(reference)
        owner, repo, _, number = parsed.path.strip("/").split("/")
    elif reference.startswith("#"):
        owner, repo = repository.split("/", maxsplit=1)
        number = reference[1:]
    else:
        repo_ref, number = reference.rsplit("#", maxsplit=1)
        owner, repo = repo_ref.split("/", maxsplit=1)
    return f"https://api.github.com/repos/{owner}/{repo}/issues/{number}"


def load_linked_issue(reference: str, repository: str) -> dict[str, Any]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(resolve_issue_api_url(reference, repository), headers=headers)
    with urlopen(request, timeout=15) as response:
        payload = json.load(response)
    if not isinstance(payload, dict):
        raise ValueError("GitHub issue response must be a JSON object.")
    return payload


def validate_pull_request(prd: dict[str, Any], event_path: Path | None) -> list[str]:
    if os.environ.get("GITHUB_EVENT_NAME") != "pull_request":
        return []
    if event_path is None or not event_path.exists():
        return ["GITHUB_EVENT_PATH is required for pull-request delivery validation."]

    event = load_json(event_path)
    pull_request = event.get("pull_request")
    body = pull_request.get("body") if isinstance(pull_request, dict) else None
    body = body if isinstance(body, str) else ""
    known_ptws = {
        item.get("work_item_id")
        for item in prd.get("project_tracking", {}).get("pending_work", [])
        if isinstance(item, dict)
    }
    referenced_ptws = set(PTW_ID.findall(body))
    errors: list[str] = []
    if not referenced_ptws:
        errors.append("Pull-request body must reference a PTW-### work item.")
    elif not referenced_ptws.intersection(known_ptws):
        errors.append("Pull-request body references no PTW present in the canonical PRD.")
    closing_match = CLOSING_ISSUE.search(body)
    if closing_match is None:
        errors.append(
            "Pull-request body must close a GitHub issue with Closes, Fixes, or Resolves."
        )
    elif isinstance(event.get("repository"), dict):
        repository = event["repository"].get("full_name")
        if isinstance(repository, str) and repository:
            try:
                issue = load_linked_issue(closing_match.group("reference"), repository)
                issue_body = issue.get("body")
                errors.extend(
                    validate_issue_body(
                        issue_body if isinstance(issue_body, str) else "",
                        referenced_ptws,
                    )
                )
            except (HTTPError, URLError, TimeoutError, ValueError) as error:
                errors.append(f"Could not validate linked GitHub issue: {error}")
    return errors


def main() -> int:
    args = parse_args()
    prd = load_json(args.prd_path)
    errors = validate_tracking(prd)
    errors.extend(validate_pull_request(prd, args.event_path))
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("GitHub delivery tracking validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
