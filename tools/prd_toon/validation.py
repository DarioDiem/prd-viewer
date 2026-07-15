"""JSON validation and semantic comparison utilities."""

import json
from pathlib import Path
from typing import Any

try:
    import jsonschema
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "Missing Python dependency: jsonschema. Install it before running this tool."
    ) from exc


def load_json(path: Path) -> Any:
    """Load JSON from a file path."""
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_schema(schema: dict[str, Any], data: Any, label: str) -> list[str]:
    """Validate data against a JSON schema."""
    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(data), key=lambda error: list(error.path))
    return [format_validation_error(error, label) for error in errors]


def format_validation_error(error: jsonschema.ValidationError, label: str) -> str:
    """Format a jsonschema.ValidationError into a human-readable string."""
    path = "/" + "/".join(str(part) for part in error.path) if error.path else "/"
    return f"{label}{path}: {error.message}"


def first_diff(left: Any, right: Any, path: str = "$") -> str | None:
    """Find the first semantic difference between two objects."""
    if type(left) is not type(right):
        return f"{path}: type differs ({type(left).__name__} != {type(right).__name__})"
    if isinstance(left, dict):
        left_keys = set(left)
        right_keys = set(right)
        if left_keys != right_keys:
            missing = sorted(left_keys - right_keys)
            extra = sorted(right_keys - left_keys)
            return f"{path}: keys differ (missing={missing}, extra={extra})"
        for key in sorted(left_keys):
            diff = first_diff(left[key], right[key], f"{path}.{key}")
            if diff:
                return diff
        return None
    if isinstance(left, list):
        if len(left) != len(right):
            return f"{path}: list length differs ({len(left)} != {len(right)})"
        for index, (left_item, right_item) in enumerate(zip(left, right, strict=True)):
            diff = first_diff(left_item, right_item, f"{path}[{index}]")
            if diff:
                return diff
        return None
    if left != right:
        return f"{path}: value differs ({left!r} != {right!r})"
    return None
