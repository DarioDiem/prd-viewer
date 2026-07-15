# Agent Research Notes

Research date: 2026-04-20

## Evaluated Sources

- [Open Agent Spec](https://www.openagentspec.dev/) defines repo-native YAML specs, tool declarations, spec composition, and test harness support. It is the local portability target for `.agents/*.yaml`.
- [Agent Skills specification](https://agentskills.io/specification) defines `SKILL.md` frontmatter, directory structure, progressive disclosure, and optional scripts/references/assets directories. Existing `.agents/skills/*/SKILL.md` files follow this shape.
- [AGENTS.md](https://agents.md/) defines project and subproject markdown instructions for coding agents. The repo now uses root and viewer `AGENTS.md` files.
- [BMad Method agents](https://docs.bmad-method.org/reference/agents/) and [testing options](https://docs.bmad-method.org/reference/testing/) provide structured examples for product, QA, and test-architect workflows, but they are not Open Agent Spec definitions and do not directly match this repo's PRD JSON contract.
- [GitAgent](https://github.com/open-gitagent/gitagent) documents git-native agent manifests, duties, workflows, and audit patterns. It is useful context for segregation of duties and traceability, but it is a different format.

## Decision

No existing implementation found during this pass was both:

1. Directly equivalent to the proposed PRD/web UI specialist roles.
2. Structured as Open Agent Spec YAML.
3. Clearly reviewed or standardized enough to vendor into this repo without adapting behavior, schema, and licensing.

The project therefore defines local agents for the proposed roles and validates them with `npm run validate:agents`.

## Added Local Agents

The first implementation used narrow specialist agents for research, requirements, user stories, constraints, validation, traceability, schema migration, QA, accessibility, web UI governance, PRD diffing, orchestration, and development. A later consolidation pass merged the high-handoff roles into mega-specialists to reduce memory loss and maintenance overhead while preserving independent validation and contract boundaries.

## Consolidated Agent Roster

- `prd_orchestrator`: coordinates consolidated authoring and quality gates, owns `meta`, `decisions`, merge policy, ID registry initialization, context budgets, and repair loops.
- `prd_authoring_agent`: replaces the former research, requirements, user-stories, and constraints agents. It creates problem framing, goals, assumptions, requirements, personas, stories, constraints, delivery, metrics, risks, and open questions in one memory context.
- `prd_quality_agent`: replaces the former validation, traceability, and PRD diff agents. It performs schema validation, completeness checks, traceability checks, ambiguity/conflict detection, semantic diffing, and repair routing without mutating PRD content.
- `prd_contract_agent`: replaces the former schema migration agent. It plans schema contract changes, compatibility, fixtures, serialization impacts, and context-contract impacts.
- `viewer_quality_agent`: replaces the former web UI guard, accessibility review, and QA test planner agents. It reviews viewer governance, local-first constraints, accessibility risk, and test coverage.
- `prd_development_agent`: remains the PRD-backed implementation executor.

## Retired Narrow Agents

- `research_agent`
- `requirements_agent`
- `user_stories_agent`
- `constraints_agent`
- `validation_agent`
- `traceability_agent`
- `schema_migration_agent`
- `web_ui_guard_agent`
- `accessibility_review_agent`
- `qa_test_planner_agent`
- `prd_diff_agent`
