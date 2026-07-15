import type { PrdMcpConfig } from "./config.js";
import { type SchemaCompatibilityResult } from "./compatibility.js";
import { type ValidationResult } from "./validation.js";
export type PrdCacheState = "cold" | "hit" | "reloaded";
export type PrdLoadStatus = "valid" | "blocked";
export type PrdFailureReason = "missing_file" | "parse_error" | "schema_invalid" | "legacy_unversioned" | "unknown_schema_version" | "migration_required" | "required_extension";
export type PrdSummary = {
    prdId: string | null;
    title: string | null;
    documentVersion: string | null;
    schemaVersion: string | null;
    updatedAt: string | null;
};
export type PrdFileSnapshot = {
    exists: boolean;
    size: number | null;
    mtimeMs: number | null;
    sha256: string | null;
};
export type PrdLoadSnapshot = {
    artifactPath: string;
    artifactName: string;
    status: PrdLoadStatus;
    cacheState: PrdCacheState;
    checkedAt: string;
    loadedAt: string | null;
    file: PrdFileSnapshot;
    summary: PrdSummary | null;
    validation: ValidationResult;
    compatibility: SchemaCompatibilityResult | null;
    failureReasons: PrdFailureReason[];
};
export type PrdLoadResult = {
    snapshot: PrdLoadSnapshot;
    document: unknown | null;
};
export declare class PrdLoader {
    private readonly config;
    private cachedLoad;
    constructor(config: PrdMcpConfig);
    load(): Promise<PrdLoadResult>;
    private safeStat;
}
