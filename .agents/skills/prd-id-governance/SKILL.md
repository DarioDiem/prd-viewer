---
name: prd-id-governance
description: Use when PRD generation creates, repairs, merges, or validates IDs and shared counters across agents.
---

# PRD ID Governance

Use this skill when any PRD section introduces or updates IDs.

## When to Use

- Multi-agent PRD generation pipelines.
- Regeneration or repair cycles after validation failures.
- Merging outputs from multiple specialists.

## ID Registry Contract

Keep a shared registry object and return it from each specialist output:

```json
{
  "FR": 0,
  "NFR": 0,
  "US": 0,
  "TC": 0,
  "R": 0,
  "Q": 0,
  "A": 0,
  "DEC": 0,
  "P": 0,
  "D": 0,
  "PTW": 0,
  "PTI": 0,
  "PTB": 0,
  "PTN": 0
}
```

## Prefix Mapping

- `FR` -> `FR-###`
- `NFR` -> `NFR-###`
- `US` -> `US-###`
- `TC` -> `TC-###`
- `R` -> `R-###`
- `Q` -> `Q-###`
- `A` -> `A-###` (assumption IDs)
- `DEC` -> `DEC-###` (decision IDs)
- `P` -> `P-###` (persona IDs)
- `D` -> `D-###` (dependency IDs)
- `PTW` -> `PTW-###` (project-tracking work items)
- `PTI` -> `PTI-###` (project-tracking issues)
- `PTB` -> `PTB-###` (project-tracking blockers)
- `PTN` -> `PTN-###` (project-tracking notes)

## Rules

1. IDs are globally unique within their namespace.
2. Never reuse deleted IDs in the same run.
3. Increment counters only when a new entity is created.
4. On retry rounds, preserve previously assigned IDs when item identity is unchanged.
5. If two duplicates with different IDs are merged, keep the older ID and remove the duplicate ID.
6. `meta`, `goals`, and `delivery` do not need generated IDs unless explicitly modeled in the schema.

## Validation Checks

- No duplicate IDs in arrays.
- Every `linked_req_ids` entry maps to an existing requirement ID.
- Every `persona_id` used by stories exists in `personas`.
- Every `project_tracking.*[].linked_entity_ids` entry maps to an existing core PRD entity or project-tracking ID.
