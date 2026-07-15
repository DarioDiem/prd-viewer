"""Command-line interface for prd_toon."""

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import jsonschema

from .core import roundtrip_one
from .toon_client import ToonClient
from .validation import load_json

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TOON_CLI = str(REPO_ROOT / "node_modules" / ".bin" / "toon")
DEFAULT_MIN_SAVINGS_PERCENT = 10.0
DEFAULT_METRICS_LOG = REPO_ROOT / ".metrics" / "prd_toon_roundtrip.jsonl"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Round-trip one or more JSON files through TOON and validate the result."
    )
    parser.add_argument("inputs", nargs="+", type=Path, help="Input JSON file(s).")
    parser.add_argument(
        "--schema",
        default="schema.strict.json",
        help="JSON Schema to validate input and round-trip JSON, or 'none' for context packets. Default: schema.strict.json",
    )
    parser.add_argument(
        "--toon-output",
        type=Path,
        help="Optional TOON output path. For batch mode, provide a directory.",
    )
    parser.add_argument(
        "--roundtrip-output",
        type=Path,
        help="Optional decoded JSON output path. For batch mode, provide a directory.",
    )
    parser.add_argument(
        "--write-toon",
        action="store_true",
        help="Write a .toon file next to each input when --toon-output is not provided.",
    )
    parser.add_argument(
        "--toon-cli",
        default=DEFAULT_TOON_CLI,
        help=f"TOON CLI command. Default: {DEFAULT_TOON_CLI!r}",
    )
    parser.add_argument(
        "--delimiter",
        choices=[",", "tab", "pipe"],
        default=",",
        help="TOON array delimiter to pass to the CLI. Use 'tab' for tab and 'pipe' for |.",
    )
    parser.add_argument(
        "--metrics-log",
        type=Path,
        default=DEFAULT_METRICS_LOG,
        help=f"Append per-file JSONL metrics to this path. Default: {DEFAULT_METRICS_LOG}",
    )
    parser.add_argument(
        "--no-metrics-log",
        action="store_true",
        help="Disable JSONL metrics logging for this run.",
    )
    parser.add_argument(
        "--stats-json",
        action="store_true",
        help="Emit machine-readable JSON stats instead of human-readable lines.",
    )
    parser.add_argument(
        "--count-tokens",
        action="store_true",
        help="Include token estimates reported by the TOON CLI.",
    )
    parser.add_argument(
        "--min-savings-percent",
        type=float,
        default=DEFAULT_MIN_SAVINGS_PERCENT,
        help="Minimum byte savings required for a useful TOON result. Default: 10",
    )
    parser.add_argument(
        "--fail-below-min-savings",
        action="store_true",
        help="Exit non-zero when byte savings are below --min-savings-percent.",
    )
    parser.add_argument(
        "--parallel",
        type=int,
        default=4,
        help="Number of parallel workers for batch processing. Default: 4",
    )
    return parser.parse_args()


def print_human(records: list[dict[str, Any]]) -> None:
    for index, record in enumerate(records):
        if index:
            print("")
        if record["success"]:
            print("TOON round-trip validation passed")
            print(f"input_json={record['input']}")
            print(f"schema={record['schema']}")
            print(f"metrics_log={record.get('metrics_log', 'disabled')}")
            print(f"toon={record['toon']}{' (temporary)' if record['toon_temporary'] else ''}")
            print(
                f"roundtrip_json={record['roundtrip_json']}"
                f"{' (temporary)' if record['roundtrip_temporary'] else ''}"
            )
            print(f"bytes_json={record['bytes_json']}")
            print(f"bytes_toon={record['bytes_toon']}")
            print(f"bytes_delta_percent={record['bytes_delta_percent']:.1f}")
            print(f"min_savings_percent={record['min_savings_percent']:.1f}")
            print(f"useful={str(record['useful']).lower()}")
            if "tokens_json_estimate" in record:
                print(f"tokens_json_estimate={record['tokens_json_estimate']}")
                print(f"tokens_toon_estimate={record['tokens_toon_estimate']}")
                print(f"tokens_saved_estimate={record.get('tokens_saved_estimate')}")
                print(
                    "tokens_delta_percent_estimate="
                    f"{record['tokens_delta_percent_estimate']:.1f}"
                )
        else:
            print("TOON round-trip validation failed", file=sys.stderr)
            print(f"input_json={record['input']}", file=sys.stderr)
            print(record.get("error", "Unknown error"), file=sys.stderr)


def main() -> int:
    args = parse_args()
    batch_mode = len(args.inputs) > 1
    schema_path = None if args.schema.lower() == "none" else Path(args.schema)
    schema_label = str(schema_path) if schema_path is not None else "none"

    if schema_path is not None and not schema_path.exists():
        print(f"Schema file not found: {schema_path}", file=sys.stderr)
        return 2

    schema = load_json(schema_path) if schema_path is not None else None
    if schema is not None:
        jsonschema.Draft202012Validator.check_schema(schema)

    toon_client = ToonClient(args.toon_cli)
    metrics_log = None if args.no_metrics_log else args.metrics_log

    def run_one(input_path: Path) -> dict[str, Any]:
        return roundtrip_one(
            input_path=input_path,
            toon_client=toon_client,
            schema=schema,
            schema_label=schema_label,
            min_savings_percent=args.min_savings_percent,
            fail_below_min_savings=args.fail_below_min_savings,
            count_tokens=args.count_tokens,
            delimiter=args.delimiter,
            toon_output=args.toon_output,
            roundtrip_output=args.roundtrip_output,
            write_toon=args.write_toon,
            metrics_log=metrics_log,
            batch_mode=batch_mode,
        )

    if batch_mode and args.parallel > 1:
        with ThreadPoolExecutor(max_workers=args.parallel) as executor:
            records = list(executor.map(run_one, args.inputs))
    else:
        records = [run_one(input_path) for input_path in args.inputs]

    if args.stats_json:
        print(json.dumps(records if batch_mode else records[0], indent=2, sort_keys=True))
    else:
        print_human(records)

    return 0 if all(record["success"] for record in records) else 1
