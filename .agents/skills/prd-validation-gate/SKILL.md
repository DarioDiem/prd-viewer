---
name: prd-validation-gate
description: Use when validating a merged PRD for schema compliance, completeness, contradictions, ambiguity, and repair routing.
---

# PRD Validation Gate

Use this skill for final PRD checks before acceptance.

## When to Use

- After orchestrator merge.
- During repair loops after failed validation.

## Validation Layers

1. **Contract checks**
   - Confirm all required top-level keys exist.
   - Validate enums, required fields, and value types against `schema.strict.json`.
   - Use `schema.json` only for supplemental semantic intent when needed.
   - Accept canonical JSON only; treat derived context packets as read-only inputs.
   - If `meta.schema_contract` is present, compare it with `schema.versions.json`.
   - If `meta.schema_contract` is absent, classify the PRD as `legacy_unversioned` rather than assuming compatibility.
2. **Completeness checks**
   - Every `must` requirement has >= 1 linked story.
   - Every persona has >= 1 story.
   - Every story links to >= 1 requirement.
   - `problem.evidence` has >= 3 items.
   - `goals.success_metrics` has >= 1 item.
   - `delivery.milestones` has >= 1 item.
   - Assumptions that materially affect delivery include a validation plan unless they are already validated.
3. **Consistency checks**
   - No duplicate IDs.
   - No requirement duplicated in `non_goals`.
   - No `must` requirement marked `removed`.
   - `delivery.target_launch` is not earlier than any required dependency or milestone date.
   - `decisions.linked_req_ids` only reference real requirements.
   - `project_tracking.*[].linked_entity_ids` only reference real PRD entities or project-tracking records.
   - Unknown optional extensions are preserved on round trip.
   - Unknown required extensions block safe writeback unless explicitly supported or approved.
4. **Ambiguity checks**
   - Flag vague qualifiers, missing actors, and untestable statements.

## Status Rules

- `passed`: zero errors, zero warnings
- `passed_with_warnings`: zero errors, warnings present
- `failed`: one or more errors

## Routing Rules

Return targeted repairs:

- author-owned issues in problem, goals, assumptions, requirements, personas, stories, constraints, delivery, risks, metrics, or open questions -> `prd_authoring_agent`
- schema compatibility, schema version, fixture, serialization, extension, or migration issues -> `prd_contract_agent`
- viewer governance, accessibility, or test coverage issues -> `viewer_quality_agent`
- meta and decision issues -> orchestrator
- required extension issues -> orchestrator

## Repair Packets

Send only the failing IDs, relevant schema paths, concrete errors, and linked context. Use a token-budgeted MCP packet when source context is needed; keep the canonical validation report as JSON.

## Output Discipline

- Return a validation report object only.
- Do not mutate PRD content in this step.
