import type { PrdCacheState, PrdLoadResult, PrdLoader } from "./prd-loader.js";
export type IndexedSectionKey = "meta" | "problem" | "goals" | "assumptions" | "personas" | "requirements.functional" | "requirements.non_functional" | "user_stories" | "constraints.technical" | "constraints.dependencies" | "delivery.milestones" | "delivery.operational_readiness" | "project_tracking.pending_work" | "project_tracking.issues_found" | "project_tracking.blockers" | "project_tracking.notes" | "risks" | "open_questions" | "decisions" | "extensions.registry";
export type IndexEntityKind = "prd" | "assumption" | "persona" | "functional_requirement" | "non_functional_requirement" | "story" | "technical_constraint" | "dependency" | "risk" | "question" | "decision" | "work_item" | "issue" | "blocker" | "note" | "extension";
export type IndexLinkKind = "story_requirement" | "story_persona" | "decision_requirement" | "requirement_persona" | "requirement_dependency" | "requirement_requirement" | "project_tracking_link";
export type IndexedSection = {
    key: IndexedSectionKey;
    count: number;
    entityIds: string[];
};
export type IndexedEntity = {
    id: string;
    kind: IndexEntityKind;
    section: IndexedSectionKey | "meta";
    label: string;
    status: string | null;
    sourcePath: string;
};
export type IndexedLink = {
    id: string;
    source: string;
    target: string;
    kind: IndexLinkKind;
    label: string;
    valid: boolean;
};
export type PrdIndex = {
    sections: IndexedSection[];
    entities: IndexedEntity[];
    entityById: Map<string, IndexedEntity>;
    links: IndexedLink[];
    outboundById: Map<string, IndexedLink[]>;
    inboundById: Map<string, IndexedLink[]>;
    brokenLinks: IndexedLink[];
};
export type PrdIndexSnapshot = {
    status: "ready" | "blocked";
    cacheState: PrdCacheState;
    builtAt: string;
    sourceSha256: string | null;
    sectionCount: number;
    entityCount: number;
    linkCount: number;
    brokenLinkCount: number;
    sections: Array<{
        key: IndexedSectionKey;
        count: number;
    }>;
};
export type PrdIndexResult = {
    snapshot: PrdIndexSnapshot;
    index: PrdIndex | null;
    load: PrdLoadResult;
};
export declare class PrdIndexStore {
    private readonly loader;
    private cachedIndex;
    constructor(loader: PrdLoader);
    load(): Promise<PrdIndexResult>;
}
export declare function buildPrdIndex(document: unknown): PrdIndex;
