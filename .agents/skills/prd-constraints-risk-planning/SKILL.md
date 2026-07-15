---
name: prd-constraints-risk-planning
description: Use when deriving PRD constraints, dependencies, milestones, success metrics, and risks from requirements and context.
---

# PRD Constraints, Risks, and Planning

Use this skill for `constraints`, `delivery`, `goals.success_metrics`, `goals.guardrail_metrics`, and `risks`.

## When to Use

- Translating requirements into delivery constraints and risk posture.
- Creating launch timelines and dependency maps.

## Constraints Rules

- `constraints.technical` IDs: `TC-###`
- `constraints.dependencies` IDs: `D-###`
- Each dependency must include:
  - `name`
  - `type`
  - `owner`
  - `required_by`
  - `status`
- `type` must be: `internal | external | third_party`

## Timeline Rules

1. If no reliable launch date exists, set `delivery.target_launch` to `null`.
2. Produce 3-6 milestones under `delivery.milestones`.
3. Every milestone requires `name`, `date`, `deliverable`, and practical entry/exit criteria.

## Rollout Rules

- Add `delivery.rollout_plan` with a rollout strategy, phased audience plan, communications, training, and support handoff.
- Add `delivery.operational_readiness` for go-live dependencies such as support, security, billing, legal, or observability readiness.

## Success Metric Rules

- Every metric must include:
  - `metric`
  - `baseline` (or `null`)
  - `target`
  - `unit`
  - `measurement_method`
  - `timeframe_days`
- Add `guardrail_metrics` when there are plausible quality, reliability, compliance, or adoption regressions to monitor.

## Risk Rules

1. Minimum 3 risks, maximum 10.
2. Risk ID format: `R-###`.
3. Score formula: map `low=1`, `medium=2`, `high=3`, then multiply probability x impact.
4. Every risk requires non-empty `mitigation` and `owner`.

## Open Questions

- Raise open questions for missing owners, unknown launch dates, unclear compliance ownership, or unresolved critical dependencies.
