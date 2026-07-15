export declare const responseModes: readonly ["compact", "standard", "full"];
export type ResponseMode = (typeof responseModes)[number];
export type PayloadEstimate = {
    json_bytes: number;
    json_chars: number;
    approx_tokens: number;
};
export type ResponseEnvelope = {
    kind: string;
    mode: ResponseMode;
    estimates: PayloadEstimate & {
        baseline_document_bytes: number | null;
        baseline_document_approx_tokens: number | null;
        savings_vs_document_bytes: number | null;
        savings_vs_document_tokens: number | null;
    };
    payload: unknown;
};
export declare function normalizeResponseMode(input: string | null | undefined): ResponseMode;
export declare function wrapResponse(kind: string, mode: ResponseMode, rawPayload: unknown, baselineDocumentBytes: number | null): ResponseEnvelope;
export declare function estimateJsonPayload(payload: unknown): PayloadEstimate;
