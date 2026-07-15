#!/usr/bin/env python3
"""Synchronize AI agent definitions across Open Agent Spec, Codex, and Gemini CLI."""

import pathlib
import re
import yaml
import sys
from datetime import datetime, timezone

from pacs_metrics import append_metrics

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
OA_DIR = REPO_ROOT / ".agents"
CODEX_DIR = REPO_ROOT / ".codex" / "agents"
GEMINI_DIR = REPO_ROOT / ".gemini" / "agents"
DEFAULT_METRICS_LOG = REPO_ROOT / ".metrics" / "sync_agents.jsonl"

def ensure_dirs():
    CODEX_DIR.mkdir(parents=True, exist_ok=True)
    GEMINI_DIR.mkdir(parents=True, exist_ok=True)

def get_main_instructions(oa_data):
    """Find the first task with system prompts."""
    tasks = oa_data.get("tasks", {})
    for task_name, task in tasks.items():
        if isinstance(task, dict) and "prompts" in task and "system" in task["prompts"]:
            return task["prompts"]["system"], task_name
    return None, None

def toml_quote(s):
    """Simple TOML string escaping for multi-line strings."""
    if "\n" in s:
        return '"""\n' + s.replace('"""', r'\"\"\"') + '\n"""'
    return f'"{s}"'

def read_codex_instructions(codex_path):
    text = codex_path.read_text(encoding="utf-8")
    match = re.search(r'developer_instructions = """\n(.*?)\n"""', text, re.DOTALL)
    if match:
        return match.group(1)
    single_line = re.search(r'developer_instructions = "(.*)"', text)
    if single_line:
        return single_line.group(1)
    return ""

def sync_agent(oa_path):
    with open(oa_path, "r", encoding="utf-8") as f:
        oa_data = yaml.safe_load(f)

    agent_name = oa_data["agent"]["name"]
    description = oa_data["agent"]["description"]
    engine = oa_data.get("intelligence", {}).get("engine")
    model = oa_data["intelligence"]["model"]
    config = oa_data.get("intelligence", {}).get("config", {})
    reasoning = config.get("reasoning_effort")
    sandbox_mode = config.get("sandbox_mode", "read-only")

    instructions, task_name = get_main_instructions(oa_data)

    # 1. Migration/Enrichment: Pull from Codex if it's richer
    codex_name = agent_name.replace("-", "_")
    codex_path = CODEX_DIR / f"{codex_name}.toml"

    if codex_path.exists():
        codex_instructions = read_codex_instructions(codex_path)
        if instructions is None or len(codex_instructions) > len(instructions):
            print(f"Enriching {agent_name} from Codex TOML...")
            if task_name is None:
                # If no task with prompts, we might need to find where to put it
                # For simplicity, we assume we find one or create a dummy if it's not an orchestrator
                task_name = next(iter(oa_data.get("tasks", {})))

            oa_data["tasks"][task_name].setdefault("prompts", {})["system"] = codex_instructions
            instructions = codex_instructions
            # Write back to OA YAML to maintain SSOT
            with open(oa_path, "w", encoding="utf-8") as f:
                yaml.dump(oa_data, f, sort_keys=False, width=1000, allow_unicode=True)

    if not instructions:
        print(f"Warning: No instructions found for {agent_name}")
        return

    # 2. Generate Gemini MD
    gemini_path = GEMINI_DIR / f"{agent_name}.md"
    gemini_frontmatter = {
        "name": agent_name,
        "description": description,
    }
    gemini_model = resolve_gemini_model(engine, model, config)
    if gemini_model is not None:
        gemini_frontmatter["model"] = gemini_model

    # Add tools if relevant - for now we just give them common tools
    gemini_frontmatter["tools"] = ["read_file", "grep_search", "list_directory"]

    with open(gemini_path, "w", encoding="utf-8") as f:
        f.write("---\n")
        yaml.dump(gemini_frontmatter, f, sort_keys=False, allow_unicode=True)
        f.write("---\n\n")
        f.write(instructions.rstrip() + "\n")
    print(f"Generated {gemini_path.relative_to(REPO_ROOT)}")

    # 3. Generate/Update Codex TOML (SSOT enforcement)
    codex_content = [
        f'name = "{agent_name.replace("-", "_")}"',
        f'description = {toml_quote(description)}',
        f'model = "{model}"',
    ]
    if reasoning:
        codex_content.append(f'model_reasoning_effort = "{reasoning}"')

    codex_content.append(f'sandbox_mode = "{sandbox_mode}"')
    codex_content.append(f'developer_instructions = {toml_quote(instructions)}')

    with open(codex_path, "w", encoding="utf-8") as f:
        f.write("\n".join(codex_content) + "\n")
    print(f"Updated {codex_path.relative_to(REPO_ROOT)}")

def resolve_gemini_model(engine, model, config):
    explicit = config.get("gemini_model")
    if isinstance(explicit, str) and explicit.strip():
        return explicit.strip()
    if engine == "gemini" and isinstance(model, str) and model.strip():
        return model.strip()
    return None

def cleanup_stale_outputs(source_names):
    expected_codex = {f"{name.replace('-', '_')}.toml" for name in source_names}
    expected_gemini = {f"{name}.md" for name in source_names}

    for path in sorted(CODEX_DIR.glob("*.toml")):
        if path.name not in expected_codex:
            path.unlink()
            print(f"Removed stale {path.relative_to(REPO_ROOT)}")

    for path in sorted(GEMINI_DIR.glob("*.md")):
        if path.name not in expected_gemini:
            path.unlink()
            print(f"Removed stale {path.relative_to(REPO_ROOT)}")

def main():
    ensure_dirs()
    oa_files = sorted(OA_DIR.glob("*.yaml"))
    source_names = []
    for oa_file in oa_files:
        with open(oa_file, "r", encoding="utf-8") as f:
            source_names.append(yaml.safe_load(f)["agent"]["name"])
        sync_agent(oa_file)
    cleanup_stale_outputs(source_names)
    print("\nSynchronization complete. OA YAML is the single source of truth.")
    append_metrics(
        DEFAULT_METRICS_LOG,
        {
            "tool": "sync_agents",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source_agent_count": len(source_names),
            "codex_output_count": len(list(CODEX_DIR.glob("*.toml"))),
            "gemini_output_count": len(list(GEMINI_DIR.glob("*.md"))),
            "metrics_log": str(DEFAULT_METRICS_LOG),
        },
    )

if __name__ == "__main__":
    main()
