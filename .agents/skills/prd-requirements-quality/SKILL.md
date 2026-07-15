---
name: prd-requirements-quality
description: Use when converting a brief and research into testable functional, non-functional, and non-goal PRD requirements.
---

# PRD Requirements Quality

Use this skill when writing `requirements` and `goals.non_goals`.

## When to Use

- Transforming brief + research into concrete requirements.
- Improving requirement quality after validation feedback.

## Requirement Rules

1. One requirement = one behavior.
2. Use testable language; avoid vague terms.
3. Prioritize with MoSCoW:
   - `must`, `should`, `could`, `wont`
4. Default generated status to `proposed`.
5. Keep `persona_ids` as `[]` unless persona mapping is explicitly provided by orchestrator.
6. Add `rationale` and `release_phase` for each functional requirement.
7. Track direct requirement dependencies when they are explicit.

## Functional Requirements

- ID format: `FR-###`
- Include:
  - `title`
  - `description`
  - `rationale`
  - `priority`
  - `persona_ids`
  - `dependencies`
  - `acceptance_criteria`
  - `status`
  - `release_phase`
- At least one acceptance criterion per FR (target 2-3).

## Non-Functional Requirements

- ID format: `NFR-###`
- Must include measurable `target`.
- Prefer at least one non-functional acceptance criterion when the brief supports it.
- Category must be one of:
  - `performance`
  - `security`
  - `scalability`
  - `accessibility`
  - `reliability`
  - `compliance`
  - `usability`
  - `observability`
  - `privacy`

## Non-Goals

- Write outcome-level exclusions for this release.
- Include explicit out-of-scope statements from the brief.

## Anti-Patterns

- No implementation-detail requirements unless mandatory.
- Do not mark most requirements as `must` (target <= 30%).
- Do not include duplicate requirements with minor wording changes.
