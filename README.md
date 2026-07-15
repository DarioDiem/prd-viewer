# PRD Creation Framework

Project-level schema, tools, and skills for versioned PRD JSON generation, validation, review, and agent handoff.

The repository also contains the local-first [PRD Viewer](viewer/README.md),
whose product definition and technical design live in
`viewer/PRD_web_ui.json` and `viewer/TRD.md`.

## Quick start

Requirements: Node.js 20.19 or newer and Python 3.11 or newer.

```bash
npm ci
npm --prefix mcp ci
npm --prefix viewer ci
python3 -m pip install -r tools/requirements-pacs-validation.txt
npm run validate:agents
python3 tools/prd_schema_compat.py viewer/PRD_web_ui.json --stats-json
npm --prefix mcp test
npm --prefix viewer run check
npm --prefix viewer test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete validation flow and
[SECURITY.md](SECURITY.md) for private vulnerability reporting guidance.

Scaffolded projects receive a canonical `PRD.json` and linked `TRD.md`. This
framework repository intentionally uses `viewer/PRD_web_ui.json` as its live PRD
for its own implementation and delivery workflow.
See `docs/trd-framework.md` for the header,
traceability, OpenAPI, Mermaid, and decision-log conventions.

See `docs/delivery-workflow.md` for the lifecycle connecting PRD requirements,
PTW records, TRDs, external issues, tasks, sprints, pull requests, and
verification evidence.

## Schema

- `schema.json` - Reference contract for the production-grade PRD JSON shape.
- `schema.strict.json` - Strict machine-validation schema used by the agents and validation flow.
- `schema.versions.json` - Version manifest for schema compatibility, migration policy, and extension behavior.

The current contract covers document metadata, problem framing, goals, assumptions, personas, requirements, user stories, constraints, delivery planning, optional project tracking, risks, open questions, and decisions.

Schema 1.2 adds optional `external_refs` URI arrays to project-tracking records
so durable PRD status can link to GitHub or another workflow system without
duplicating its live execution state.

## Versioning and Extensions

JSON remains the canonical PRD artifact. `meta.version` is the document version. `meta.schema_contract.schema_version` is the framework schema version used to validate and interpret the document.

PRDs may optionally declare:

- `meta.schema_contract` - schema ID, schema version, compatible versions, migration notes, and required extensions.
- `extensions` - namespaced extension registry and extension payloads that stay separate from core PRD sections.

Core agents and viewers must preserve unknown extension data during round trips. If an unknown extension is marked required, consumers must fail closed, ask for support, or require explicit authorized override before writeback.

Check schema compatibility:

```bash
python3 tools/prd_schema_compat.py viewer/PRD_web_ui.json
```

Metrics for `tools/prd_schema_compat.py` and `tools/prd_extractor.py` are enabled by default and append content-redacted JSONL rows under `.metrics/` unless explicitly disabled for a run.

Documents without `meta.schema_contract` are treated as legacy unversioned: they may still validate structurally, but they cannot prove framework compatibility.

## Optional TOON Benchmark

Focused MCP reads and token-budgeted agent packets are the default context path. TOON is retained only for opt-in encoding benchmarks; it is not a compliance, merge, ingestion, or release gate.

Install the pinned local TOON CLI dependency before first use:

```bash
npm install
```

- Benchmark this repository's Viewer PRD round trip through TOON:

  ```bash
  python3 tools/prd_toon_roundtrip.py viewer/PRD_web_ui.json
  ```

- Generate a derived `.toon` file after validation:

  ```bash
  python3 tools/prd_toon_roundtrip.py viewer/PRD_web_ui.json --write-toon
  ```

- Validate a partial agent context packet without the full PRD schema:

  ```bash
  python3 tools/prd_toon_roundtrip.py context_packet.json --schema none
  ```

- Emit machine-readable stats and persistent JSONL metrics:

  ```bash
  python3 tools/prd_toon_roundtrip.py viewer/PRD_web_ui.json --stats-json
  ```

  Metrics are written by default to `.metrics/prd_toon_roundtrip.jsonl`. Use `--metrics-log <path>` to write somewhere else or `--no-metrics-log` to disable logging for one run.

- Include token estimates and require at least 10% byte savings:

  ```bash
  python3 tools/prd_toon_roundtrip.py viewer/PRD_web_ui.json --count-tokens --fail-below-min-savings
  ```

- Scaffolded projects can pass their own `PRD.json`; this repository can validate
  the Viewer PRD plus another context packet in one run:

  ```bash
  python3 tools/prd_toon_roundtrip.py viewer/PRD_web_ui.json context_packet.json --schema none --stats-json
  ```

The benchmark uses the pinned local official `@toon-format/cli` converter and verifies that decoded JSON is semantically identical to the input. Results remain local under `.metrics/` and are not consumed by the viewer or agent workflow.

## Agent Context Plugin

`plugins/pacs-context` packages the focused-context skill, a bundled `pacs-prd` MCP runtime, and short session/subagent routing hooks. The MCP server resolves the open project's `pacs.config.json` through MCP Roots, so installed projects do not need `PACS_PROJECT_ROOT`, `PACS_PRD_PATH`, or a checkout of this framework. The hooks do not transcode or load PRD data; they direct agents to focused discovery and `build_agent_packet` with an explicit task preset and token budget.

Projects created with the former `--include-agents` option may keep those local definitions. To remove only the known PACS-vendored assets after moving to the plugin, review the project in Git and run:

```bash
python3 tools/init_pacs_project.py /path/to/project \
  --upgrade-existing \
  --remove-legacy-agents
