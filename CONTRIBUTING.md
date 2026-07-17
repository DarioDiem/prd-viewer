# Contributing to PRD Viewer

Thank you for helping improve PRD Viewer. Keep changes focused, preserve canonical
PRD identifiers, and update product or technical artifacts when behavior or
design changes.

## Development setup

Use Node.js 20.19 or newer and Python 3.11 or newer.

```bash
npm ci
npm --prefix mcp ci
npm --prefix viewer ci
python3 -m pip install -r tools/requirements-prd-validation.txt
```

## Change workflow

1. Create a GitHub issue from the PRD implementation task form and link it to a
   `PTW-###` record. GitHub Issues are the only ticket system.
2. Update the linked TRD before implementation when architecture, interfaces,
   data ownership, security boundaries, deployment, operations, or non-trivial
   verification changes.
3. Split work when slices need different owners, pull requests, blockers,
   verification, trust boundaries, or more than three focused delivery days.
4. Keep `.agents/*.yaml` as the source for generated agent definitions.
5. Do not commit credentials, local PRD data, metrics, dependencies, build
   output, test output, or browser artifacts.
6. Open a focused pull request that references its `PTW-###`, closes its GitHub
   issue, and includes the relevant validation evidence.

## Validation

For framework and agent changes:

```bash
npm run validate:agents
python3 tools/prd_schema_compat.py viewer/PRD_web_ui.json --stats-json
python3 tools/validate_delivery_tracking.py viewer/PRD_web_ui.json
python3 -m unittest tools.test_init_prd_project
python3 -m unittest tools.test_validate_delivery_tracking
```

For MCP changes:

```bash
npm --prefix mcp run check
npm --prefix mcp test
npm --prefix mcp run build
```

For Viewer changes:

```bash
npm --prefix viewer run check
npm --prefix viewer test
npm --prefix viewer run build
npm --prefix viewer run test:e2e
```

Before proposing a public release, run `npm audit --audit-level=high` in the
root, `mcp/`, and `viewer/` packages. Finish with `git diff --check`. TOON is an optional benchmark and is not a
contribution or release gate.

## Reporting problems

Use a GitHub issue for non-sensitive defects and feature requests. Follow
`SECURITY.md` for vulnerabilities or reports that contain sensitive details.
