---
name: prd-context
description: Use for PRD or TRD authoring, implementation, review, traceability, and status work that should load focused, token-budgeted context through the local prd-viewer MCP server.
---

# PRD Context

Keep canonical PRD JSON and Markdown TRDs on disk. Use MCP only to select the context needed for the current task.

The bundled MCP server resolves `prd.config.json` from the active MCP project root. Do not ask for `PRD_PROJECT_ROOT` or `PRD_PATH` unless the client does not support MCP Roots and the user is intentionally using the legacy registration path.

## Workflow

1. Discover relevant IDs with `search_prd` in `compact` mode.
2. Confirm exact records with `get_entity` or `get_linked_entities`.
3. Call `build_agent_packet` in `standard` mode with:
   - the smallest useful `ids` and `sections` lists;
   - one of `implementation`, `review`, `triage`, or `schema_change` as `preset`;
   - an explicit `max_tokens` budget, normally 2000-6000;
   - `include_unresolved: false` unless unresolved work is in scope.
4. Read a complete PRD only for full-document validation, migration, deterministic serialization, or export.
5. Validate canonical artifacts with their schema and traceability checks after edits.

## GitHub delivery enforcement

- GitHub Issues are the only executable ticket system.
- Start implementation from a PTW-backed GitHub issue and reference the applicable TRD section.
- Split work when slices need different owners, pull requests, blockers, verification, trust boundaries, or more than three focused delivery days.
- Keep live status in GitHub and durable summary state in PRD `project_tracking`.
- Before completion, run `tools/validate_delivery_tracking.py` against the canonical PRD and ensure the pull request closes its issue.

TOON is optional benchmarking. Do not use it as an ingestion, merge, or release gate.
