---
name: prd-orchestrator-execution
description: Use when one orchestrator agent must coordinate consolidated PRD mega-specialists, merge outputs, and run repair loops.
---

# PRD Orchestrator Execution

Use this skill for supervisor/manager agents producing one final `prd.json`.

## When to Use

- A brief must be converted into a full PRD through consolidated mega-specialist agents.
- You need deterministic sequencing, merge rules, and retry routing.

## Dependency-Aware Sequence

Run in this order:

1. Initialize `meta`, `meta.schema_contract`, and ID registry.
2. Run `prd_authoring_agent` once with the brief, context, ID registry, and focused previous-version context when available.
3. Seed orchestrator-owned defaults for required sections not returned by authoring, especially `meta.links`, `decisions`, and empty collections required by the schema.
4. Merge draft.
5. Run `prd_quality_agent`.
6. Route author-owned errors back to `prd_authoring_agent`; route schema contract issues to `prd_contract_agent`.
7. Rerun failing sections with focused repair packets (max 2 repair rounds).

## Schema Compatibility Sequence

Before specialist work starts:

1. Inspect `schema.versions.json` and identify the current schema version.
2. If updating an existing PRD, run:

```bash
python3 tools/prd_schema_compat.py PRD.json
```

3. If the PRD is legacy unversioned, preserve content and add `meta.schema_contract` only when the user asks to migrate or create a new versioned artifact.
4. If compatibility is unknown or migration is required, do not ask specialist agents to edit affected sections until the migration path is clarified.
5. Preserve unknown optional `extensions.data` during merge and repair. Unknown required extensions must be routed to the orchestrator for explicit handling.

## Budgeted Context Packets

- Discover relevant IDs with focused MCP search and entity reads.
- Build specialist and repair packets with `build_agent_packet`, an explicit task preset, and the smallest useful token budget.
- Keep unresolved work excluded unless the delegated task concerns blockers, questions, or decisions.
- Final assigned output remains strict JSON and canonical PRD merges operate on JSON only.
- Treat TOON only as an opt-in benchmark outside orchestration and validation gates.

## Merge Policy

- Merge order:
  - `meta`
  - `problem`
  - `goals`
  - `assumptions`
  - `personas`
  - `requirements`
  - `user_stories`
  - `constraints`
  - `delivery`
  - `risks`
  - `open_questions`
  - `decisions`
- Conflicts: prefer domain owner output.
  - Author-owned content conflicts -> `prd_authoring_agent`
  - Schema contract or migration conflicts -> `prd_contract_agent`
  - Viewer governance, accessibility, or test planning conflicts -> `viewer_quality_agent`
  - Meta and decision conflicts -> orchestrator
- Arrays: concatenate then dedupe.

## Retry and Failure Handling

- If a consolidated agent output is not valid JSON, retry up to 3 times.
- If validation still fails after repair rounds, return structured failure JSON:

```json
{
  "status": "failed",
  "stage": "validation_or_merge",
  "errors": ["..."],
  "partial_output": {}
}
```

## Output Rule

- Final output must be a single valid PRD JSON object with all required top-level keys from `schema.strict.json`.
- The orchestrator owns document-level completeness and must ensure required but empty sections are still present.
