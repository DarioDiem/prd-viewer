# PRD Framework Extraction Plan

## Goal

Turn the current viewer and MCP work into a reusable local framework that one developer can apply to multiple projects in parallel without copying ad hoc files or re-explaining the PRD workflow to each new agent session.

## Recommended extraction model

Use one shared framework plus one project-local PRD instance.

- Shared framework:
  - PRD schema and compatibility assets
  - MCP server package
  - validation and extraction scripts
  - generic agent definitions and skills
  - bootstrap templates and examples
- Project-local instance:
  - canonical project PRD JSON
  - local metrics directory
  - optional viewer app or reviewer workspace
  - project-specific agent instructions and IDs

## Target package split

### `packages/prd-schema`

Owns:

- `schema.strict.json`
- `schema.json`
- `schema.versions.json`
- compatibility helpers
- validation helpers

Exports:

- schema files
- version metadata
- validation API

### `packages/prd-mcp`

Owns:

- local MCP server runtime
- stdio and localhost HTTP transports
- focused read/query tools
- local JSONL metrics

Depends on:

- `prd-schema`

### `packages/prd-agent-assets`

Owns:

- reusable `.agents/*.yaml`
- generated agent sync rules
- generic skills that are not viewer-specific

### `templates/prd-project`

Owns the starting project skeleton:

- canonical `PRD.json`
- optional viewer workspace
- local metrics directory
- sample `prd.config.example.json`
- minimal `AGENTS.md`

## Per-project contract

Every adopted project should define:

- project name and stable project ID
- canonical PRD path
- local metrics path
- preferred transport: `stdio` by default, optional `http`
- if using HTTP:
  - localhost host
  - dedicated port
  - endpoint path
  - optional explicit allowed origins

The example contract is captured in [prd.config.example.json](prd.config.example.json).

## Recommended runtime model for multiple projects

Use one MCP instance per project.

- Project A:
  - PRD A
  - metrics A
  - optional HTTP port A
- Project B:
  - PRD B
  - metrics B
  - optional HTTP port B

Do not start with one global multi-project server. That adds routing, isolation, and cache-scope complexity before it is needed.

## Instantiation flow for a new project

1. Copy or generate the project template.
2. Create the project PRD artifact.
3. Set the project-local PRD path and metrics path.
4. Choose transport:
   - `stdio` for one client / one agent workflow
   - `http` for multiple concurrent local clients on the same project
5. Register the MCP server in the local client config.
6. Add project-local `AGENTS.md` guidance that prefers MCP reads over full PRD reads.

## Near-term extraction sequence

### Phase 1: stabilize reusable interfaces

- keep schema versioning deterministic
- keep MCP tool/resource names stable
- keep metrics redacted and append-only
- keep transport settings project-local

### Phase 2: extract shared packages

- move schema assets into `packages/prd-schema`
- move MCP runtime into `packages/prd-mcp`
- move generic agent assets into `packages/prd-agent-assets`

### Phase 3: create the bootstrap path

- add a project template directory
- add a bootstrap script such as `tools/init_prd_project.*`
- emit:
  - PRD file
  - metrics directory
  - starter `AGENTS.md`
  - MCP registration example

Implemented locally with:

- `templates/prd-project/`
- `tools/init_prd_project.py`
- `python3 -m unittest tools/test_init_prd_project.py`

Current bootstrap modes:

- default:
  - creates the project PRD, config, metrics scaffold, and MCP registration guidance
  - copies the schema and validation bundle into the new project so `PRD.json` can be validated locally without depending on the framework repo layout
  - expects the shared PRD framework repo to remain available for specialist agent definitions
- `--upgrade-existing`:
  - refreshes framework-managed files in place for an already bootstrapped project
  - preserves the existing `PRD.json` by default
  - keeps existing `prd.config.json` values where they already exist and fills in missing framework defaults
  - can be combined with `--include-agents` or used to refresh already-present local agent assets
  - can be combined with `--remove-legacy-agents` to explicitly remove the known PRD-vendored agent assets while preserving unrelated files
- `--include-agents`:
  - copies a curated local subset of `.agents/*.yaml`, `.codex/agents/*`, `.gemini/agents/*`, and reusable PRD skills
  - makes the bootstrapped project more self-contained at the cost of later drift from the framework repo
  - is retained for clients that require project-local specialist definitions; the plugin does not delete these files automatically

### Phase 4: support multi-project operations

- standardize per-project config discovery
- reserve one HTTP port per project when needed
- keep metrics isolated per project
- document branch/repo-local rollout rules

## Acceptance criteria for extraction

- a second project can start without copying files manually
- the MCP server can target a different PRD path without code edits
- schema validation works outside this repo layout
- agent instructions remain focused and project-local
- metrics remain separated by project

## What not to do

- do not make the MCP server the source of truth
- do not centralize several projects into one mutable in-memory PRD store as the first extraction step
- do not couple the framework to the current viewer app structure
- do not require HTTP for all projects; keep `stdio` as the default
