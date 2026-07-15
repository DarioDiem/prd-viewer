# AGENTS.md

## Subproject Overview

The viewer is a local-first web UI for reviewing canonical PRD JSON artifacts. The source of truth for this subproject is `viewer/PRD_web_ui.json`; implementation decisions that affect scope, validation, storage, or workflow should be reflected there before or alongside code changes.

## Setup Commands

- Install deps from `viewer/`: `npm install`
- Start dev server from `viewer/`: `npm run dev`
- Type-check from `viewer/`: `npm run check`
- Build from `viewer/`: `npm run build`

## Stack

- Vite, React, and TypeScript for the browser app shell.
- Ajv with `ajv-formats` for JSON Schema validation against `../schema.strict.json`.
- JSON Forms for schema-driven section editing.
- `vanilla-jsoneditor` for raw JSON maintainer mode.
- `@xyflow/react` for traceability graph work.
- Plain CSS for the initial design system.

## Web UI Rules

- Keep `PRD.json` as the canonical artifact. Any database, cache, search index, or metrics store must be derived and rebuildable.
- For viewer implementation and review work, treat `viewer/PRD_web_ui.json` as the live subproject source of truth. When the local `prd-viewer` MCP server is available, prefer its focused reads such as `search_prd`, `get_entity`, `get_linked_entities`, `build_agent_packet`, `prd://summary`, and `prd://section/{name}` before reading large PRD sections directly.
- Fall back to targeted local reads only when the MCP server is unavailable, and read the full PRD artifact only for schema-wide validation, deterministic export checks, migration work, or complete artifact review.
- Validate every load, edit, save, and export against `schema.strict.json`.
- Fail closed on invalid PRD data; do not silently repair or rewrite canonical data.
- Keep the MVP local-first and avoid mandatory backend services.
- Make serialization deterministic and semantically lossless so diffs remain stable.
- Do not send PRD content to third-party services during open, edit, validate, or save flows by default.
- Interrupted or failed writeback must leave the last valid PRD JSON readable and unchanged.

## Testing Instructions

- Run `npm run check` before finishing TypeScript changes.
- Run `npm run build` when changing bundling, package versions, or import paths.
- Add or update focused tests when changing validation, traceability, writeback, serialization, or editor behavior.
