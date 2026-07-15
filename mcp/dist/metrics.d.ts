import type { PacsMcpConfig, PacsMcpTransport } from "./config.js";
import type { PrdIndexResult } from "./prd-index.js";
import type { PrdLoadResult } from "./prd-loader.js";
import { type ResponseMode } from "./response-modes.js";
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
export declare class MetricsRecorder {
    private readonly config;
    constructor(config: PacsMcpConfig);
    record(options: MetricRecordOptions): Promise<MetricEvent>;
}
export declare function buildMetricEvent(config: PacsMcpConfig, options: MetricRecordOptions): MetricEvent;
export {};
