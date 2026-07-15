# AGENTS.md

## Project Overview

This repository contains PRD JSON generation and validation assets for a multi-agent PRD workflow.

- `viewer/PRD_web_ui.json` is the live canonical PRD for this framework repository; scaffolded projects receive their own root `PRD.json`.
- `schema.strict.json` is the machine-validation contract.
- `schema.json` is the descriptive schema reference.
- `.agents/*.yaml` is the **Single Source of Truth** for agent definitions (Open Agent Spec).
- `.codex/agents/` contains generated Codex TOML agent definitions.
- `.gemini/agents/` contains generated Gemini CLI Markdown agent definitions.
- `.agents/skills/*/SKILL.md` contains Agent Skills-compatible reusable PRD skills.
- `tools/sync_agents.py` synchronizes definitions from `.agents/*.yaml` to other formats.
- `plugins/prd-context/` packages focused context guidance, MCP registration, and lightweight hooks.
- `tools/prd_toon_roundtrip.py` is an optional encoding benchmark.
- `docs/agent-research.md` records evaluated external agent implementations and local-agent inclusion decisions.
- `docs/delivery-workflow.md` defines when PRD, TRD, project-tracking, external issues, tasks, and sprints change.

## Setup Commands

- Install root tooling: `npm install`
- Synchronize agents: `python3 tools/sync_agents.py`
- Validate agent formats: `npm run validate:agents`

## Code Style

- Keep generated PRD artifacts as deterministic, schema-valid JSON.
- Use `null` for unknown scalar values and `[]` for known-empty required arrays.
- Preserve existing IDs when item identity is unchanged.
- Keep skills concise and use one-level `references/`, `scripts/`, or `assets/` links when details are needed.
- Prefer small scripts for deterministic checks over asking agents to perform brittle manual validation.

## Agent Rules

- This framework repository intentionally has no root product `PRD.json`. Treat `viewer/PRD_web_ui.json` as the live artifact for repository, Viewer, and MCP-server work. Newly scaffolded PRD projects keep their own root `PRD.json` as canonical.
- When the local `prd-viewer` MCP server is available, prefer MCP reads over direct PRD file reads. Use focused discovery first, then call `build_agent_packet` with an explicit task preset and token budget. Keep `include_unresolved` false unless unresolved work is in scope.
- If the MCP server is unavailable in this repository, fall back to targeted reads of `viewer/PRD_web_ui.json`. In scaffolded projects with a root `PRD.json`, prefer `python3 tools/prd_extractor.py --summary` and `python3 tools/prd_extractor.py --section <name>`.
- Read the full PRD file only when a task strictly requires whole-document review, full-file validation, migration, deterministic serialization, complete artifact export, or schema-wide edits that cannot be handled safely through focused MCP or extractor reads.
- Treat TOON as an opt-in benchmark only, never as an agent context, compliance, merge, or release gate.
- Validate complete PRD files against `schema.strict.json`.
- Do not invent sources, citations, owners, market metrics, compliance claims, or decisions.
- Do not add undocumented top-level PRD keys.
- Keep consolidated specialist boundaries: `prd-authoring-agent` owns evidence, problem framing, goals, assumptions, requirements, personas, stories, constraints, delivery, metrics, risks, and authoring open questions in one memory context; `prd-quality-agent` validates and routes without mutating content; `prd-contract-agent` owns schema/contract migration planning; `viewer-quality-agent` owns viewer governance, accessibility review, and QA planning.
- Follow `docs/delivery-workflow.md`: start implementation from a PTW-backed external issue rather than an FR or NFR alone, and keep external live state linked through `external_refs` instead of duplicating it in the PRD.
- Prefer mega-specialist review agents for focused checks: PRD quality for schema, traceability, semantic diff, ambiguity, and repair routing; PRD contract for schema changes; viewer quality for local-first UI governance, accessibility, and test coverage.

## Open Agent Spec

- Store OA specs at `.agents/*.yaml`.
- Each OA spec should include `open_agent_spec`, `agent`, `intelligence`, and `tasks`.
- Task inputs and outputs should be JSON Schema objects when possible.
- Use `depends_on` and `spec`/`task` composition for orchestrator workflows instead of duplicating specialist prompts.

## Agent Skills

- Skill directory names and frontmatter `name` values must match.
- Skill names use lowercase letters, digits, and hyphens only.
- Each `SKILL.md` requires YAML frontmatter with non-empty `name` and `description`.
- Descriptions should explain what the skill does and when to use it.
- Keep `SKILL.md` bodies focused; move long examples or references into one-level supporting files.

## Security

- Do not send PRD content to third-party services unless the user explicitly asks.
- Do not commit secrets, tokens, or private credentials.
- Treat schema validation and deterministic serialization as release gates for PRD artifacts.

## Testing Instructions

- Run `npm run validate:agents` after changing `.codex/agents`, `.agents/*.yaml`, or `.agents/skills`.
- Run `python3 tools/prd_schema_compat.py <prd-path> --stats-json` after changing canonical PRD tooling.
- For viewer changes, follow `viewer/AGENTS.md`.
