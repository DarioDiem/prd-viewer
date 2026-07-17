# Technical Requirements Documents

Keep product intent in `PRD.json` and implementation design in one or more linked
Markdown TRDs. A TRD may explain how approved requirements will be implemented,
but it must not redefine their priority, scope, or acceptance criteria.

Use `docs/delivery-workflow.md` for the lifecycle that connects requirements and
TRDs to PTW records, GitHub Issues, GitHub Projects, and pull requests.

## Header contract

Each TRD starts with a small YAML front matter block:

```yaml
---
trd_id: TRD-001
linked_prd_id: 00000000-0000-0000-0000-000000000000
linked_req_ids:
  - FR-001
  - NFR-001
---
```

- `trd_id` is stable within the linked PRD and uses `TRD-###`.
- `linked_prd_id` is the canonical PRD's UUID.
- `linked_req_ids` contains only requirement IDs that exist in that PRD.

The globally unique identity of a linked requirement is the pair
`(linked_prd_id, linked_req_id)`. This preserves the existing readable
`FR-###` and `NFR-###` IDs without a cross-repository ID migration. If a compact
string form is needed later, serialize the same identity as
`prd:<linked_prd_id>#<linked_req_id>`.

## Recommended body

Keep only sections that carry a real design decision or verification obligation:

1. Purpose and scope boundaries.
2. Architecture and trust boundaries.
3. Interfaces and contracts.
4. Data model and ownership.
5. Key runtime sequences.
6. Runtime, deployment, and observability requirements.
7. Requirement-to-design verification matrix.
8. Linked decisions and unresolved technical questions.

Use Mermaid directly in Markdown for architecture, sequence, state, and entity
relationship diagrams. Diagram labels should use system and domain language from
the PRD; placeholders must be removed before the TRD is approved.

## API contracts

Use OpenAPI only for HTTP APIs. Store a contract such as
`contracts/openapi.yaml` next to the TRD and link to it from the interfaces
section. OpenAPI 3.1.2 is the conservative default because its Schema Object is
based on the OpenAPI JSON Schema dialect and 3.1 tooling is expected to accept
3.1 patch versions. Projects that need OpenAPI 3.2 features may opt in explicitly.

Do not create an empty OpenAPI document for a project with no HTTP API. Other
interfaces should use their native contract when one exists, such as an event
schema, database migration, or command-line help output.

## Decision ownership

The PRD `decisions` array is the only decision log. Product and engineering
decisions continue to use `DEC-###`; the TRD links to those IDs and explains
their technical consequences. Do not create a parallel `adr/` directory unless
the project deliberately migrates all engineering decisions out of the PRD.

## PRD connective-tissue roadmap

Schema 1.2 adds optional `external_refs` URI arrays to project-tracking records.
The remaining connective-tissue candidates can use later backward-compatible
minor versions because every new field can remain optional:

- Add optional `goal_id` (`BG-###`) and `metric_id` (`M-###`) fields, then add
  optional `goal_ids` and `metric_ids` links to functional and non-functional
  requirements.
- Add optional metric outcome fields: `actual`, `measured_at`, and
  `outcome_status` with `not_measured`, `on_track`, `met`, and `missed` values.
- Add optional `project_tracking.status_history` entries containing `status`,
  `changed_at`, and `changed_by`.
- Add optional `meta.approvals` entries containing approver, decision, timestamp,
  and comment while retaining `meta.approvers` as the expected-approver list.

Acceptance-criterion verification should wait for a coordinated major-version
migration. Requirements currently store acceptance criteria as strings, and the
viewer edits that shape directly. A future structured criterion can add a stable
criterion ID plus `statement` and `verification` fields, but the schema, viewer,
fixtures, authoring agents, and migration tooling must change together.
