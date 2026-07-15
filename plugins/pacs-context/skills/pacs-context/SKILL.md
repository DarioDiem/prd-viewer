---
name: pacs-context
description: Use for PACS PRD or TRD authoring, implementation, review, traceability, and status work that should load focused, token-budgeted context through the local pacs-prd MCP server.
---

# PACS Context

Keep canonical PRD JSON and Markdown TRDs on disk. Use MCP only to select the context needed for the current task.

The bundled MCP server resolves `pacs.config.json` from the active MCP project root. Do not ask for `PACS_PROJECT_ROOT` or `PACS_PRD_PATH` unless the client does not support MCP Roots and the user is intentionally using the legacy registration path.

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

TOON is optional benchmarking. Do not use it as an ingestion, merge, or release gate.
