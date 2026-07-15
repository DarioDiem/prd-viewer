"""Core round-trip logic for PRD artifacts."""

import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .exceptions import RoundTripError
from .metrics import append_metrics, calculate_savings
from .toon_client import ToonClient
from .validation import first_diff, load_json, validate_schema


def output_path_for(
    configured: Path | None,
    input_path: Path,
    suffix: str,
    batch_mode: bool,
    temp_dir: Path,
    write_next_to_input: bool = False,
) -> tuple[Path, bool]:
    """Determine the output path for a file."""
    if configured is not None:
        if batch_mode:
            if configured.exists() and not configured.is_dir():
                raise RoundTripError(f"Batch output path must be a directory: {configured}")
            configured.mkdir(parents=True, exist_ok=True)
            return configured / f"{input_path.stem}{suffix}", False
        return configured, False
    if write_next_to_input:
        return input_path.with_suffix(suffix), False
    return temp_dir / f"{input_path.stem}{suffix}", True


def roundtrip_one(
    input_path: Path,
    toon_client: ToonClient,
    schema: dict[str, Any] | None,
    schema_label: str,
    min_savings_percent: float,
    fail_below_min_savings: bool = False,
    count_tokens: bool = False,
    delimiter: str = ",",
    toon_output: Path | None = None,
    roundtrip_output: Path | None = None,
    write_toon: bool = False,
    metrics_log: Path | None = None,
    batch_mode: bool = False,
) -> dict[str, Any]:
    """Perform a round-trip for a single JSON file."""
    started = time.perf_counter()
    run_id = f"{datetime.now(UTC).strftime('%Y%m%dT%H%M%S.%fZ')}:{input_path}"
    record: dict[str, Any] = {
        "event": "prd_toon_roundtrip",
        "event_version": 2,
        "run_id": run_id,
        "timestamp": datetime.now(UTC).isoformat(),
        "input": str(input_path),
        "schema": schema_label,
        "success": False,
        "min_savings_percent": min_savings_percent,
        "metrics_log": str(metrics_log) if metrics_log else "disabled",
        "artifact": {
            "path": str(input_path),
            "name": input_path.name,
            "schema": schema_label,
        },
        "validation": {
            "schema_enabled": schema is not None,
            "roundtrip_semantic_equal": False,
        },
    }

    try:
        if not input_path.exists():
            raise RoundTripError(f"Input file not found: {input_path}")

        original = load_json(input_path)
        if schema is not None:
            errors = validate_schema(schema, original, "input")
            if errors:
                raise RoundTripError("Input JSON failed schema validation:\n" + "\n".join(errors[:25]))

        with tempfile.TemporaryDirectory(prefix="prd-toon-") as temp_dir_name:
            temp_dir = Path(temp_dir_name)
            toon_path, toon_is_temporary = output_path_for(
                toon_output,
                input_path,
                ".toon",
                batch_mode,
                temp_dir,
                write_next_to_input=write_toon,
            )
            roundtrip_path, roundtrip_is_temporary = output_path_for(
                roundtrip_output,
                input_path,
                ".roundtrip.json",
                batch_mode,
                temp_dir,
            )

            encode_result = toon_client.encode(
                input_path,
                toon_path,
                delimiter=delimiter,
                count_tokens=count_tokens,
            )

            toon_client.decode(toon_path, roundtrip_path)

            decoded = load_json(roundtrip_path)
            if schema is not None:
                errors = validate_schema(schema, decoded, "roundtrip")
                if errors:
                    raise RoundTripError(
                        "Round-trip JSON failed schema validation:\n" + "\n".join(errors[:25])
                    )

            diff = first_diff(original, decoded)
            if diff:
                raise RoundTripError("Round-trip JSON differs from input JSON:\n" + diff)

            input_bytes = input_path.stat().st_size
            toon_bytes = toon_path.stat().st_size
            savings = calculate_savings(input_bytes, toon_bytes, min_savings_percent)

            record.update(
                {
                    "success": True,
                    "toon": str(toon_path),
                    "roundtrip_json": str(roundtrip_path),
                    "toon_temporary": toon_is_temporary,
                    "roundtrip_temporary": roundtrip_is_temporary,
                    "bytes_json": input_bytes,
                    "bytes_toon": toon_bytes,
                    "bytes_saved": savings["saved"],
                    "bytes_delta_percent": savings["percent"],
                    "useful": savings["useful"],
                    "outputs": {
                        "toon": str(toon_path),
                        "roundtrip_json": str(roundtrip_path),
                        "toon_temporary": toon_is_temporary,
                        "roundtrip_temporary": roundtrip_is_temporary,
                    },
                    "validation": {
                        "schema_enabled": schema is not None,
                        "input_schema_valid": True,
                        "roundtrip_schema_valid": schema is not None,
                        "roundtrip_semantic_equal": True,
                    },
                    "savings": {
                        "bytes": savings,
                        "tokens_estimate": None,
                    },
                }
            )

            if count_tokens:
                output = (encode_result.stdout or "") + "\n" + (encode_result.stderr or "")
                token_stats = toon_client.parse_token_stats(output)
                if not token_stats:
                    raise RoundTripError("TOON CLI did not return token estimates.")
                record.update(token_stats)
                record["savings"]["tokens_estimate"] = {
                    "json": token_stats["tokens_json_estimate"],
                    "toon": token_stats["tokens_toon_estimate"],
                    "saved": token_stats.get("tokens_saved_estimate"),
                    "percent": token_stats.get("tokens_delta_percent_estimate"),
                }

            if fail_below_min_savings and not savings["useful"]:
                raise RoundTripError(
                    f"TOON savings {savings['percent']:.1f}% below minimum "
                    f"{min_savings_percent:.1f}%"
                )

    except Exception as exc:
        record["success"] = False
        record["error"] = str(exc)
        record["validation"]["error"] = str(exc)
    finally:
        record["duration_ms"] = round((time.perf_counter() - started) * 1000)

    if metrics_log:
        append_metrics(metrics_log, record)

    return record
