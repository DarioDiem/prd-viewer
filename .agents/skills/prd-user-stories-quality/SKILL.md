---
name: prd-user-stories-quality
description: Use when converting PRD requirements into grounded personas, INVEST user stories, and Given-When-Then criteria.
---

# PRD User Stories Quality

Use this skill for `personas` and `user_stories`.

## When to Use

- Turning requirements into user-value stories.
- Building persona coverage and requirement traceability.

## Persona Rules

1. Persona count: 2-5.
2. Personas must represent role-based segments, not demographics.
3. Every persona requires:
   - `persona_id` (`P-###`)
   - `name`
   - `role`
   - `goals`
   - `needs`
   - `pain_points`
   - `current_workarounds`
   - `frequency_of_use`
   - `technical_proficiency`
   - `environment`

## Story Rules

1. Story ID format: `US-###`.
2. Statement fields required:
   - `as_a`
   - `i_want`
   - `so_that`
3. Each story must link to >= 1 requirement via `linked_req_ids`.
4. Every `must` requirement should be covered by at least one story.
5. Use 2-4 GWT acceptance criteria per story.
6. Add `priority` and `release_phase` to each story.
7. `story_points` defaults to `null`.
8. Add 1-3 `edge_cases` per story.

## INVEST Gate

Before returning output, check each story for:
- Independent
- Negotiable
- Valuable
- Estimable
- Small
- Testable

If a story fails INVEST badly, split or rewrite it.

## Anti-Patterns

- Do not create stories that are pure UI implementation notes.
- Do not leave stories unlinked to requirements.
- Do not use vague `so_that` outcomes.
