# PRD Local MCP Server

This package hosts the local-only MCP server for the PRD framework.

Current implemented slice:

- `PTW-004`: freeze the first local MCP contract and package layout
- `PTW-005`: scaffold a runnable TypeScript MCP server on stdio with a minimal info surface
- `PTW-006`: load the active PRD from disk, validate it against `schema.strict.json`, check schema compatibility, and cache it until file metadata changes
- `PTW-007`: build a normalized in-memory index for sections, entities, and links on top of the validated loader cache
- `PTW-008`: expose core read resources for summary, compatibility, readiness, project tracking, sections, entities, and trace views
- `PTW-009`: expose core query tools for search, linked-entity lookup, blocker/question/decision lists, and compact agent packets
- `PTW-010`: support `compact`, `standard`, and `full` response modes with byte/token estimates for resources and tools
- `PTW-011`: record local-only structured MCP metrics as JSONL with content-redacted request summaries and response cost estimates
- `PTW-012`: add fixture-backed safety gates and stdio integration coverage for blocked loads, broken links, invalid requests, and query-mode resources
- `PTW-013`: add optional localhost Streamable HTTP transport with host/origin checks while keeping stdio as the default path

## Why this lives in `mcp/`

The viewer is a browser application. The MCP server is a local process-oriented integration layer for agentic tools. Keeping it in a separate top-level package keeps the runtime, dependencies, and deployment concerns isolated while still letting both packages evolve inside the same repo.

## Current contract

- Transport: `stdio` by default, optional localhost `http`
- Trust model: local-only, read-only
- Canonical artifact: JSON on disk remains the source of truth
- Default PRD path: `viewer/PRD_web_ui.json`
- Current capability surface:
  - resource: `prd://summary`
  - resource: `prd://compatibility`
  - resource: `prd://readiness`
  - resource: `prd://project-tracking`
  - resource template: `prd://section/{name}`
  - resource template: `prd://entity/{id}`
  - resource template: `prd://trace/{id}`
  - resource: `prd://server/info`
  - tool: `server_info`
  - tool: `search_prd`
  - tool: `get_entity`
  - tool: `get_linked_entities`
  - tool: `list_blockers`
  - tool: `list_open_questions`
  - tool: `list_proposed_decisions`
  - tool: `build_agent_packet`
    - presets: `implementation`, `review`, `triage`, `schema_change`
    - `max_tokens`: 256-32000, default 6000
    - unresolved work is excluded by default and can be requested with `include_unresolved`
  - resources and tools accept optional response mode controls:
    - resource URLs: `?mode=compact|standard|full`
    - tool input: `{ "mode": "compact" | "standard" | "full" }`
  - all reads stay local and expose the active load snapshot and index snapshot where relevant

## Next resource work

- richer section shaping for very large sections
- compatibility and readiness issue drill-down payloads

## Next tool work

- add richer search ranking and section-aware search snippets
- evaluate preset quality from content-redacted MCP metrics before adding more presets

## Metrics

The server now appends local-only JSONL metrics at `PRD_MCP_METRICS_PATH` or `.metrics/prd_viewer_mcp.jsonl` by default.

Each event records:

- request channel and target (`resource` or `tool`)
- requested response mode
- sanitized input metadata such as safe IDs, section names, lengths, and counts
- packet preset, requested budget, unresolved-content flag, estimated packet tokens, and truncation state
- load and index cache state
- latency
- response byte, character, and token estimates
- whether the request was a focused read or a full-document fallback

The metrics file does not store PRD payloads, raw search queries, raw packet goals, or large field values.

## Safety and integration coverage

The current test suite now covers:

- malformed JSON, schema-invalid PRDs, unsupported schema versions, required extensions, and broken trace links through reusable local fixtures
- blocked-load behavior through loader, index, and stdio client flows
- invalid resource and tool requests
- metrics emission for failure paths
- query-capable resource modes such as `prd://summary?mode=compact` and `prd://trace/PTW-008?mode=full`

## Inspector workflow

For local manual inspection, build the package and point MCP Inspector at the stdio entrypoint:

- `cd mcp && npm run build`
- `npx @modelcontextprotocol/inspector node "$PWD/dist/index.js"`

If you want the viewer PRD explicitly:

- `PRD_PATH="$PWD/../viewer/PRD_web_ui.json" npx @modelcontextprotocol/inspector node "$PWD/dist/index.js"`

For the optional HTTP transport:

- `PRD_MCP_TRANSPORT=http npm run start:http`
- then connect clients to `http://127.0.0.1:3334/mcp` unless you override the host, port, or path

## Response shaping

The server now supports:

- `compact`
- `standard`
- `full`

Each resource and tool response is wrapped with:

- the selected mode
- serialized byte and character counts
- an approximate token estimate
- comparison against the active full-document PRD size when available

## Environment

- `PRD_PATH`: optional relative or absolute path to the active PRD file
- `PRD_MCP_METRICS_PATH`: optional relative or absolute path for local JSONL metrics output
- `PRD_MCP_TRANSPORT`: `stdio` or `http`
- `PRD_MCP_HTTP_HOST`: localhost-only bind host for HTTP mode, default `127.0.0.1`
- `PRD_MCP_HTTP_PORT`: HTTP port for HTTP mode, default `3334`
- `PRD_MCP_HTTP_PATH`: HTTP endpoint path for HTTP mode, default `/mcp`
- `PRD_MCP_HTTP_ALLOWED_ORIGINS`: optional comma-separated explicit origin allowlist for HTTP mode

Relative paths resolve from the repo root.

## Commands

From `mcp/`:

- `npm install`
- `npm run check`
- `npm run build`
- `npm run dev`
- `npm run dev:http`
- `npm run start:http`

## Bootstrap a new project

From the framework root:

- `python3 tools/init_prd_project.py /path/to/new-project --project-name "New Project"`
- optional self-contained agent export:
  - `python3 tools/init_prd_project.py /path/to/new-project --project-name "New Project" --include-agents`
- upgrade an existing bootstrapped project in place:
  - `python3 tools/init_prd_project.py /path/to/existing-project --upgrade-existing`

That scaffold creates:

- `PRD.json`
- `prd.config.json`
- `AGENTS.md`
- `docs/mcp-registration.md`
- `.metrics/.gitkeep`
- `schema.strict.json`
- `schema.json`
- `schema.versions.json`
- `tools/prd_schema_compat.py`
- `tools/prd_extractor.py`
- `tools/prd_metrics.py`

With `--include-agents`, it also copies a curated local subset of:

- `.agents/*.yaml`
- `.codex/agents/*`
- `.gemini/agents/*`
- `.agents/skills/*`

The generated project keeps the PRD local, points agent users at focused MCP reads, and includes a concrete stdio plus optional HTTP registration example for the shared `prd-viewer` server.
It also includes a project-local schema validation bundle that does not depend on this framework repo's layout.
When you upgrade an existing project, the bootstrap refreshes the framework-managed bundle in place and preserves the current `PRD.json` unless you also pass `--refresh-prd`.

## Reuse plan

The extraction plan for reusing this framework across multiple projects lives in:

- [Framework extraction plan](../docs/framework-extraction-plan.md)
- [Example project configuration](../docs/prd.config.example.json)

## Safety stance

- No write tools
- No outbound PRD transmission
- No derived store treated as authoritative
- Local metrics stay content-redacted and must not log PRD payloads or arbitrary free-text inputs
- Active PRD loading fails closed on malformed JSON, schema-invalid documents, required extensions, and lossy compatibility states
- HTTP mode stays localhost-only and rejects invalid Host or Origin headers
