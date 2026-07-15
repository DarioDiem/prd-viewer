import fs from "node:fs/promises";
import path from "node:path";

import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

import type { PacsMcpConfig, PacsMcpTransport } from "./config.js";
import type { PrdIndexResult } from "./prd-index.js";
import type { PrdLoadResult } from "./prd-loader.js";
import { estimateJsonPayload, type ResponseEnvelope, type ResponseMode } from "./response-modes.js";

export type MetricRequestChannel = "resource" | "tool";
export type MetricRequestScope = "focused" | "full_document";

export type MetricEvent = {
  schema: "pacs.mcp.metric.v1";
  recorded_at: string;
  transport: PacsMcpTransport;
  request: {
    channel: MetricRequestChannel;
    name: string;
    target: string;
    scope: MetricRequestScope;
    requested_mode: ResponseMode | null;
    input: SanitizedInput;
  };
  outcome: {
    status: "success" | "error";
    error_code: string | null;
    error_message: string | null;
  };
  source: {
    artifact_path: string;
    artifact_name: string;
    load_status: string | null;
    validation_status: string | null;
    compatibility_status: string | null;
    load_cache_state: string | null;
    index_status: string | null;
    index_cache_state: string | null;
  };
  performance: {
    duration_ms: number;
  };
  response: {
    kind: string | null;
    mode: ResponseMode | null;
    json_bytes: number | null;
    json_chars: number | null;
    approx_tokens: number | null;
    baseline_document_bytes: number | null;
    baseline_document_approx_tokens: number | null;
    savings_vs_document_bytes: number | null;
    savings_vs_document_tokens: number | null;
    full_document_fallback: boolean;
    packet_preset: string | null;
    packet_max_tokens: number | null;
    packet_estimated_tokens: number | null;
    packet_truncated: boolean | null;
  };
};

type SanitizedInput = {
  keys: string[];
  mode: ResponseMode | null;
  limit: number | null;
  query_length: number | null;
  goal_length: number | null;
  preset: string | null;
  max_tokens: number | null;
  include_unresolved: boolean | null;
  id: string | null;
  ids: string[];
  sections: string[];
  counts: {
    ids: number;
    sections: number;
  };
  redacted_fields: string[];
};

export type MetricRecordOptions = {
  channel: MetricRequestChannel;
  name: string;
  target: string;
  scope?: MetricRequestScope;
  requestedMode?: string | null;
  input?: Record<string, unknown> | null;
  load?: PrdLoadResult | null;
  index?: PrdIndexResult | null;
  response?: unknown;
  durationMs: number;
  error?: unknown;
};

export class MetricsRecorder {
  constructor(private readonly config: PacsMcpConfig) {}

  async record(options: MetricRecordOptions): Promise<MetricEvent> {
    const event = buildMetricEvent(this.config, options);
    await fs.mkdir(path.dirname(this.config.metricsPath), { recursive: true });
    await fs.appendFile(this.config.metricsPath, `${JSON.stringify(event)}\n`, "utf8");
    return event;
  }
}

export function buildMetricEvent(config: PacsMcpConfig, options: MetricRecordOptions): MetricEvent {
  const responseEstimate = estimateResponse(options.response);
  const requestedMode = normalizeRequestedMode(options.requestedMode);
  const loadSnapshot = options.load?.snapshot ?? null;
  const indexSnapshot = options.index?.snapshot ?? null;

  return {
    schema: "pacs.mcp.metric.v1",
    recorded_at: new Date().toISOString(),
    transport: config.transport,
    request: {
      channel: options.channel,
      name: options.name,
      target: options.target,
      scope: options.scope ?? "focused",
      requested_mode: requestedMode,
      input: sanitizeInput(options.input ?? null)
    },
    outcome: buildOutcome(options.error),
    source: {
      artifact_path: config.prdPath,
      artifact_name: path.basename(config.prdPath),
      load_status: loadSnapshot?.status ?? null,
      validation_status: loadSnapshot?.validation.status ?? null,
      compatibility_status: loadSnapshot?.compatibility?.status ?? null,
      load_cache_state: loadSnapshot?.cacheState ?? null,
      index_status: indexSnapshot?.status ?? null,
      index_cache_state: indexSnapshot?.cacheState ?? null
    },
    performance: {
      duration_ms: Math.max(0, Math.round(options.durationMs))
    },
    response: {
      ...responseEstimate,
      full_document_fallback: (options.scope ?? "focused") === "full_document"
    }
  };
}

