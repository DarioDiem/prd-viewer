---
name: prd-development-execution
description: Use when implementing PRD items from canonical PRD JSON, choosing the next development slice, minimizing PRD context load, planning focused subagent work, and updating implementation status after code changes.
---

# PRD Development Execution

Use this skill when moving from PRD intent to code, tests, docs, or operational artifacts.

## Goals

- Implement the smallest coherent PRD slice that satisfies acceptance criteria.
- Keep PRD context compact by default.
- Preserve traceability from work to requirement, story, risk, or readiness IDs.
- Parallelize independent investigation, implementation, and verification only when the host agent policy permits delegation.

## Context Ladder

Load only as much PRD context as the development slice needs:

1. Start with:

```bash
python3 tools/prd_extractor.py --summary
```

2. Pull focused sections instead of full files:

```bash
python3 tools/prd_extractor.py --section requirements
python3 tools/prd_extractor.py --section user_stories
python3 tools/prd_extractor.py --section constraints
```

3. Read `viewer/PRD_web_ui.json` sections directly only for viewer work where implementation status or UI acceptance detail is not exposed by the extractor.
4. Read the full `PRD.json` or `viewer/PRD_web_ui.json` only for whole-document validation, migration, deterministic serialization, or complete artifact export.
5. Use focused MCP discovery and token-budgeted agent packets; treat TOON only as an opt-in benchmark.

## Development Slice Selection

If the user names a requirement, implement that scope.

If the user asks for the next item:

1. Prefer `must` before `should`, MVP before later phases, and `ready` or `in_progress` readiness areas before speculative future work.
2. Prefer prerequisites that unblock multiple later items.
3. Skip items blocked by unresolved dependencies, unsupported schema versions, missing credentials, or missing owner decisions.
4. Do not mark PRD product requirements as implemented just because a prototype, stub, or doc note exists.
5. State the selected ID(s) and acceptance criteria before editing files.

## Implementation Brief

Before coding, write a compact brief for yourself or delegated workers:

- PRD IDs: requirement/story/readiness/risk IDs in scope.
- Acceptance criteria: only the criteria needed for this slice.
- Affected surfaces: likely files, packages, schemas, docs, and tests.
- Constraints: schema gates, local-first rules, privacy/security limits, and forbidden side effects.
- Verification: exact commands or checks to run.

## Delivery Workflow

- Do not start implementation from an FR or NFR alone. Select or create a
  `PTW-###` that links the requirements and other affected PRD entities.
- Create or update a TRD before coding when architecture, interfaces, data
  ownership, security boundaries, deployment, operations, or non-trivial
  verification design changes.
- When the project uses an external issue tracker, execute assignable work
  through a linked issue and add its canonical URL to the tracking record's
  optional `external_refs` array. Do not copy live issue state into the PRD.
- External issues enter tasks or sprints; FRs and NFRs do not. Set the PTW to
  `in_progress` when its first linked issue starts and to `done` only after its
  required issues and acceptance conditions are complete.
- Follow `docs/delivery-workflow.md` for issue, blocker, and completion
  boundaries.

## Parallelization Policy

Use delegation only when the current host agent rules allow it.

Good delegated tasks are bounded and independent:

- codebase search for where a feature belongs
- fixture/test update in a disjoint file set
- viewer quality review after a UI change
- PRD quality or contract impact check
- CI/log analysis while local implementation continues

Do not delegate the immediate critical-path task if the next local step depends on the answer. Give each worker a small context packet with PRD IDs, acceptance criteria, file ownership, and expected output. Avoid sending the full PRD unless the task truly requires it.

## Implementation Rules

- Keep PRD JSON canonical; derived views, indexes, metrics, and context packets are rebuildable.
- For viewer work, follow `viewer/AGENTS.md`.
- Validate every load, edit, save, and export path against `schema.strict.json`.
- Preserve stable IDs when item identity is unchanged.
- Do not invent evidence, owners, metrics, credentials, compliance claims, or decisions while implementing.
- Update PRD status/readiness notes only when the implemented behavior is present and verified.
- Keep granular task state in the external tracker and durable delivery state in
  PRD `project_tracking`.

## Verification

Choose checks from the files touched:

- `.agents/*.yaml`, `.codex/agents`, `.gemini/agents`, or `.agents/skills`: `python3 tools/sync_agents.py` then `npm run validate:agents`.
- Canonical PRD tooling: `python3 tools/prd_schema_compat.py PRD.json --stats-json`.
- Viewer TypeScript changes: from `viewer/`, run `npm run check`; run `npm run test` for logic/UI changes; run `npm run test:e2e` for browser flows.
- PRD JSON changes: validate against `schema.strict.json`.

## Examples

Positive: For “implement next PRD item,” read the summary, inspect only implementation status/readiness sections, select one unblocked MVP slice, implement it with focused tests, update the viewer PRD readiness note, and run the matching gates.

Positive: Split a UI feature into one local implementation task, one parallel `viewer_quality_agent` review, and one disjoint test-fixture task when delegation is allowed and none blocks the next local edit.

Negative: Do not paste the full PRD into every worker prompt when the requirement, story, and readiness IDs are enough.

Negative: Do not run the PRD creation orchestrator for implementation work unless the user is changing PRD content rather than building from it.
