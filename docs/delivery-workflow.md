# PRD Delivery Workflow

Use this workflow to keep product intent, technical design, and live execution
connected without copying the same state into several systems.

```text
FR/NFR -> PTW -> TRD when needed -> GitHub issue -> GitHub Project -> PR
       -> verification -> close issue -> update PTW
```

Do not start implementation from an `FR-###` or `NFR-###` alone. Select or
create a `PTW-###`, then execute concrete work through a GitHub issue.

GitHub is the only execution-tracking system for projects scaffolded from this
framework. GitHub Issues own assignable work and discussion, GitHub Projects may
own scheduling and live status, and pull requests own implementation and
verification evidence. Do not mirror live work in Jira or another ticket system.

## Source-of-truth boundaries

| Artifact | Owns | Update when |
| --- | --- | --- |
| PRD requirements | Product behavior, quality targets, priority, and acceptance criteria | Expected behavior, scope, target, or acceptance criteria changes |
| PRD project tracking | Durable delivery status, material issues, blockers, and notes | Work is planned, starts, blocks, completes, or is deferred |
| PRD decisions | Accepted product and engineering choices | A meaningful choice is proposed, accepted, superseded, or rejected |
| TRD | Architecture, interfaces, data, runtime design, operations, and verification design | The implementation approach or technical contract changes |
| GitHub Issues | Assignable work, discussion, checklists, and live task state | Concrete engineering work, a defect, spike, or follow-up exists |
| GitHub Projects | Short-term execution commitment and scheduling | Ready issues are selected for a delivery window |
| Pull request | Implementation and verification evidence | Code or documentation changes |

GitHub owns granular live execution. `project_tracking` keeps the durable
PRD-level summary. The TRD owns the approved technical design.

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
4. File a GitHub issue when work is independently assignable or should
   produce a pull request, investigation result, migration, contract, or other
   evidence. Add its canonical URL to the related tracking record's
   `external_refs`.

One PTW may aggregate several GitHub issues. A small deliverable may map one PTW
to one issue. Do not create an issue merely to mirror every PRD record.

## Splitting executable work

Split a PTW into separate GitHub issues when slices can have different owners,
produce separate pull requests, block or release independently, use different
verification evidence, cross subsystem or trust boundaries, or exceed three
focused delivery days. Keep small inseparable steps as a checklist in one issue.

Every implementation issue must identify its parent `PTW-###`, applicable TRD
section or `Not required`, one outcome, acceptance criteria, verification,
dependencies or blockers, and delivery size. A large issue is not ready and must
be split before implementation.

## Project issues and GitHub issues

A `PTI-###` records a material issue that PRD reviewers must see because it
affects scope, release readiness, risk, or several work items. A GitHub issue
records who will act and how live progress is tracked. A significant defect may
have both; a small implementation defect normally needs only the GitHub issue.

Use the same boundary for blockers: keep the immediate blocker on the GitHub
issue, and add a `PTB-###` only when it materially affects project or release
visibility.

## Definition of ready

A GitHub issue may enter a GitHub Project delivery view or start as a task when:

- it links to a `PTW-###`;
- affected functional requirements are approved;
- applicable NFRs are identified;
- acceptance conditions and verification evidence are defined;
- a TRD exists when the technical design is non-trivial;
- dependencies, blockers, owner, and delivery size are known.

FRs and NFRs do not enter delivery views. GitHub issues do; PTWs summarize their
delivery.

## Status transitions

When the first linked issue starts, mark the issue in progress and set the PTW
to `in_progress`. During implementation, keep granular updates in GitHub.
Update the TRD only when technical design changes, and update the PRD
requirement only when product intent changes.

When work blocks, set the PTW to `blocked` if the deliverable cannot progress.
When verification passes and the pull request merges, close the GitHub issue.
Set the PTW to `done` only after all required linked issues and acceptance
conditions are complete. Record outcome metrics later when measurements become
available.

## GitHub references

Schema 1.2 adds optional `external_refs` to `PTW`, `PTI`, `PTB`, and `PTN`
records. Each value is a unique canonical URI:

```json
"external_refs": [
  "https://github.com/example/project/issues/123",
  "https://github.com/example/project/pull/456"
]
```

Use canonical `https://github.com` issue, pull-request, project, or iteration
URLs. Do not copy titles, labels, assignees, comments, or live status into
`external_refs`; GitHub remains authoritative.

## CI enforcement

Scaffolded projects include `.github/workflows/prd-governance.yml`,
`.github/ISSUE_TEMPLATE/implementation.yml`, and
`.github/pull_request_template.md`. The workflow runs
`tools/validate_delivery_tracking.py` and rejects:

- non-GitHub project-tracking references;
- active or blocked PTWs without a GitHub issue URL;
- pull requests without a canonical `PTW-###` reference;
- pull requests that do not close a GitHub issue;
- linked issues missing the required task sections or marked `Large`.

Repository owners must make the `prd-governance` check required in the GitHub
ruleset for the default branch. CI cannot enforce merge policy until that branch
rule is enabled.

Schema 1.0 and 1.1 documents remain backward compatible. When an existing PRD
starts using `external_refs`, update `meta.schema_contract` to 1.2 and record the
backward-compatible migration; do not add empty arrays to every historical
record merely to rewrite the file.

## Common cases

- Existing-requirement bug: GitHub issue and an existing or new PTW. Update
  the PRD or TRD only if behavior or design changes.
- New feature: update PRD, approve requirements, create PTW, write TRD when
  needed, then file and schedule GitHub issues.
- Quality-target change: update NFR, update TRD measurement design, create PTW,
  then file the issue.
- Internal refactor: GitHub issue only unless it changes architecture or a
  tracked delivery milestone.
- Architecture migration: PTW, TRD, `DEC-###`, and one or more GitHub issues.