function sanitizeInput(input: Record<string, unknown> | null): SanitizedInput {
  if (!input) {
    return emptySanitizedInput();
  }

  const keys = Object.keys(input).sort();
  const ids = sanitizeIdArray(input.ids);
  const sections = sanitizeSections(input.sections);
  const redactedFields: string[] = [];

  if (typeof input.query === "string") {
    redactedFields.push("query");
  }

  if (typeof input.goal === "string") {
    redactedFields.push("goal");
  }

  keys.forEach((key) => {
    if (key !== "id" && key !== "ids" && key !== "sections" && key !== "limit" && key !== "mode" && key !== "query" && key !== "goal" && key !== "preset" && key !== "max_tokens" && key !== "include_unresolved") {
      const value = input[key];
      if (typeof value === "string" || Array.isArray(value) || (typeof value === "object" && value !== null)) {
        redactedFields.push(key);
      }
    }
  });

  return {
    keys,
    mode: normalizeRequestedMode(typeof input.mode === "string" ? input.mode : null),
    limit: typeof input.limit === "number" ? input.limit : null,
    query_length: typeof input.query === "string" ? input.query.length : null,
    goal_length: typeof input.goal === "string" ? input.goal.length : null,
    preset: typeof input.preset === "string" ? input.preset : null,
    max_tokens: typeof input.max_tokens === "number" ? input.max_tokens : null,
    include_unresolved: typeof input.include_unresolved === "boolean" ? input.include_unresolved : null,
    id: sanitizeId(input.id),
    ids,
    sections,
    counts: {
      ids: Array.isArray(input.ids) ? input.ids.length : 0,
      sections: Array.isArray(input.sections) ? input.sections.length : 0
    },
    redacted_fields: [...new Set(redactedFields)].sort()
  };
}

function emptySanitizedInput(): SanitizedInput {
  return {
    keys: [],
    mode: null,
    limit: null,
    query_length: null,
    goal_length: null,
    preset: null,
    max_tokens: null,
    include_unresolved: null,
    id: null,
    ids: [],
    sections: [],
    counts: {
      ids: 0,
      sections: 0
    },
    redacted_fields: []
  };
}

function sanitizeId(value: unknown): string | null {
  return typeof value === "string" && isSafeId(value) ? value : null;
}

function sanitizeIdArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => sanitizeId(item)).filter((item): item is string => item !== null) : [];
}

function sanitizeSections(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .filter((item) => /^[a-z0-9_.-]{1,80}$/i.test(item))
    : [];
}

function isSafeId(value: string): boolean {
  return /^[A-Z][A-Z0-9_]*-\d+$/.test(value);
}

function normalizeRequestedMode(value: string | null | undefined): ResponseMode | null {
  if (value === "compact" || value === "standard" || value === "full") {
    return value;
  }

  return null;
}

function buildOutcome(error: unknown): MetricEvent["outcome"] {
  if (!error) {
    return {
      status: "success",
      error_code: null,
      error_message: null
    };
  }

  if (error instanceof McpError) {
    return {
      status: "error",
      error_code: mapErrorCode(error.code),
      error_message: sanitizeErrorMessage(error.message)
    };
  }

  if (error instanceof Error) {
    return {
      status: "error",
      error_code: "internal_error",
      error_message: sanitizeErrorMessage(error.message)
    };
  }

  return {
    status: "error",
    error_code: "unknown_error",
    error_message: null
  };
}

function mapErrorCode(code: number): string {
  switch (code) {
    case ErrorCode.InvalidParams:
      return "invalid_params";
    case ErrorCode.InternalError:
      return "internal_error";
    default:
      return String(code);
  }
}

function sanitizeErrorMessage(message: string): string {
  return message.replace(/\s+/g, " ").trim().slice(0, 200);
}

function estimateResponse(response: unknown): MetricEvent["response"] {
  if (isResponseEnvelope(response)) {
    const packet = asRecord(response.payload);
    return {
      kind: response.kind,
      mode: response.mode,
      json_bytes: response.estimates.json_bytes,
      json_chars: response.estimates.json_chars,
      approx_tokens: response.estimates.approx_tokens,
      baseline_document_bytes: response.estimates.baseline_document_bytes,
      baseline_document_approx_tokens: response.estimates.baseline_document_approx_tokens,
      savings_vs_document_bytes: response.estimates.savings_vs_document_bytes,
      savings_vs_document_tokens: response.estimates.savings_vs_document_tokens,
      full_document_fallback: false,
      packet_preset: typeof packet?.preset === "string" ? packet.preset : null,
      packet_max_tokens: typeof packet?.max_tokens === "number" ? packet.max_tokens : null,
      packet_estimated_tokens: typeof packet?.estimated_tokens === "number" ? packet.estimated_tokens : null,
      packet_truncated: typeof packet?.truncated === "boolean" ? packet.truncated : null
    };
  }

  if (response === undefined) {
    return {
      kind: null,
      mode: null,
      json_bytes: null,
      json_chars: null,
      approx_tokens: null,
      baseline_document_bytes: null,
      baseline_document_approx_tokens: null,
      savings_vs_document_bytes: null,
      savings_vs_document_tokens: null,
      full_document_fallback: false,
      packet_preset: null,
      packet_max_tokens: null,
      packet_estimated_tokens: null,
      packet_truncated: null
    };
  }

  const estimate = estimateJsonPayload(response);

  return {
    kind: null,
    mode: null,
    json_bytes: estimate.json_bytes,
    json_chars: estimate.json_chars,
    approx_tokens: estimate.approx_tokens,
    baseline_document_bytes: null,
    baseline_document_approx_tokens: null,
    savings_vs_document_bytes: null,
    savings_vs_document_tokens: null,
    full_document_fallback: false,
    packet_preset: null,
    packet_max_tokens: null,
    packet_estimated_tokens: null,
    packet_truncated: null
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isResponseEnvelope(value: unknown): value is ResponseEnvelope {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.kind === "string" && typeof candidate.mode === "string" && typeof candidate.estimates === "object";
}
