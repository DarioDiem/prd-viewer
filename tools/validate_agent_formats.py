#!/usr/bin/env python3
"""Validate local agent, skill, and Open Agent Spec metadata formats."""

from __future__ import annotations

import re
import sys
import tomllib
from pathlib import Path
from typing import Any

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
SKILL_NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
CODEX_AGENT_DIR = REPO_ROOT / ".codex" / "agents"
OA_AGENT_DIR = REPO_ROOT / ".agents"
SKILL_DIR = REPO_ROOT / ".agents" / "skills"
OA_ALLOWED_ROLES = {"analyst", "reviewer", "chat", "retriever", "planner", "executor"}
OA_ALLOWED_SCHEMA_TYPES = {"string", "number", "integer", "boolean", "array", "object"}


def fail(errors: list[str], path: Path, message: str) -> None:
    errors.append(f"{path.relative_to(REPO_ROOT)}: {message}")


def require_mapping(errors: list[str], path: Path, value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        fail(errors, path, f"{label} must be a mapping")
        return {}
    return value


def validate_codex_agents(errors: list[str]) -> None:
    for path in sorted(CODEX_AGENT_DIR.glob("*.toml")):
        try:
            data = tomllib.loads(path.read_text(encoding="utf-8"))
        except tomllib.TOMLDecodeError as exc:
            fail(errors, path, f"invalid TOML: {exc}")
            continue

        for field in ("name", "description", "model", "model_reasoning_effort", "sandbox_mode", "developer_instructions"):
            if field not in data:
                fail(errors, path, f"missing required field {field!r}")

        if not str(data.get("description", "")).strip():
            fail(errors, path, "description must be non-empty")

        instructions = str(data.get("developer_instructions", ""))
        if "Positive:" not in instructions or "Negative:" not in instructions:
            fail(errors, path, "developer_instructions must include positive and negative examples")


def parse_frontmatter(path: Path, errors: list[str]) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        fail(errors, path, "SKILL.md must start with YAML frontmatter")
        return {}
    try:
        _, frontmatter, _body = text.split("---", 2)
    except ValueError:
        fail(errors, path, "SKILL.md frontmatter must close with ---")
        return {}
    try:
        data = yaml.safe_load(frontmatter) or {}
    except yaml.YAMLError as exc:
        fail(errors, path, f"invalid YAML frontmatter: {exc}")
        return {}
    return require_mapping(errors, path, data, "frontmatter")


def validate_skills(errors: list[str]) -> None:
    for path in sorted(SKILL_DIR.glob("*/SKILL.md")):
        data = parse_frontmatter(path, errors)
        name = data.get("name")
        description = data.get("description")

        if not isinstance(name, str) or not name:
            fail(errors, path, "frontmatter name must be a non-empty string")
        elif not SKILL_NAME_RE.fullmatch(name):
            fail(errors, path, "frontmatter name must use lowercase letters, digits, and single hyphens")
        elif name != path.parent.name:
            fail(errors, path, "frontmatter name must match parent directory name")

        if not isinstance(description, str) or not description.strip():
            fail(errors, path, "frontmatter description must be a non-empty string")
        elif len(description) > 1024:
            fail(errors, path, "frontmatter description must be <= 1024 characters")

        if "compatibility" in data and len(str(data["compatibility"])) > 500:
            fail(errors, path, "frontmatter compatibility must be <= 500 characters")


def validate_oa_agents(errors: list[str]) -> None:
    for path in sorted(OA_AGENT_DIR.glob("*.yaml")):
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        except yaml.YAMLError as exc:
            fail(errors, path, f"invalid YAML: {exc}")
            continue

        data = require_mapping(errors, path, data, "Open Agent Spec")
        if not data:
            continue

        if "open_agent_spec" not in data:
            fail(errors, path, "missing open_agent_spec")

        agent = require_mapping(errors, path, data.get("agent"), "agent")
        intelligence = require_mapping(errors, path, data.get("intelligence"), "intelligence")
        tasks = require_mapping(errors, path, data.get("tasks"), "tasks")

        for field in ("name", "description", "role"):
            if not str(agent.get(field, "")).strip():
                fail(errors, path, f"agent.{field} must be non-empty")
        if agent.get("role") and agent.get("role") not in OA_ALLOWED_ROLES:
            fail(errors, path, f"agent.role must be one of {sorted(OA_ALLOWED_ROLES)}")

        for field in ("type", "engine", "model"):
            if not str(intelligence.get(field, "")).strip():
                fail(errors, path, f"intelligence.{field} must be non-empty")

        if not tasks:
            fail(errors, path, "tasks must contain at least one task")

        for task_name, task in tasks.items():
            if not isinstance(task, dict):
                fail(errors, path, f"tasks.{task_name} must be a mapping")
                continue
            if not str(task.get("description", "")).strip():
                fail(errors, path, f"tasks.{task_name}.description must be non-empty")
            delegated = "spec" in task and "task" in task
            executable = "input" in task and "output" in task and "prompts" in task
            if not delegated and not executable:
                fail(errors, path, f"tasks.{task_name} must define either spec/task delegation or input/output/prompts")
            for schema_name in ("input", "output"):
                schema = task.get(schema_name)
                if isinstance(schema, dict):
                    validate_oa_schema_types(errors, path, schema, f"tasks.{task_name}.{schema_name}")


def validate_oa_schema_types(errors: list[str], path: Path, schema: dict[str, Any], label: str) -> None:
    schema_type = schema.get("type")
    if schema_type is not None and schema_type not in OA_ALLOWED_SCHEMA_TYPES:
        fail(errors, path, f"{label}.type must be a single OA-supported JSON type")
    properties = schema.get("properties")
    if isinstance(properties, dict):
        for property_name, property_schema in properties.items():
            if isinstance(property_schema, dict):
                validate_oa_schema_types(errors, path, property_schema, f"{label}.properties.{property_name}")


def main() -> int:
    errors: list[str] = []
    validate_codex_agents(errors)
    validate_skills(errors)
    validate_oa_agents(errors)

    if errors:
        print("Agent format validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Agent format validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
