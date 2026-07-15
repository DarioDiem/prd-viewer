import type { SectionKey } from "../types/prd";

export type DiagnosticAction = "load" | "validate" | "edit" | "export" | "save";
export type DiagnosticOutcome = "started" | "success" | "blocked" | "failure";
export type DiagnosticDetailValue = string | number | boolean | null | Array<string | number>;
export type DiagnosticDetails = Record<string, DiagnosticDetailValue>;

export type DiagnosticEvent = {
  schema: "pacs.viewer.diagnostic-event.v1";
  event_id: string;
  timestamp: string;
  action: DiagnosticAction;
  outcome: DiagnosticOutcome;
  document_revision: number;
  section: SectionKey | null;
  details: DiagnosticDetails;
};

export type DiagnosticSnapshot = {
  schema: "pacs.viewer.diagnostic-snapshot.v1";
  exported_at: string;
  event_count: number;
  events: DiagnosticEvent[];
  redaction: {
    content_fields_removed: boolean;
    max_string_length: number;
  };
};

const maxDiagnosticStringLength = 80;
const maxArrayItems = 8;
const sensitiveKeyPattern = /(secret|token|password|credential|authorization|content|body|raw|json|title|summary|description|statement|rationale|question|resolution|notes|message)/i;

export function createDiagnosticEvent({
  action,
  outcome,
  documentRevision,
  section = null,
  details = {},
  timestamp = new Date().toISOString()
}: {
  action: DiagnosticAction;
  outcome: DiagnosticOutcome;
  documentRevision: number;
  section?: SectionKey | null;
  details?: Record<string, unknown>;
  timestamp?: string;
}): DiagnosticEvent {
  return {
    schema: "pacs.viewer.diagnostic-event.v1",
    event_id: `${timestamp}:${action}:${outcome}:${documentRevision}`,
    timestamp,
    action,
    outcome,
    document_revision: documentRevision,
    section,
    details: sanitizeDiagnosticDetails(details)
  };
}

export function buildDiagnosticSnapshot(events: DiagnosticEvent[], exportedAt = new Date().toISOString()): DiagnosticSnapshot {
  return {
    schema: "pacs.viewer.diagnostic-snapshot.v1",
    exported_at: exportedAt,
    event_count: events.length,
    events,
    redaction: {
      content_fields_removed: true,
      max_string_length: maxDiagnosticStringLength
    }
  };
}

export function sanitizeDiagnosticDetails(details: Record<string, unknown>): DiagnosticDetails {
  return Object.fromEntries(
    Object.entries(details).flatMap(([key, value]) => {
      if (sensitiveKeyPattern.test(key)) {
        return [[key, "[redacted]"]];
      }

      const sanitized = sanitizeDiagnosticValue(value);

      return sanitized === undefined ? [] : [[key, sanitized]];
    })
  );
}

function sanitizeDiagnosticValue(value: unknown): DiagnosticDetailValue | undefined {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return value.length > maxDiagnosticStringLength
      ? `${value.slice(0, maxDiagnosticStringLength)}...`
      : value;
  }

  if (Array.isArray(value)) {
    const sanitizedItems = value
      .slice(0, maxArrayItems)
      .map((item) => sanitizeDiagnosticValue(item))
      .filter((item): item is string | number => typeof item === "string" || typeof item === "number");

    return sanitizedItems;
  }

  return undefined;
}