```

This cleanup is explicit because project-local agent files may have been customized. It is optional: keep them when a client still depends on the specialist subagent definitions.

## Skills

- `prd-schema-contract` - Top-level schema contract and normalization rules.
- `prd-id-governance` - Shared ID registry and deterministic ID assignment.
- `prd-orchestrator-execution` - Dependency-aware orchestration and merge policy.
- `prd-development-execution` - Development-mode PRD implementation, compact context loading, and focused delegation rules.
- `prd-research-evidence` - Problem/evidence/business-goal synthesis rules.
- `prd-requirements-quality` - Functional and non-functional requirement quality rules.
- `prd-user-stories-quality` - Persona + INVEST story + GWT acceptance criteria rules.
- `prd-constraints-risk-planning` - Constraints, dependencies, milestones, metrics, risks.
- `prd-validation-gate` - Final validation and repair routing logic.

## Agent Formats

- `AGENTS.md` - Repo-level coding-agent instructions in the AGENTS.md format.
- `viewer/AGENTS.md` - Subproject-specific instructions for the web UI.
- `.codex/agents/*.toml` - Codex agent definitions used by this workspace.
- `.agents/*.yaml` - Open Agent Spec definitions for the PRD orchestrator and specialist agents.
- `.agents/skills/*/SKILL.md` - Agent Skills-compatible skill packages.
- `docs/agent-research.md` - Research notes for evaluated external agent implementations and local-agent decisions.

Validate local agent metadata and examples:

```bash
npm run validate:agents
```

Validate with the official Open Agent Spec CLI:

```bash
python3 -m pip install open-agent-spec -t .agent-tools/open-agent-spec
npm run validate:oa
```

## Local Agent Inventory

The active consolidated roster is generated from `.agents/*.yaml`:

- `prd-orchestrator`
- `prd-authoring-agent`
- `prd-contract-agent`
- `prd-development-agent`
- `prd-quality-agent`
- `viewer-quality-agent`

## Licensing

No license has been granted yet. Public visibility permits inspection, but it
does not grant permission to copy, modify, or redistribute the code. The
repository owner must select and add a license before presenting PACS as an
open-source project.
