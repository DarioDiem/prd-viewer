# PRD Delivery Workflow

Use this workflow to keep product intent, technical design, and live execution
connected without copying the same state into several systems.

```text
FR/NFR -> PTW -> TRD when needed -> external issue -> task or sprint -> PR
       -> verification -> close issue -> update PTW
```

Do not start implementation from an `FR-###` or `NFR-###` alone. Select or
create a `PTW-###`, then execute concrete work through an external issue when
the project uses an issue tracker.

## Source-of-truth boundaries

| Artifact | Owns | Update when |
| --- | --- | --- |
| PRD requirements | Product behavior, quality targets, priority, and acceptance criteria | Expected behavior, scope, target, or acceptance criteria changes |
| PRD project tracking | Durable delivery status, material issues, blockers, and notes | Work is planned, starts, blocks, completes, or is deferred |
| PRD decisions | Accepted product and engineering choices | A meaningful choice is proposed, accepted, superseded, or rejected |
| TRD | Architecture, interfaces, data, runtime design, operations, and verification design | The implementation approach or technical contract changes |
| External issue tracker | Assignable work, discussion, checklists, and live task state | Concrete engineering work, a defect, spike, or follow-up exists |
| Sprint or iteration | Short-term execution commitment | Ready issues are selected for a delivery window |
| Pull request | Implementation and verification evidence | Code or documentation changes |

The external tracker owns granular live execution. `project_tracking` keeps the
durable PRD-level summary. The TRD owns the approved technical design.

## Intake

For each requested change:

1. Update or add an `FR-###` or `NFR-###` first when expected behavior, scope,
   quality targets, or acceptance criteria change. A defect that merely violates
   an existing approved requirement does not require a requirement change.
2. Select or create a `PTW-###` for the coherent deliverable and link every
   relevant requirement, story, decision, risk, issue, or blocker through
   `linked_entity_ids`.
3. Create or update a `TRD-###` before coding when the work changes architecture,
   interfaces, data ownership, security boundaries, deployment, operations, or
   non-trivial verification design. Keep accepted decisions in PRD `DEC-###`
   records and reference them from the TRD.
4. File an external issue when work is independently assignable or should
   produce a pull request, investigation result, migration, contract, or other
   evidence. Add its canonical URL to the related tracking record's
   `external_refs`.

One PTW may aggregate several external issues. A small deliverable may map one
PTW to one issue. Do not create an issue merely to mirror every PRD record.

## Project issues and external issues

A `PTI-###` records a material issue that PRD reviewers must see because it
affects scope, release readiness, risk, or several work items. An external issue
records who will act and how live progress is tracked. A significant defect may
have both; a small implementation defect normally needs only the external issue.

Use the same boundary for blockers: keep the immediate blocker on the external
issue, and add a `PTB-###` only when it materially affects project or release
visibility.

## Definition of ready

An external issue may enter a sprint or start as a task when:

- it links to a `PTW-###`;
- affected functional requirements are approved;
- applicable NFRs are identified;
- acceptance conditions and verification evidence are defined;
- a TRD exists when the technical design is non-trivial;
- dependencies, blockers, owner, and delivery size are known.

FRs and NFRs do not enter sprints. External issues enter sprints; PTWs summarize
their delivery.

## Status transitions

When the first linked issue starts, mark the issue in progress and set the PTW
to `in_progress`. During implementation, keep granular updates in the external
tracker. Update the TRD only when technical design changes, and update the PRD
requirement only when product intent changes.

When work blocks, set the PTW to `blocked` if the deliverable cannot progress.
When verification passes and the pull request merges, close the external issue.
Set the PTW to `done` only after all required linked issues and acceptance
conditions are complete. Record outcome metrics later when measurements become
available.

## External references

Schema 1.2 adds optional `external_refs` to `PTW`, `PTI`, `PTB`, and `PTN`
records. Each value is a unique canonical URI:

```json
"external_refs": [
  "https://github.com/example/project/issues/123",
  "https://github.com/example/project/pull/456"
]
```

Use the provider's stable URL. Do not copy titles, labels, assignees, comments,
or live status into `external_refs`; the external system remains authoritative.

Schema 1.0 and 1.1 documents remain backward compatible. When an existing PRD
starts using `external_refs`, update `meta.schema_contract` to 1.2 and record the
backward-compatible migration; do not add empty arrays to every historical
record merely to rewrite the file.

## Common cases

- Existing-requirement bug: external issue and an existing or new PTW. Update
  the PRD or TRD only if behavior or design changes.
- New feature: update PRD, approve requirements, create PTW, write TRD when
  needed, then file and schedule external issues.
- Quality-target change: update NFR, update TRD measurement design, create PTW,
  then file the issue.
- Internal refactor: external issue only unless it changes architecture or a
  tracked delivery milestone.
- Architecture migration: PTW, TRD, `DEC-###`, and one or more external issues.
