#!/usr/bin/env python3
"""Scaffold a new PRD-enabled project with a canonical PRD and MCP examples."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from string import Template
from typing import Any

from prd_metrics import append_metrics


REPO_ROOT = Path(__file__).resolve().parents[1]
TEMPLATES_DIR = REPO_ROOT / "templates" / "prd-project"
DEFAULT_METRICS_LOG = REPO_ROOT / ".metrics" / "init_prd_project.jsonl"
DEFAULT_FRAMEWORK_ROOT = REPO_ROOT
CURRENT_SCHEMA_VERSION = "1.2.0"
CURRENT_SCHEMA_ID = "https://example.com/prd.schema.strict.v1.2.0.json"
VALIDATION_FILE_BUNDLE = (
    "schema.strict.json",
    "schema.json",
    "schema.versions.json",
    "tools/prd_metrics.py",
    "tools/prd_schema_compat.py",
    "tools/prd_extractor.py",
    "tools/requirements-prd-validation.txt",
)
VALIDATION_DIR_BUNDLE: tuple[str, ...] = ()
CURATED_AGENT_FILES = (
    ".agents/prd-authoring-agent.yaml",
    ".agents/prd-contract-agent.yaml",
    ".agents/prd-development-agent.yaml",
    ".agents/prd-orchestrator.yaml",
    ".agents/prd-quality-agent.yaml",
    ".agents/viewer-quality-agent.yaml",
    ".codex/agents/prd_authoring_agent.toml",
    ".codex/agents/prd_contract_agent.toml",
    ".codex/agents/prd_development_agent.toml",
    ".codex/agents/prd_orchestrator.toml",
    ".codex/agents/prd_quality_agent.toml",
    ".codex/agents/viewer_quality_agent.toml",
    ".gemini/agents/prd-authoring-agent.md",
    ".gemini/agents/prd-contract-agent.md",
    ".gemini/agents/prd-development-agent.md",
    ".gemini/agents/prd-orchestrator.md",
    ".gemini/agents/prd-quality-agent.md",
    ".gemini/agents/viewer-quality-agent.md",
)
CURATED_SKILL_DIRS = (
    ".agents/skills/prd-constraints-risk-planning",
    ".agents/skills/prd-development-execution",
    ".agents/skills/prd-id-governance",
    ".agents/skills/prd-orchestrator-execution",
    ".agents/skills/prd-requirements-quality",
    ".agents/skills/prd-research-evidence",
    ".agents/skills/prd-schema-contract",
    ".agents/skills/prd-user-stories-quality",
    ".agents/skills/prd-validation-gate",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Initialize a reusable PRD project scaffold."
    )
    parser.add_argument("target_dir", type=Path, help="Directory to create.")
    parser.add_argument(
        "--project-name",
        type=str,
        default=None,
        help="Human-readable project name. Defaults to the target directory name.",
    )
    parser.add_argument(
        "--project-id",
        type=str,
        default=None,
        help="Stable slug-like project identifier. Defaults to a slug from the project name.",
    )
    parser.add_argument(
        "--author",
        type=str,
        default="Codex",
        help="Initial PRD author. Default: Codex",
    )
    parser.add_argument(
        "--transport",
        choices=("stdio", "http"),
        default="stdio",
        help="Preferred transport to record in prd.config.json. Default: stdio",
    )
    parser.add_argument(
        "--http-host",
        type=str,
        default="127.0.0.1",
        help="Localhost bind host for optional HTTP mode. Default: 127.0.0.1",
    )
    parser.add_argument(
        "--http-port",
        type=int,
        default=3334,
        help="Port for optional HTTP mode. Default: 3334",
    )
    parser.add_argument(
        "--http-path",
        type=str,
        default="/mcp",
        help="Path for optional HTTP mode. Default: /mcp",
    )
    parser.add_argument(
        "--framework-root",
        type=Path,
        default=DEFAULT_FRAMEWORK_ROOT,
        help=f"PRD framework root. Default: {DEFAULT_FRAMEWORK_ROOT}",
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
    parser.add_argument(
        "--include-agents",
        action="store_true",
        help="Copy a legacy self-contained set of PRD agent definitions and skills into the project.",
    )
    parser.add_argument(
        "--remove-legacy-agents",
        action="store_true",
        help="With --upgrade-existing, remove PRD assets previously copied by --include-agents.",
    )
    parser.add_argument(
        "--upgrade-existing",
        action="store_true",
        help="Refresh framework-managed files in an existing project directory instead of requiring an empty target.",
    )
    parser.add_argument(
        "--refresh-prd",
        action="store_true",
        help="When upgrading an existing project, replace PRD.json with a fresh bootstrap scaffold.",
    )
    return parser.parse_args()


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "prd-project"


def titleize_slug(value: str) -> str:
    return " ".join(part.capitalize() for part in value.replace("_", "-").split("-") if part)


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def render_template(name: str, substitutions: dict[str, str]) -> str:
    template_path = TEMPLATES_DIR / name
    template = Template(template_path.read_text(encoding="utf-8"))
    return template.safe_substitute(substitutions)


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def ensure_target_dir(path: Path, *, allow_existing: bool) -> None:
    if path.exists():
        if not path.is_dir():
            raise SystemExit(f"Target path is not a directory: {path}")
        if any(path.iterdir()) and not allow_existing:
            raise SystemExit(
                f"Target directory is not empty: {path}. Use a new directory for bootstrap."
            )
    else:
        path.mkdir(parents=True, exist_ok=True)


def read_json_if_exists(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def merge_project_config(defaults: dict[str, Any], existing: dict[str, Any] | None) -> dict[str, Any]:
    if existing is None:
        return defaults

    merged = json.loads(json.dumps(defaults))
    for top_key in ("project", "prd", "metrics", "mcp"):
        if isinstance(existing.get(top_key), dict) and isinstance(merged.get(top_key), dict):
            merged[top_key].update(existing[top_key])
        elif top_key in existing:
            merged[top_key] = existing[top_key]
    if isinstance(existing.get("mcp"), dict) and isinstance(existing["mcp"].get("http"), dict):
        merged["mcp"].setdefault("http", {})
        merged["mcp"]["http"].update(existing["mcp"]["http"])
    return merged


def copy_curated_agent_assets(*, framework_root: Path, target_dir: Path) -> list[str]:
    copied: list[str] = []

    for relative_path in CURATED_AGENT_FILES:
        source = framework_root / relative_path
        destination = target_dir / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied.append(relative_path)

    for relative_dir in CURATED_SKILL_DIRS:
        source_dir = framework_root / relative_dir
        destination_dir = target_dir / relative_dir
        shutil.copytree(source_dir, destination_dir, dirs_exist_ok=True)
        copied.extend(
            str(path.relative_to(target_dir)).replace("\\", "/")
            for path in destination_dir.rglob("*")
            if path.is_file()
        )

    return copied


def remove_curated_agent_assets(*, framework_root: Path, target_dir: Path) -> list[str]:
    removed: list[str] = []

    for relative_path in CURATED_AGENT_FILES:
        target = target_dir / relative_path
        if target.is_file():
            target.unlink()
            removed.append(relative_path)

    for relative_dir in CURATED_SKILL_DIRS:
        source_dir = framework_root / relative_dir
        target_dir_path = target_dir / relative_dir
        if source_dir.is_dir() and target_dir_path.is_dir():
            for source_path in source_dir.rglob("*"):
                if not source_path.is_file():
                    continue
                relative_path = source_path.relative_to(framework_root)
                target = target_dir / relative_path
                if target.is_file():
                    target.unlink()
                    removed.append(str(relative_path).replace("\\", "/"))

            for directory in sorted(
                (path for path in target_dir_path.rglob("*") if path.is_dir()),
                key=lambda path: len(path.parts),
                reverse=True,
            ):
                try:
                    directory.rmdir()
                except OSError:
                    pass

    for relative_dir in (
        ".agents/skills",
        ".agents",
        ".codex/agents",
        ".codex",
        ".gemini/agents",
        ".gemini",
    ):
        directory = target_dir / relative_dir
        if directory.is_dir():
            try:
                directory.rmdir()
            except OSError:
                pass

    return sorted(set(removed))


def copy_validation_bundle(*, framework_root: Path, target_dir: Path) -> list[str]:
    copied: list[str] = []

    for relative_path in VALIDATION_FILE_BUNDLE:
        source = framework_root / relative_path
        destination = target_dir / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied.append(relative_path)

    for relative_dir in VALIDATION_DIR_BUNDLE:
        source_dir = framework_root / relative_dir
        destination_dir = target_dir / relative_dir
        shutil.copytree(
            source_dir,
            destination_dir,
            dirs_exist_ok=True,
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
        )
        copied.extend(
            str(path.relative_to(target_dir)).replace("\\", "/")
            for path in destination_dir.rglob("*")
            if path.is_file()
        )

    return copied


def build_prd(
    *,
    prd_id: str,
    project_name: str,
    author: str,
    created_at: str,
) -> dict[str, Any]:
    return {
        "meta": {
            "prd_id": prd_id,
            "title": f"{project_name} Product Requirements",
            "summary": f"A starter PRD scaffold for {project_name} that should be replaced with project-specific product intent before implementation work begins.",
            "product_name": project_name,
            "document_type": "prd",
            "version": "0.1.0",
            "status": "draft",
            "lifecycle_stage": "discovery",
            "owners": {
                "product": None,
                "engineering": None,
                "design": None,
                "business": None,
                "compliance": None,
            },
            "authors": [author],
            "reviewers": [],
            "approvers": [],
            "created_at": created_at,
            "updated_at": created_at,
            "target_release": None,
            "stakeholders": [
                {
                    "name": "Project sponsor",
                    "role": "Sets business direction and approves scope",
                    "team": None,
                    "approval_required": True,
                },
                {
                    "name": "Product owner",
                    "role": "Maintains the canonical PRD and prioritizes delivery",
                    "team": None,
                    "approval_required": False,
                },
            ],
            "source_brief": None,
            "links": [],
            "schema_contract": {
                "schema_id": CURRENT_SCHEMA_ID,
                "schema_version": CURRENT_SCHEMA_VERSION,
                "compatible_schema_versions": [CURRENT_SCHEMA_VERSION],
                "compatibility_mode": "exact",
                "extension_policy": "core_only",
                "migrations": [],
                "extensions": [],
            },
        },
        "problem": {
            "statement": f"{project_name} does not yet have project-specific problem framing recorded in a canonical PRD artifact.",
            "background": "This scaffold exists to give a solo developer and local agent tools a deterministic starting point for planning, validation, and implementation.",
            "opportunity": "Replace the placeholder problem framing with project-specific evidence and delivery intent, then use the local MCP server for focused PRD reads instead of repeated whole-document loading.",
            "strategic_fit": "Supports a local, schema-validated PRD workflow that can be reused across multiple projects.",
            "affected_users": ["Solo developer", "Project stakeholder"],
            "evidence": [
                {
                    "type": "internal_data",
                    "description": "A structured PRD is needed before implementation can be reviewed and tracked consistently.",
                    "source": "Initial PRD bootstrap workflow",
                    "confidence": "medium",
                    "observed_at": None,
                },
                {
                    "type": "user_research",
                    "description": "Agentic workflows become expensive when every task requires reading the full PRD document.",
                    "source": "Local framework requirements",
                    "confidence": "medium",
                    "observed_at": None,
                },
                {
                    "type": "other",
                    "description": "A reusable starter artifact reduces setup friction across multiple projects.",
                    "source": "Framework extraction plan",
                    "confidence": "medium",
                    "observed_at": None,
                },
            ],
        },
        "goals": {
            "business_goals": [
                {
                    "statement": "Establish a project-specific PRD that can drive implementation and review decisions.",
                    "rationale": "A canonical artifact is needed before the project can use PRD tooling effectively.",
                    "owner": None,
                    "priority": "primary",
                }
            ],
            "user_outcomes": [
                {
                    "actor": "Solo developer",
                    "desired_outcome": "Understand and refine project scope without rereading the full PRD on every task.",
                    "measurement_signal": "Focused MCP packets are sufficient for day-to-day implementation work.",
                }
            ],
            "success_metrics": [
                {
                    "metric": "Project-specific PRD completion",
                    "baseline": "Bootstrap template only",
                    "target": "Project-ready PRD with validated requirements, stories, and risks",
                    "unit": "state",
                    "measurement_method": "Schema validation plus review of replaced placeholder content",
                    "timeframe_days": 14,
                }
            ],
            "guardrail_metrics": [
                {
                    "metric": "Redacted local metrics coverage",
                    "baseline": "No project-local metrics yet",
                    "target": "Bootstrap, validation, and MCP usage all emit content-redacted local metrics",
                    "unit": "state",
                    "measurement_method": "Presence of project-local JSONL metrics without PRD payload leakage",
                    "timeframe_days": 14,
                }
            ],
            "non_goals": [
                "Do not treat placeholder PRD content as product-approved scope.",
                "Do not introduce a backend dependency for canonical PRD storage.",
            ],
        },
        "assumptions": [
            {
                "assumption_id": "A-001",
                "statement": "The project can keep its canonical PRD as a local JSON file during early planning and implementation.",
                "category": "operational",
                "validation_plan": "Confirm that the project workflow can load, validate, and review the PRD locally.",
                "owner": None,
                "status": "open",
            }
        ],
        "personas": [
            {
                "persona_id": "P-001",
                "name": "Solo developer",
                "role": "Maintains the PRD and implementation plan",
                "goals": [
                    "Refine the project scope without losing traceability.",
                    "Use focused local agent context instead of repeated full-document reads.",
                ],
                "needs": [
                    "A canonical PRD artifact",
                    "Schema validation",
                    "Compact agent context packets",
                ],
                "pain_points": [
                    "Placeholder project framing blocks precise implementation work.",
                    "Large PRD artifacts can waste tokens in agentic workflows.",
                ],
                "current_workarounds": [
                    "Manual PRD edits",
                    "Reading more of the document than each task actually needs",
                ],
                "frequency_of_use": "daily",
                "technical_proficiency": "high",
                "environment": "Local development workstation",
            }
        ],
        "requirements": {
            "functional": [
                {
                    "req_id": "FR-001",
                    "title": "Maintain a canonical project PRD",
                    "description": "The project must keep a canonical PRD.json artifact that humans and local agent tools can validate, review, and update.",
                    "rationale": "The PRD framework depends on one deterministic source of truth for product scope.",
                    "priority": "must",
                    "persona_ids": ["P-001"],
                    "dependencies": [],
                    "acceptance_criteria": [
                        "A schema-valid PRD.json exists at the project root.",
                        "Project-specific problem framing, requirements, stories, and risks can replace the bootstrap placeholders without changing the contract shape.",
                    ],
                    "status": "approved",
                    "release_phase": "mvp",
                }
            ],
            "non_functional": [
                {
                    "req_id": "NFR-001",
                    "category": "observability",
                    "description": "Local PRD tooling for the project should emit content-redacted metrics that help evaluate whether focused PRD access is useful.",
                    "target": "Bootstrap, validation, and MCP workflows log local metrics without storing PRD payloads or large free-text fields.",
                    "priority": "should",
                    "acceptance_criteria": [
                        "Metrics stay local to the project or framework workspace.",
                        "Metrics do not include raw PRD content or arbitrary free-text prompts.",
                    ],
                }
            ],
        },
        "user_stories": [
            {
                "story_id": "US-001",
                "epic": "PRD foundation",
                "persona_id": "P-001",
                "priority": "must",
                "release_phase": "mvp",
                "statement": {
                    "as_a": "solo developer",
                    "i_want": "a canonical local PRD scaffold with reusable validation and MCP guidance",
                    "so_that": "I can replace placeholder scope with project-specific content and keep subsequent implementation work traceable",
                },
                "acceptance_criteria": [
                    {
                        "given": "a new project initialized from the PRD bootstrap",
                        "when": "the developer opens the project files",
                        "then": "the project contains a schema-valid PRD, local agent instructions, and MCP registration guidance",
                    }
                ],
                "linked_req_ids": ["FR-001"],
                "story_points": None,
                "edge_cases": [
                    "The generated PRD still contains placeholder content that must be replaced before production use."
                ],
            }
        ],
        "constraints": {
            "technical": [
                {
                    "constraint_id": "TC-001",
                    "description": "Keep the canonical PRD as JSON on disk and treat derived indexes, metrics, and MCP packets as rebuildable.",
                    "imposed_by": "architecture",
                    "impact": "The bootstrap flow must generate files, not a hidden mutable store.",
                }
            ],
            "legal_compliance": [],
            "dependencies": [],
        },
        "delivery": {
            "target_launch": None,
            "milestones": [
                {
                    "name": "Replace bootstrap content",
                    "date": None,
                    "deliverable": "Project-specific PRD content with validated requirements, stories, and risks",
                    "entry_criteria": [
                        "Bootstrap scaffold exists",
                        "Project stakeholders are identified",
                    ],
                    "exit_criteria": [
                        "Placeholder content is replaced",
                        "PRD validates against the strict schema",
                    ],
                    "owner": None,
                }
            ],
            "rollout_plan": {
                "strategy": "Start with local validation and MCP-assisted planning before broader implementation work.",
                "phases": [
                    {
                        "name": "Bootstrap",
                        "audience": "Solo developer",
                        "success_criteria": [
                            "The project can validate PRD.json locally.",
                            "The agent client can register the local PRD MCP server for this project.",
                        ],
                        "owner": None,
                    }
                ],
                "communications": [],
                "training": [],
                "support_handoff": [],
            },
            "operational_readiness": [
                {
                    "area": "Local PRD setup",
                    "owner": None,
                    "status": "in_progress",
                    "notes": "Complete project-specific PRD refinement and install the PRD Context plugin before relying on agent workflows.",
                }
            ],
        },
        "project_tracking": {
            "status": "in_progress",
            "owner": None,
            "summary": "Bootstrap scaffold created. Replace placeholder product content and install the PRD Context plugin for focused PRD access.",
            "updated_at": created_at,
            "linked_prd_ids": [prd_id],
            "pending_work": [
                {
                    "work_item_id": "PTW-001",
                    "title": "Replace placeholder PRD content with project-specific scope",
                    "description": "Rewrite the bootstrap problem framing, goals, requirements, stories, constraints, risks, questions, and decisions to match the real project.",
                    "status": "not_started",
                    "priority": "critical",
                    "owner": None,
                    "linked_prd_ids": [prd_id],
                    "linked_entity_ids": ["FR-001", "US-001", "R-001", "Q-001", "DEC-001"],
                    "external_refs": [],
                    "notes": "The starter artifact is valid but intentionally generic.",
                },
                {
                    "work_item_id": "PTW-002",
                    "title": "Install the PRD Context plugin for this project",
                    "description": "Install the plugin so its bundled MCP server can resolve prd.config.json and provide focused reads without per-project environment variables.",
                    "status": "not_started",
                    "priority": "high",
                    "owner": None,
                    "linked_prd_ids": [prd_id],
                    "linked_entity_ids": ["FR-001", "NFR-001", "PTN-001"],
                    "external_refs": [],
                    "notes": "See docs/mcp-registration.md for plugin installation, verification, and optional localhost HTTP examples.",
                },
            ],
            "issues_found": [],
            "blockers": [],
            "notes": [
                {
                    "note_id": "PTN-001",
                    "note": "This scaffold is meant to be edited immediately for project-specific scope rather than treated as a finished PRD.",
                    "owner": "Codex",
                    "noted_at": created_at,
                    "linked_prd_ids": [prd_id],
                    "linked_entity_ids": ["FR-001", "US-001"],
                    "external_refs": [],
                }
            ],
        },
        "risks": [
            {
                "risk_id": "R-001",
                "description": "Placeholder scaffold content may be mistaken for approved project scope if it is not replaced promptly.",
                "category": "operational",
                "probability": "medium",
                "impact": "high",
                "score": 6,
                "mitigation": "Replace bootstrap content before implementation and keep validation as a release gate.",
                "owner": None,
                "trigger": "Work begins against the scaffold without a project-specific PRD review.",
            }
        ],
        "open_questions": [
            {
                "question_id": "Q-001",
                "question": "Which external systems, stakeholders, and constraints should be represented explicitly in this project's first real PRD revision?",
                "raised_by": author,
                "raised_at": created_at,
                "status": "open",
                "resolution": None,
            }
        ],
        "decisions": [
            {
                "decision_id": "DEC-001",
                "title": "Keep the canonical PRD as JSON on disk",
                "statement": "The project will treat PRD.json as the canonical source of truth and keep all derived MCP indexes, metrics, and packets rebuildable.",
                "rationale": "This keeps local agent workflows deterministic and aligned with the PRD framework contract.",
                "owner": None,
                "decided_at": None,
                "status": "accepted",
                "linked_req_ids": ["FR-001", "NFR-001"],
            }
        ],
        "extensions": {
            "registry": [],
            "data": {},
        },
    }


def build_project_config(
    *,
    project_id: str,
    project_name: str,
    transport: str,
    http_host: str,
    http_port: int,
    http_path: str,
) -> dict[str, Any]:
    return {
        "project": {
            "id": project_id,
            "name": project_name,
        },
        "prd": {
            "path": "PRD.json",
        },
        "metrics": {
            "path": ".metrics/prd_viewer_mcp.jsonl",
        },
        "mcp": {
            "transport": transport,
            "http": {
                "host": http_host,
                "port": http_port,
                "path": http_path,
                "allowedOrigins": [],
            },
        },
    }


def main() -> int:
    args = parse_args()
    target_dir = args.target_dir.expanduser().resolve()
    framework_root = args.framework_root.expanduser().resolve()
    upgrading = args.upgrade_existing

    if args.remove_legacy_agents and not upgrading:
        raise SystemExit("--remove-legacy-agents requires --upgrade-existing.")
    if args.remove_legacy_agents and args.include_agents:
        raise SystemExit("--remove-legacy-agents cannot be combined with --include-agents.")

    ensure_target_dir(target_dir, allow_existing=upgrading)

    existing_prd = read_json_if_exists(target_dir / "PRD.json") if upgrading else None
    existing_config = read_json_if_exists(target_dir / "prd.config.json") if upgrading else None
    existing_trd = upgrading and (target_dir / "TRD.md").exists()
    existing_has_local_agents = upgrading and any(
        (target_dir / relative).is_file()
        for relative in (
            *CURATED_AGENT_FILES,
            *(f"{relative_dir}/SKILL.md" for relative_dir in CURATED_SKILL_DIRS),
        )
    )

    inferred_project_name = None
    if isinstance(existing_config, dict):
        inferred_project_name = existing_config.get("project", {}).get("name")
    if inferred_project_name is None and isinstance(existing_prd, dict):
        inferred_project_name = existing_prd.get("meta", {}).get("product_name")

    project_name = args.project_name or inferred_project_name or titleize_slug(target_dir.name)
    inferred_project_id = None
    if isinstance(existing_config, dict):
        inferred_project_id = existing_config.get("project", {}).get("id")
    project_id = args.project_id or inferred_project_id or slugify(project_name)
    created_at = iso_now()
    prd_id = (
        existing_prd.get("meta", {}).get("prd_id")
        if isinstance(existing_prd, dict) and existing_prd.get("meta", {}).get("prd_id")
        else str(uuid.uuid4())
    )

    prd_path = target_dir / "PRD.json"
    trd_path = target_dir / "TRD.md"
    metrics_dir = target_dir / ".metrics"
    project_metrics_path = metrics_dir / "prd_viewer_mcp.jsonl"
    mcp_package_root = framework_root / "mcp"
    mcp_entrypoint = mcp_package_root / "dist" / "index.js"
    http_url = f"http://{args.http_host}:{args.http_port}{args.http_path}"
    server_name = f"{project_id}-prd-viewer"
    included_agent_files: list[str] = []
    removed_agent_files: list[str] = []
    validation_files = copy_validation_bundle(
        framework_root=framework_root,
        target_dir=target_dir,
    )
    use_local_agents = not args.remove_legacy_agents and (
        args.include_agents or existing_has_local_agents
    )

    if args.remove_legacy_agents:
        removed_agent_files = remove_curated_agent_assets(
            framework_root=framework_root,
            target_dir=target_dir,
        )

    metrics_dir.mkdir(parents=True, exist_ok=True)
    write_text(metrics_dir / ".gitkeep", "")
    if not prd_path.exists() or args.refresh_prd:
        write_json(
            prd_path,
            build_prd(
                prd_id=prd_id,
                project_name=project_name,
                author=args.author,
                created_at=created_at,
            ),
        )
    if not trd_path.exists():
        write_text(
            trd_path,
            render_template(
                "TRD.md.template",
                {
                    "PRD_ID": prd_id,
                    "PROJECT_NAME": project_name,
                },
            ),
        )
    merged_config = merge_project_config(
        build_project_config(
            project_id=project_id,
            project_name=project_name,
            transport=args.transport,
            http_host=args.http_host,
            http_port=args.http_port,
            http_path=args.http_path,
        ),
        existing_config,
    )
    write_json(target_dir / "prd.config.json", merged_config)
    write_text(
        target_dir / "AGENTS.md",
        render_template(
            "AGENTS.md.template",
            {
                "FRAMEWORK_ROOT": str(framework_root),
                "PROJECT_STATE_NOTE": (
                    "This project retains its existing schema-valid PRD and implementation progress; preserve stable IDs and update status only after matching behavior is verified."
                    if upgrading
                    else "This scaffold starts with a minimal schema-valid PRD. Replace the placeholder product framing, requirements, stories, risks, questions, and decisions with project-specific content before treating the artifact as production-ready."
                ),
                "AGENT_MODE_SUMMARY": (
                    "This project also includes a curated local copy of the PRD `.agents/`, `.codex/agents/`, `.gemini/agents/`, and reusable PRD skills so the bootstrap can run self-contained."
                    if use_local_agents
                    else "This project uses the installed PRD Context plugin for focused PRD context. Specialist agent definitions are optional and are not copied into the project by default."
                ),
                "AGENT_MODE_WORKFLOW": (
                    "Prefer the local `.agents/`, `.codex/agents/`, `.gemini/agents/`, and `.agents/skills/` copies in this project when your client supports project-local agent discovery."
                    if use_local_agents
                    else "Use the PRD Context plugin for focused MCP reads. Install or keep project-local specialist agent definitions only when a client workflow explicitly depends on them."
                ),
            },
        ),
    )
    write_text(
        target_dir / ".gitignore",
        render_template("gitignore.template", {}),
    )
    write_text(
        target_dir / "docs" / "mcp-registration.md",
        render_template(
            "mcp-registration.md.template",
            {
                "FRAMEWORK_ROOT": str(framework_root),
                "MCP_PACKAGE_ROOT": str(mcp_package_root),
                "MCP_ENTRYPOINT": str(mcp_entrypoint),
                "PRD_PATH": str(prd_path),
                "PROJECT_METRICS_PATH": str(project_metrics_path),
                "SERVER_NAME": server_name,
                "HTTP_HOST": args.http_host,
                "HTTP_PORT": str(args.http_port),
                "HTTP_PATH": args.http_path,
                "HTTP_URL": http_url,
            },
        ),
    )
    write_text(
        target_dir / "docs" / "delivery-workflow.md",
        (framework_root / "docs" / "delivery-workflow.md").read_text(encoding="utf-8"),
    )

    if use_local_agents:
        included_agent_files = copy_curated_agent_assets(
            framework_root=framework_root,
            target_dir=target_dir,
        )

    print(f"{'Upgraded' if upgrading else 'Initialized'} PRD project scaffold at {target_dir}")
    print(f"- PRD: {prd_path}")
    print(f"- TRD: {trd_path}")
    print(f"- Config: {target_dir / 'prd.config.json'}")
    print(f"- Agent instructions: {target_dir / 'AGENTS.md'}")
    print(f"- MCP registration guide: {target_dir / 'docs' / 'mcp-registration.md'}")
    print(f"- Delivery workflow: {target_dir / 'docs' / 'delivery-workflow.md'}")
    print("- Local validation bundle: schema.strict.json, schema.json, schema.versions.json, tools/")
    if use_local_agents:
        print("- Included local agent assets: .agents/, .codex/agents/, .gemini/agents/")
    if args.remove_legacy_agents:
        print(f"- Removed {len(removed_agent_files)} legacy PRD agent asset files")
    if upgrading and prd_path.exists() and not args.refresh_prd:
        print("- Preserved existing PRD.json")
    if existing_trd:
        print("- Preserved existing TRD.md when present")

    metrics_log = None if args.no_metrics_log else args.metrics_log
    if metrics_log is not None:
        append_metrics(
            metrics_log,
            {
                "tool": "init_prd_project",
                "timestamp": created_at,
                "target_dir": str(target_dir),
                "project_id": project_id,
                "project_name_length": len(project_name),
                "transport": args.transport,
                "http_host": args.http_host,
                "http_port": args.http_port,
                "http_path": args.http_path,
                "framework_root": str(framework_root),
                "generated_files": [
                    "PRD.json",
                    "TRD.md",
                    "prd.config.json",
                    "AGENTS.md",
                    ".gitignore",
                    "docs/mcp-registration.md",
                    "docs/delivery-workflow.md",
                    ".metrics/.gitkeep",
                ]
                + validation_files
                + included_agent_files,
                "include_agents": use_local_agents,
                "remove_legacy_agents": args.remove_legacy_agents,
                "removed_agent_files": removed_agent_files,
                "upgrade_existing": upgrading,
                "refresh_prd": args.refresh_prd,
                "metrics_log": str(metrics_log),
            },
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
