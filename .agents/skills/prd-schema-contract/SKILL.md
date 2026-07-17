---
name: prd-schema-contract
description: Use when generating, merging, repairing, or validating PRD JSON against the schema contract and normalization rules.
---

# PRD Schema Contract

Use this skill when creating, merging, repairing, or validating `prd.json`.

## When to Use

- The task requires generating a PRD in JSON format.
- Any section must be checked against `schema.json`.
- Outputs from multiple agents need to be merged into one PRD object.
- The PRD must be production-ready, with explicit ownership, assumptions, delivery planning, and decisions.

## Source of Truth

- Primary machine-validation schema: `schema.strict.json`
- Human-readable contract reference: `schema.json`
- Schema compatibility manifest: `schema.versions.json`
- Canonical PRD artifact format: JSON.
- Agent context path: focused MCP reads and token-budgeted context packets derived from canonical JSON.
- Required top-level keys:
  - `meta`
  - `problem`
  - `goals`
  - `assumptions`
  - `personas`
  - `requirements`
  - `user_stories`
  - `constraints`
  - `delivery`
  - optional `project_tracking` in schema `1.1.0+`, with optional
    `external_refs` URI arrays on tracking records in schema `1.2.0+`
  - `risks`
  - `open_questions`
  - `decisions`

Key production-level expectations by section:
- `meta`: summary, product name, lifecycle stage, cross-functional owners, reviewers, approvers, target release, stakeholders, optional `schema_contract`.
- `problem`: statement, background, opportunity, strategic fit, affected users, evidence.
- `goals`: business goals, user outcomes, success metrics, guardrail metrics, non-goals.
- `assumptions`: explicit assumptions with validation plan and status.
- `requirements`: rationale, dependencies, release phase, and testable acceptance criteria.
- `delivery`: target launch, milestones, rollout plan, operational readiness.
- `project_tracking`: overall status, pending work, issues found, blockers, linked entities, and timestamped notes.
- Project-tracking record `external_refs`: canonical GitHub issue, pull-request,
  project, or iteration URLs; GitHub remains authoritative for live state.
- `decisions`: explicit product or technical decisions already made or proposed.

## Required Behavior

1. Always emit a single JSON object; never markdown.
2. Never omit required keys; use `null` if unknown.
3. Enforce all documented enums exactly as written in `schema.json`.
4. Keep ID prefixes stable:
   - Functional requirement: `FR-###`
   - Non-functional requirement: `NFR-###`
   - User story: `US-###`
   - Technical constraint: `TC-###`
   - Risk: `R-###`
   - Open question: `Q-###`
   - Assumption: `A-###`
   - Decision: `DEC-###`
   - Project work item: `PTW-###`
   - Project issue: `PTI-###`
   - Project blocker: `PTB-###`
   - Project note: `PTN-###`
5. Use `schema.strict.json` for machine checks; use `schema.json` for intent and descriptive guidance.
6. Use `null` for unknown scalar values and `[]` for required collections with no known entries.

## Schema Versioning and Extensions

- Treat this repository as a versioned PRD Creation Framework, not just one PRD template.
- `meta.version` is the PRD document version.
- `meta.schema_contract.schema_version` is the schema/framework contract version.
- Use `schema.versions.json` to decide whether a document is exact, backward compatible, migration-required, unknown, or legacy unversioned.
- New PRDs should include `meta.schema_contract` unless the user explicitly asks for a legacy document.
- `extensions` is the only supported place for custom framework or domain-specific payloads.
- Unknown optional extensions may be ignored but must be preserved during round trips.
- Unknown required extensions must fail closed or be escalated before edit/writeback.
- Do not add custom fields directly into core sections when a namespaced extension can represent the customization.
- Run compatibility checks with:

```bash
python3 tools/prd_schema_compat.py PRD.json
```

## Agent Context Rules

- Prefer focused MCP discovery followed by `build_agent_packet` with an explicit preset and token budget.
- Keep unresolved work excluded unless it is part of the task.
- Treat context packets as derived and rebuildable; merge and validate canonical JSON only.
- Read a complete PRD only for whole-document validation, migration, deterministic serialization, or export.
- Treat TOON only as an opt-in encoding benchmark, never as a compliance, merge, or release gate.

## Normalization Rules

- Dates: ISO 8601 strings.
- Release planning: `delivery` holds rollout and readiness, while `constraints` holds restrictions and dependencies.
- Arrays: deduplicate by normalized `title` or `description` where applicable.
- Unknown data: use `null` instead of deleting keys.
- Text quality: acceptance criteria must be testable and unambiguous.

## Do Not

- Do not add undocumented top-level keys.
- Do not emit prose around JSON.
- Do not invent citations or evidence sources.
