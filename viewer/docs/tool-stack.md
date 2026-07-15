# PRD Viewer Tool Stack

## Interface Direction

Visual thesis: a dense reviewer workspace with calm surfaces, strong section hierarchy, restrained color, and clear validation/readiness states.

Content plan: start on the working dashboard, keep section navigation persistent, expose document health and blockers first, and reserve editor/traceability panels for the selected section.

Interaction thesis: use quick section switching, progressive panel reveals, and focused hover/focus states for review actions before adding heavier motion.

## Stack Decision

The scaffold uses Vite, React, and TypeScript because the PRD calls for a local-first browser UI, schema-driven forms, a raw JSON editor, and graph traceability. React is the most direct fit for JSON Forms and React Flow, while Vite keeps local setup small and fast.

## Selected Packages

| Concern | Package | Reason |
| --- | --- | --- |
| App shell | `vite`, `@vitejs/plugin-react` | Fast local dev server and production build with React fast refresh. |
| UI runtime | `react`, `react-dom` | Component model compatible with JSON Forms and React Flow. |
| Types | `typescript` | Compile-time guardrails for PRD view models and derived summaries. |
| Schema validation | `ajv`, `ajv-formats` | Browser-capable JSON Schema validation with date and URI formats. |
| Section editors | `@jsonforms/core`, `@jsonforms/react`, `@jsonforms/vanilla-renderers` | Schema-driven forms without duplicating the PRD contract in hand-built forms. |
| Raw JSON editor | `vanilla-jsoneditor` | Framework-neutral JSON tree/text editor for maintainer mode. |
| Trace graph | `@xyflow/react` | Interactive node and edge graph for PRD traceability relationships. |
| Unit and component tests | `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom` | Fast TDD loop for PRD derivation logic and React behavior using user-facing queries. |
| E2E tests | `@playwright/test` | Required browser-level coverage for app load, section navigation, file flows, validation, and export/writeback behavior. |

## Source Of Truth Rules

- `viewer/PRD_web_ui.json` remains the source of truth for this subproject.
- `../schema.strict.json` remains the validation contract for canonical PRD documents.
- Any database, search index, or metrics cache must be derived and rebuildable from canonical files.
- Package choices that materially affect scope, validation, storage, or review workflow should be recorded as PRD decisions.
- TDD is the delivery default: add or update Vitest tests for logic/components and Playwright tests for browser workflows before implementing behavior.

## Version Notes

Package versions were chosen from npm package pages checked on 2026-04-20:

- Vite: https://www.npmjs.com/package/vite
- Vite React plugin: https://www.npmjs.com/package/@vitejs/plugin-react
- React DOM: https://www.npmjs.com/package/react-dom
- JSON Forms React: https://www.npmjs.com/package/@jsonforms/react
- JSON Forms vanilla renderers: https://www.npmjs.com/package/@jsonforms/vanilla-renderers
- Ajv: https://www.npmjs.com/package/ajv
- Ajv formats: https://www.npmjs.com/package/ajv-formats
- vanilla-jsoneditor: https://www.npmjs.com/package/vanilla-jsoneditor
- React Flow: https://www.npmjs.com/package/@xyflow/react
- TypeScript: https://www.npmjs.com/package/typescript
- Vitest: https://www.npmjs.com/package/vitest
- Testing Library: https://testing-library.com/docs/
- React Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- Playwright Test: https://playwright.dev/docs/writing-tests
