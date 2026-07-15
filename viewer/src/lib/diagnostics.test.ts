import { describe, expect, it } from "vitest";
import { buildDiagnosticSnapshot, createDiagnosticEvent, sanitizeDiagnosticDetails } from "./diagnostics";

describe("diagnostics", () => {
  it("redacts content-like and secret-like diagnostic detail fields", () => {
    const details = sanitizeDiagnosticDetails({
      action_context: "safe",
      raw_json: "{\"secret\":\"prd content\"}",
      title: "Sensitive PRD title",
      authToken: "token-value",
      errorMessage: "May include local file paths or content",
      description: "Sensitive long description",
      issue_paths: ["$[\"meta\"][\"title\"]", "$[\"requirements\"]"],
      large_value: "x".repeat(120),
      nested: { ignored: true }
    });

    expect(details).toEqual({
      action_context: "safe",
      raw_json: "[redacted]",
      title: "[redacted]",
      authToken: "[redacted]",
      errorMessage: "[redacted]",
      description: "[redacted]",
      issue_paths: ["$[\"meta\"][\"title\"]", "$[\"requirements\"]"],
      large_value: `${"x".repeat(80)}...`
    });
  });

  it("creates content-free structured events and downloadable snapshots", () => {
    const event = createDiagnosticEvent({
      action: "save",
      outcome: "failure",
      documentRevision: 4,
      section: "requirements",
      details: {
        reason: "write_failed",
        errorMessage: "disk full",
        rawSectionJson: "{\"title\":\"Do not include\"}"
      },
      timestamp: "2026-04-23T10:00:00.000Z"
    });
    const snapshot = buildDiagnosticSnapshot([event], "2026-04-23T10:01:00.000Z");

    expect(event).toMatchObject({
      schema: "pacs.viewer.diagnostic-event.v1",
      action: "save",
      outcome: "failure",
      document_revision: 4,
      section: "requirements",
      details: {
        reason: "write_failed",
        errorMessage: "[redacted]",
        rawSectionJson: "[redacted]"
      }
    });
    expect(snapshot).toEqual({
      schema: "pacs.viewer.diagnostic-snapshot.v1",
      exported_at: "2026-04-23T10:01:00.000Z",
      event_count: 1,
      events: [event],
      redaction: {
        content_fields_removed: true,
        max_string_length: 80
      }
    });
  });
});
