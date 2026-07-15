# Local MVP Runbook

This runbook covers the local-only PRD Viewer MVP. The viewer must not send PRD content to third-party services during open, edit, validate, save, export, or diagnostics flows.

## Setup

Run commands from `viewer/`.

```bash
npm install
npm run dev
```

Open the local Vite URL printed by `npm run dev`. The seed document is `viewer/PRD_web_ui.json`.

## Validation Gates

Run these before handing off viewer changes:

```bash
npm run check
npm run test
npm run test:e2e
npm run build
python3 ../tools/prd_schema_compat.py PRD_web_ui.json --stats-json
```

Use `python3 ../tools/prd_schema_compat.py PRD_web_ui.json --stats-json` after changing `viewer/PRD_web_ui.json`.

## Browser Limitations

- Writable save-back uses the File System Access API and is only available in browsers that expose `showOpenFilePicker`.
- If writable open is unavailable, use `Open PRD` for read-only review and `Export PRD` for a validated local copy.
- Browser sessions keep diagnostics in memory only. Refreshing the page clears the local event list unless the user exports diagnostics first.
- The traceability graph canvas is pointer-friendly; keyboard users should use the `Focused node` selector and focused trace details.

## Failed Writeback Recovery

1. Do not refresh immediately after a failed save. The pending changes remain in the browser session.
2. Check the `Pending writeback preview` and the save message.
3. Use `Export diagnostics` to capture local structured events for support.
4. Use `Export PRD` to create a validated local copy if writable save cannot be retried.
5. Re-open the original canonical PRD and compare against the exported copy before replacing any file manually.

Failed or blocked saves must not replace the last valid canonical PRD.

## Malformed PRDs

When a PRD fails to parse or validate:

1. Keep the malformed file unchanged for investigation.
2. Use the validation panel to capture JSON paths and schema keywords.
3. Use `Export diagnostics`; the snapshot excludes PRD content and large field values.
4. Report the filename, browser, validation paths, schema version, and diagnostic snapshot.

Do not paste full PRD content into issue trackers unless the PRD owner explicitly approves it.

## Triage Ownership

- Schema issues: Engineering owns schema contract triage and decides whether the PRD or `schema.strict.json` needs a fix.
- UI bugs: Engineering owns viewer behavior, keyboard access, diagnostics, export, and writeback defects.
- PRD content problems: Product owns malformed or incomplete PRD content decisions, with Engineering advising on schema paths.
- Privacy or compliance concerns: Compliance owns retention, identity, and shared-deployment questions before any non-local rollout.

## Local Diagnostics

The viewer records local structured events for load, validate, edit, export, save, and failure paths. Events include action, timestamp, outcome, section, validation counts, and short operational details. Events must not include PRD content, secrets, raw JSON, titles, descriptions, notes, questions, or large field values.

Use `Export diagnostics` to download a local support snapshot.
