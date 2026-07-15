#!/usr/bin/env python3
"""Surgical PRD extractor for context-efficient agentic workflows."""

import json
import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

from pacs_metrics import append_metrics


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_METRICS_LOG = REPO_ROOT / ".metrics" / "prd_extractor.jsonl"

def extract_sections(data, sections):
    return {k: v for k, v in data.items() if k in sections}

def generate_summary(data):
    """Generate a skeleton of the PRD with only IDs and titles."""
    summary = {
        "metadata": data.get("metadata", {}),
        "id_registry": data.get("id_registry", {}),
        "sections": {}
    }

    # Define which sections to summarize and how
    mappers = {
        "requirements": lambda items: {
            "functional": [{"req_id": r["req_id"], "title": r["title"]} for r in items.get("functional", [])],
            "non_functional": [{"req_id": r["req_id"], "description": r["description"][:50] + "..."} for r in items.get("non_functional", [])]
        },
        "user_stories": lambda items: [
            {"story_id": s["story_id"], "as_a": s.get("statement", {}).get("as_a", ""), "i_want": s.get("statement", {}).get("i_want", "")}
            for s in items
        ],
        "goals": lambda items: items,  # Goals are usually small
        "personas": lambda items: [{"persona_id": p["persona_id"], "role": p["role"]} for p in items],
        "risks": lambda items: [{"risk_id": r["risk_id"], "description": r["description"][:50] + "..."} for r in items]
    }

    for key, mapper in mappers.items():
        if key in data:
            try:
                summary["sections"][key] = mapper(data[key])
            except (KeyError, TypeError):
                summary["sections"][key] = "Error summarizing section"

    return summary

def main():
    parser = argparse.ArgumentParser(description="Extract sections or summaries from PRD.json")
    parser. agricultural_path = Path("PRD.json")
    parser.add_argument("file", help="Path to PRD.json", default="PRD.json", nargs="?")
    parser.add_argument("--section", action="append", help="Section(s) to extract (e.g. requirements)")
    parser.add_argument("--summary", action="store_true", help="Generate a summary skeleton")
    parser.add_argument("--indent", type=int, default=2, help="JSON indentation")
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

    args = parser.parse_args()

    if not Path(args.file).exists():
        print(f"Error: {args.file} not found", file=sys.stderr)
        sys.exit(1)

    with open(args.file, "r", encoding="utf-8") as f:
        data = json.load(f)

    if args.summary:
        result = generate_summary(data)
    elif args.section:
        result = extract_sections(data, args.section)
    else:
        result = data # Default to full data if nothing specified

    print(json.dumps(result, indent=args.indent))

    metrics_log = None if args.no_metrics_log else args.metrics_log
    if metrics_log is not None:
        append_metrics(
            metrics_log,
            {
                "tool": "prd_extractor",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "input": str(Path(args.file)),
                "summary": args.summary,
                "sections_requested": args.section or [],
                "section_count": len(result.get("sections", {})) if args.summary and isinstance(result, dict) else len(args.section or []),
                "indent": args.indent,
                "metrics_log": str(metrics_log),
            },
        )

if __name__ == "__main__":
    main()
