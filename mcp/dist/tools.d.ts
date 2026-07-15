import type { IndexedEntity, PrdIndexResult } from "./prd-index.js";
import type { PrdLoadResult } from "./prd-loader.js";
export type SearchResult = {
    type: "entity" | "section";
    id: string;
    title: string;
    section: string;
    score: number;
    status: string | null;
};
export type AgentPacket = {
    schema: "prd.agent-packet.v2";
    goal: string | null;
    preset: AgentPacketPreset;
    max_tokens: number;
    estimated_tokens: number;
    include_unresolved: boolean;
    truncated: boolean;
    omitted: {
        sections: string[];
        entity_ids: string[];
        trace_ids: string[];
        unresolved_items: number;
    };
    selected_ids: string[];
    selected_sections: string[];
    summary: {
        prd_id: string | null;
        title: string | null;
        document_version: string | null;
        schema_version: string | null;
        updated_at: string | null;
    } | null;
    sections: unknown[];
    entities: unknown[];
    traces: unknown[];
    unresolved: {
        blockers: unknown[];
        open_questions: unknown[];
        proposed_decisions: unknown[];
    };
};
export declare const agentPacketPresets: readonly ["implementation", "review", "triage", "schema_change"];
export type AgentPacketPreset = (typeof agentPacketPresets)[number];
export type AgentPacketOptions = {
    preset?: AgentPacketPreset;
    maxTokens?: number;
    includeUnresolved?: boolean;
};
export declare function searchPrd(query: string, indexResult: PrdIndexResult, sections?: string[], limit?: number): SearchResult[];
export declare function getEntityResult(id: string, load: PrdLoadResult, indexResult: PrdIndexResult): {
    entity: IndexedEntity;
    raw: unknown;
    outbound_links: import("./prd-index.js").IndexedLink[];
    inbound_links: import("./prd-index.js").IndexedLink[];
} | null;
export declare function getLinkedEntitiesResult(id: string, load: PrdLoadResult, indexResult: PrdIndexResult): {
    entity: IndexedEntity;
    outbound_links: import("./prd-index.js").IndexedLink[];
    inbound_links: import("./prd-index.js").IndexedLink[];
    linked_entities: {
        entity: IndexedEntity;
        raw: unknown;
        outbound_links: import("./prd-index.js").IndexedLink[];
        inbound_links: import("./prd-index.js").IndexedLink[];
    }[];
} | null;
export declare function listBlockersResult(load: PrdLoadResult, indexResult: PrdIndexResult): {
    count: number;
    blockers: any[];
};
export declare function listOpenQuestionsResult(load: PrdLoadResult): {
    count: number;
    open_questions: unknown[];
};
export declare function listProposedDecisionsResult(load: PrdLoadResult): {
    count: number;
    proposed_decisions: unknown[];
};
export declare function buildAgentPacketResult(load: PrdLoadResult, indexResult: PrdIndexResult, ids?: string[], sections?: string[], goal?: string | null, options?: AgentPacketOptions): AgentPacket;
