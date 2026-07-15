#!/usr/bin/env python3
"""Check PRD schema contract compatibility against schema.versions.json."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import jsonschema
except ImportError as exc:  # pragma: no cover - dependency guard
    raise SystemExit(
        "Missing Python dependency: jsonschema. Install it before running this tool."
    ) from exc

from prd_metrics import append_metrics


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_METRICS_LOG = REPO_ROOT / ".metrics" / "prd_schema_compat.jsonl"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate a PRD and report schema-version compatibility."
    )
    parser.add_argument("prd", type=Path, help="PRD JSON file to check.")
    parser.add_argument(
        "--schema",
        type=Path,
        default=Path("schema.strict.json"),
        help="Strict schema file. Default: schema.strict.json",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("schema.versions.json"),
        help="Schema version manifest. Default: schema.versions.json",
    )
    parser.add_argument(
        "--stats-json",
        action="store_true",
        help="Emit machine-readable JSON.",
    )
    parser.add_argument(
        "--metrics-log",
        type=Path,
        default=DEFAULT_METRICS_LOG,
        help=f"Append per-run JSONL metrics to this path. Default: {DEFAULT_METRICS_LOG}",
    )
    parser.add_argument(
        "--no-metrics-log",
        action="store_true",
        help="Disable JSONL metrics logging for this run.",
    )
    return parser.parse_args()


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validation_errors(schema: dict[str, Any], data: Any) -> list[str]:
    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(data), key=lambda error: list(error.path))
    formatted = []
    for error in errors:
        path = "/" + "/".join(str(part) for part in error.path) if error.path else "/"
        formatted.append(f"{path}: {error.message}")
    return formatted


def schema_entry(manifest: dict[str, Any], version: str | None) -> dict[str, Any] | None:
    if version is None:
        return None
    for entry in manifest.get("schemas", []):
        if entry.get("schema_version") == version:
            return entry
    return None


def declared_extensions(prd: dict[str, Any]) -> list[dict[str, Any]]:
    contract = prd.get("meta", {}).get("schema_contract") or {}
    top_level = prd.get("extensions", {}).get("registry") or []
    by_id: dict[str, dict[str, Any]] = {}
    for item in contract.get("extensions") or []:
        by_id[item["extension_id"]] = item
    for item in top_level:
        by_id.setdefault(item["extension_id"], item)
    return list(by_id.values())


def check_compatibility(
    prd: dict[str, Any],
    schema: dict[str, Any],
    manifest: dict[str, Any],
    schema_errors: list[str],
) -> dict[str, Any]:
    current = manifest.get("current_schema_version")
    contract = prd.get("meta", {}).get("schema_contract")
    declared_version = contract.get("schema_version") if contract else None
    entry = schema_entry(manifest, declared_version)

    result: dict[str, Any] = {
        "schema_valid": not schema_errors,
        "schema_errors": schema_errors,
        "current_schema_version": current,
        "declared_schema_version": declared_version,
        "compatibility": "unknown",
        "fully_compatible": False,
        "backward_compatible": False,
        "migration_required": False,
        "legacy_unversioned": contract is None,
        "extensions": declared_extensions(prd),
        "required_extensions": [],
        "warnings": [],
    }

    if contract is None:
        result["compatibility"] = "legacy_unversioned"
        result["warnings"].append(
            "PRD validates structurally but does not declare meta.schema_contract."
        )
        return result

    result["required_extensions"] = [
        item for item in result["extensions"] if item.get("required") is True
    ]

    if entry is None:
        result["warnings"].append(
            f"Declared schema version {declared_version!r} is not listed in schema.versions.json."
        )
        return result

    fully_compatible = current in entry.get("fully_compatible_with", [])
    backward_compatible = current in entry.get("backward_compatible_with", [])
    migration_required = current in entry.get("migration_required_from", [])

    if declared_version == current or fully_compatible:
        result["compatibility"] = "exact" if declared_version == current else "fully_compatible"
        result["fully_compatible"] = True
    elif backward_compatible:
        result["compatibility"] = "backward_compatible"
        result["backward_compatible"] = True
    elif migration_required:
        result["compatibility"] = "migration_required"
        result["migration_required"] = True
    else:
        result["warnings"].append(
            f"No compatibility rule found from declared version {declared_version} to current version {current}."
        )

    mode = contract.get("compatibility_mode")
    if mode and mode not in {result["compatibility"], "exact"}:
        result["warnings"].append(
            f"Declared compatibility_mode={mode!r} does not match manifest result {result['compatibility']!r}."
        )

    if result["required_extensions"]:
        result["warnings"].append(
            "PRD declares required extensions; consumers must support them or fail closed."
        )

    return result


def print_human(result: dict[str, Any]) -> None:
    print(f"schema_valid={str(result['schema_valid']).lower()}")
    print(f"current_schema_version={result['current_schema_version']}")
    print(f"declared_schema_version={result['declared_schema_version']}")
    print(f"compatibility={result['compatibility']}")
    print(f"fully_compatible={str(result['fully_compatible']).lower()}")
    print(f"backward_compatible={str(result['backward_compatible']).lower()}")
    print(f"migration_required={str(result['migration_required']).lower()}")
    print(f"legacy_unversioned={str(result['legacy_unversioned']).lower()}")
    print(f"extensions={len(result['extensions'])}")
    print(f"required_extensions={len(result['required_extensions'])}")
    if result["warnings"]:
        print("warnings:")
        for warning in result["warnings"]:
            print(f"- {warning}")
    if result["schema_errors"]:
        print("schema_errors:", file=sys.stderr)
        for error in result["schema_errors"][:25]:
            print(f"- {error}", file=sys.stderr)


def main() -> int:
    args = parse_args()
    schema = load_json(args.schema)
    prd = load_json(args.prd)
    manifest = load_json(args.manifest)
    jsonschema.Draft202012Validator.check_schema(schema)
    errors = validation_errors(schema, prd)
    result = check_compatibility(prd, schema, manifest, errors)

    if args.stats_json:
        print(json.dumps(result, indent=2, sort_keys=True))
    else:
        print_human(result)

    exit_code = 0 if result["schema_valid"] and not result["migration_required"] else 1
    metrics_log = None if args.no_metrics_log else args.metrics_log
    if metrics_log is not None:
        append_metrics(
            metrics_log,
            {
                "tool": "prd_schema_compat",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "input": str(args.prd),
                "schema": str(args.schema),
                "manifest": str(args.manifest),
                "stats_json": args.stats_json,
                "schema_valid": result["schema_valid"],
                "compatibility": result["compatibility"],
                "fully_compatible": result["fully_compatible"],
                "backward_compatible": result["backward_compatible"],
                "migration_required": result["migration_required"],
                "legacy_unversioned": result["legacy_unversioned"],
                "warning_count": len(result["warnings"]),
                "schema_error_count": len(result["schema_errors"]),
                "required_extension_count": len(result["required_extensions"]),
                "exit_code": exit_code,
                "metrics_log": str(metrics_log),
            },
        )

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
