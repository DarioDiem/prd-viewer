# PRD Viewer

Local-first reviewer UI for PRD JSON artifacts. The canonical product definition for this subproject is `viewer/PRD_web_ui.json`; implementation decisions should be reflected there before or alongside code changes.

## Tool Stack

- Vite, React, and TypeScript for the browser app shell.
- Ajv with `ajv-formats` for JSON Schema draft 2020-12 validation against `../schema.strict.json`.
- JSON Forms with vanilla renderers for schema-driven section editors.
- `vanilla-jsoneditor` for raw JSON maintainer mode.
- `@xyflow/react` for the future traceability graph.
- Plain CSS for the initial design system to keep the app local, inspectable, and dependency-light.

More detail is in `docs/tool-stack.md`.
Local support and recovery procedures are in `docs/local-mvp-runbook.md`.
The implementation and public-release design is in `TRD.md`.

## Layout

- `src/App.tsx` - initial reviewer workspace.
- `src/components/` - reusable UI pieces.
- `src/lib/` - PRD summary plus placeholders for validation, traceability, and file-session helpers.
- `src/types/` - TypeScript shapes for PRD documents and derived view models.
- `docs/` - implementation notes tied back to the PRD.

## Commands

```bash
npm install
npm run dev
npm run check
npm run test
npm run test:e2e
npm run build
npm run report:generate -- --project-name "PRD Viewer Status"
```

The local MVP loads `viewer/PRD_web_ui.json` as the seed document and supports local file open, strict schema validation, structured section editing, raw JSON maintainer edits, traceability review, metrics ingestion, export, writable save-back where supported by the browser, and local diagnostics export.

`npm run report:generate` creates a standalone HTML project status report at `dist/reports/<slug>/index.html` plus local metadata. The report includes reader-facing status, readiness, project tracking, risks, questions, decisions, and a sidebar, while excluding editor controls, schema validation panels, compatibility metrics, and diagnostics.
