import type { Resource } from "@modelcontextprotocol/sdk/types.js";
import type { IndexedLink, IndexedSectionKey, PrdIndexResult } from "./prd-index.js";
import type { PrdLoadResult } from "./prd-loader.js";
export declare function listSectionResourceDefinitions(indexResult: PrdIndexResult): Resource[];
export declare function listEntityResourceDefinitions(indexResult: PrdIndexResult): Resource[];
export declare function listTraceResourceDefinitions(indexResult: PrdIndexResult): Resource[];
export declare function buildSummaryPayload(load: PrdLoadResult, indexResult: PrdIndexResult): {
    status: import("./prd-loader.js").PrdLoadStatus;
    summary: import("./prd-loader.js").PrdSummary | null;
    load: import("./prd-loader.js").PrdLoadSnapshot;
    index: import("./prd-index.js").PrdIndexSnapshot;
    counts: {
        sections: number;
        entities: number;
        links: number;
        broken_links: number;
    };
};
export declare function buildCompatibilityPayload(load: PrdLoadResult): {
    status: string;
    compatibility: import("./compatibility.js").SchemaCompatibilityResult | null;
    load: import("./prd-loader.js").PrdLoadSnapshot;
};
export declare function buildProjectTrackingPayload(load: PrdLoadResult, indexResult: PrdIndexResult): {
    status: string;
    summary: {
        status: string | null;
        owner: string | null;
        updated_at: string | null;
    };
    counts: {
        pending_work: number;
        issues_found: number;
        blockers: number;
        notes: number;
    };
    project_tracking: Record<string, unknown> | null;
    related_index_sections: {
        key: IndexedSectionKey;
        count: number;
    }[];
};
export declare function buildReadinessPayload(load: PrdLoadResult, indexResult: PrdIndexResult): {
    status: string;
    checked_at: string;
    blocker_count: number;
    warning_count: number;
    blockers: string[];
    warnings: string[];
};
export declare function buildSectionPayload(name: string, load: PrdLoadResult, indexResult: PrdIndexResult): {
    status: string;
    section: string;
    count: number;
    entity_ids: string[];
    data: {} | null;
    load: import("./prd-loader.js").PrdLoadSnapshot | undefined;
} | null;
export declare function buildEntityPayload(id: string, load: PrdLoadResult, indexResult: PrdIndexResult): {
    entity: import("./prd-index.js").IndexedEntity;
    raw: unknown;
    outbound_links: IndexedLink[];
    inbound_links: IndexedLink[];
} | null;
export declare function buildTracePayload(id: string, indexResult: PrdIndexResult): {
    selected_entity: import("./prd-index.js").IndexedEntity;
    nodes: (import("./prd-index.js").IndexedEntity | {
        id: string;
        kind: string;
        section: string;
        label: string;
        status: string;
        sourcePath: string;
    })[];
    links: IndexedLink[];
    inbound_count: number;
    outbound_count: number;
    broken_links: IndexedLink[];
} | null;
export declare function listAvailableSectionNames(): string[];
export declare function resolveSectionValue(document: unknown, name: string): unknown;
export declare function resolveJsonPath(document: unknown, path: string): unknown;
