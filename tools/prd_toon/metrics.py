"""Metrics logging and statistics utilities."""

import json
from pathlib import Path
from typing import Any


def append_metrics(path: Path, row: dict[str, Any]) -> None:
    """Append a row to a JSONL metrics log."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, sort_keys=True, separators=(",", ":")) + "\n")


def calculate_savings(
    input_bytes: int,
    toon_bytes: int,
    min_savings_percent: float,
) -> dict[str, Any]:
    """Calculate byte savings and determine if it's useful."""
    bytes_saved = input_bytes - toon_bytes
    bytes_delta_percent = (
        100 * bytes_saved / input_bytes if input_bytes else 0.0
    )
    useful = bytes_delta_percent >= min_savings_percent

    return {
        "json": input_bytes,
        "toon": toon_bytes,
        "saved": bytes_saved,
        "percent": round(bytes_delta_percent, 1),
        "threshold_percent": min_savings_percent,
        "useful": useful,
    }
