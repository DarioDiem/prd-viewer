---
name: prd-research-evidence
description: Use when building PRD problem framing and business goals from traceable internal or external evidence.
---

# PRD Research Evidence

Use this skill for research-oriented PRD sections only.

## When to Use

- Building `problem` and `goals.business_goals`.
- Enriching weak briefs with external market/user signals.

## Scope

- In scope:
  - `problem.statement`
  - `problem.background`
  - `problem.opportunity`
  - `problem.strategic_fit`
  - `problem.affected_users`
  - `problem.evidence`
  - `goals.business_goals`
  - `goals.user_outcomes`
  - `assumptions`
- Out of scope:
  - Requirements, stories, constraints, timelines, rollout specifics, implementation details

## Evidence Quality Rules

1. Minimum 3 evidence items, maximum 10.
2. Every evidence item must include:
   - `type`
   - `description` (<= 40 words)
   - `source`
   - `confidence`
3. Use `confidence` based on source quality:
   - `high`: primary/recent
   - `medium`: credible secondary
   - `low`: anecdotal or unclear
4. If no external source is available, use `"source": "internal brief"` explicitly.
5. Never fabricate metrics or citations.

## Business Goal Rules

- Goals are outcomes, not features.
- Use measurable language where possible.
- Keep goals aligned with evidence and stated problem.
- Prefer structured goal objects with `statement`, `rationale`, `owner`, and `priority`.

## Assumption Rules

- Capture only assumptions that materially affect scope, success, timing, adoption, or compliance.
- Every assumption should include a `validation_plan` unless the brief already confirms it.
- If an assumption is already proven false, do not include it; convert it into a risk or open question instead.

## Output Discipline

- Return only assigned sections plus updated ID registry.
- Emit strict JSON only.
