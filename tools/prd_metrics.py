"""Shared local JSONL metrics writer for PRD tools."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def append_metrics(path: Path, row: dict[str, Any]) -> None:
    """Append a deterministic row to a local JSONL metrics log."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, sort_keys=True, separators=(",", ":")) + "\n")
