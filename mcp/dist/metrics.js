import fs from "node:fs/promises";
import path from "node:path";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { estimateJsonPayload } from "./response-modes.js";
export class MetricsRecorder {
    config;
    constructor(config) {
        this.config = config;
    }
    async record(options) {
        const event = buildMetricEvent(this.config, options);
        await fs.mkdir(path.dirname(this.config.metricsPath), { recursive: true });
        await fs.appendFile(this.config.metricsPath, `${JSON.stringify(event)}\n`, "utf8");
        return event;
    }
}
export function buildMetricEvent(config, options) {
    const responseEstimate = estimateResponse(options.response);
    const requestedMode = normalizeRequestedMode(options.requestedMode);
    const loadSnapshot = options.load?.snapshot ?? null;
    const indexSnapshot = options.index?.snapshot ?? null;
    return {
        schema: "prd.mcp.metric.v1",
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
function sanitizeInput(input) {
    if (!input) {
        return emptySanitizedInput();
    }
    const keys = Object.keys(input).sort();
    const ids = sanitizeIdArray(input.ids);
    const sections = sanitizeSections(input.sections);
    const redactedFields = [];
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
function emptySanitizedInput() {
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
function sanitizeId(value) {
    return typeof value === "string" && isSafeId(value) ? value : null;
}
function sanitizeIdArray(value) {
    return Array.isArray(value) ? value.map((item) => sanitizeId(item)).filter((item) => item !== null) : [];
}
function sanitizeSections(value) {
    return Array.isArray(value)
        ? value
            .filter((item) => typeof item === "string")
            .filter((item) => /^[a-z0-9_.-]{1,80}$/i.test(item))
        : [];
}
function isSafeId(value) {
    return /^[A-Z][A-Z0-9_]*-\d+$/.test(value);
}
function normalizeRequestedMode(value) {
    if (value === "compact" || value === "standard" || value === "full") {
        return value;
    }
    return null;
}
function buildOutcome(error) {
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
function mapErrorCode(code) {
    switch (code) {
        case ErrorCode.InvalidParams:
            return "invalid_params";
        case ErrorCode.InternalError:
            return "internal_error";
        default:
            return String(code);
    }
}
function sanitizeErrorMessage(message) {
    return message.replace(/\s+/g, " ").trim().slice(0, 200);
}
function estimateResponse(response) {
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
function asRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : null;
}
function isResponseEnvelope(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }
    const candidate = value;
    return typeof candidate.kind === "string" && typeof candidate.mode === "string" && typeof candidate.estimates === "object";
}
