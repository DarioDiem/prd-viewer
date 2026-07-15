import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { PrdMcpConfig } from "./config.js";
import {
  checkSchemaCompatibility,
  isLossyCompatibilityStatus,
  type SchemaCompatibilityResult
} from "./compatibility.js";
import {
  createValidationFailureResult,
  validatePrdDocument,
  type ValidationResult
} from "./validation.js";

export type PrdCacheState = "cold" | "hit" | "reloaded";
export type PrdLoadStatus = "valid" | "blocked";
export type PrdFailureReason =
  | "missing_file"
  | "parse_error"
  | "schema_invalid"
  | "legacy_unversioned"
  | "unknown_schema_version"
  | "migration_required"
  | "required_extension";

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

type CachedLoad = {
  size: number;
  mtimeMs: number;
  result: PrdLoadResult;
};

export class PrdLoader {
  private cachedLoad: CachedLoad | null = null;

  constructor(private readonly config: PrdMcpConfig) {}

  async load(): Promise<PrdLoadResult> {
    const checkedAt = new Date().toISOString();
    const stats = await this.safeStat();

    if (stats === null) {
      return {
        document: null,
        snapshot: {
          artifactPath: this.config.prdPath,
          artifactName: path.basename(this.config.prdPath),
          status: "blocked",
          cacheState: this.cachedLoad === null ? "cold" : "reloaded",
          checkedAt,
          loadedAt: null,
          file: {
            exists: false,
            size: null,
            mtimeMs: null,
            sha256: null
          },
          summary: null,
          validation: createValidationFailureResult(
            `PRD file not found at ${this.config.prdPath}.`,
            checkedAt,
            "$",
            "missing_file"
          ),
          compatibility: null,
          failureReasons: ["missing_file"]
        }
      };
    }

    if (
      this.cachedLoad &&
      this.cachedLoad.size === stats.size &&
      this.cachedLoad.mtimeMs === stats.mtimeMs
    ) {
      return {
        document: this.cachedLoad.result.document,
        snapshot: {
          ...this.cachedLoad.result.snapshot,
          checkedAt,
          cacheState: "hit"
        }
      };
    }

    const cacheState: PrdCacheState = this.cachedLoad === null ? "cold" : "reloaded";
    const rawText = await fs.readFile(this.config.prdPath, "utf8");
    const sha256 = createHash("sha256").update(rawText).digest("hex");
    const loadedAt = checkedAt;
    let document: unknown;

    try {
      document = JSON.parse(rawText);
    } catch (error) {
      const result: PrdLoadResult = {
        document: null,
        snapshot: {
          artifactPath: this.config.prdPath,
          artifactName: path.basename(this.config.prdPath),
          status: "blocked",
          cacheState,
          checkedAt,
          loadedAt,
          file: {
            exists: true,
            size: stats.size,
            mtimeMs: stats.mtimeMs,
            sha256
          },
          summary: null,
          validation: createValidationFailureResult(
            error instanceof Error ? error.message : "Failed to parse PRD JSON.",
            checkedAt
          ),
          compatibility: null,
          failureReasons: ["parse_error"]
        }
      };

      this.cachedLoad = {
        size: stats.size,
        mtimeMs: stats.mtimeMs,
        result
      };

      return result;
    }

    const [validation, compatibility] = await Promise.all([
      validatePrdDocument(document, this.config.repoRoot, checkedAt),
      checkSchemaCompatibility(document, this.config.repoRoot)
    ]);
    const failureReasons = collectFailureReasons(validation, compatibility);
    const result: PrdLoadResult = {
      document: failureReasons.length === 0 ? document : null,
      snapshot: {
        artifactPath: this.config.prdPath,
        artifactName: path.basename(this.config.prdPath),
        status: failureReasons.length === 0 ? "valid" : "blocked",
        cacheState,
        checkedAt,
        loadedAt,
        file: {
          exists: true,
          size: stats.size,
          mtimeMs: stats.mtimeMs,
          sha256
        },
        summary: buildPrdSummary(document),
        validation,
        compatibility,
        failureReasons
      }
    };

    this.cachedLoad = {
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      result
    };

    return result;
  }

  private async safeStat(): Promise<{ size: number; mtimeMs: number } | null> {
    try {
      const stats = await fs.stat(this.config.prdPath);
      return {
        size: stats.size,
        mtimeMs: stats.mtimeMs
      };
    } catch {
      return null;
    }
  }
}

function collectFailureReasons(
  validation: ValidationResult,
  compatibility: SchemaCompatibilityResult
): PrdFailureReason[] {
  const reasons: PrdFailureReason[] = [];

  if (validation.status === "invalid") {
    reasons.push("schema_invalid");
  }

  if (compatibility.requiredExtensions.length > 0) {
    reasons.push("required_extension");
  }

  if (isLossyCompatibilityStatus(compatibility.status)) {
    if (compatibility.status === "legacy_unversioned") {
      reasons.push("legacy_unversioned");
    } else if (compatibility.status === "migration_required") {
      reasons.push("migration_required");
    } else if (compatibility.status === "unknown") {
      reasons.push("unknown_schema_version");
    }
  }

  return reasons;
}

function buildPrdSummary(document: unknown): PrdSummary | null {
  const prd = asRecord(document);
  const meta = asRecord(prd?.meta);

  if (!meta) {
    return null;
  }

  const contract = asRecord(meta.schema_contract);

  return {
    prdId: readOptionalString(meta.prd_id),
    title: readOptionalString(meta.title),
    documentVersion: readOptionalString(meta.version),
    schemaVersion: readOptionalString(contract?.schema_version),
    updatedAt: readOptionalString(meta.updated_at)
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
