import type { ApprovalReadinessSignal } from "./approvalReadiness";
import type { SchemaCompatibilityResult } from "./schemaCompatibility";
import type { ValidationResult } from "./schemaValidation";
import type { Traceability } from "./traceability";
import type { PrdDocument } from "../types/prd";

export type ReviewSnapshotInput = {
  prd: PrdDocument;
  sourceLabel: string;
  exportedAt: string;
  validation: ValidationResult;
  compatibility: SchemaCompatibilityResult;
  readinessSignals: ApprovalReadinessSignal[];
  traceability: Traceability;
};

export function buildReviewSnapshot({
  prd,
  sourceLabel,
  exportedAt,
  validation,
  compatibility,
  readinessSignals,
  traceability
}: ReviewSnapshotInput) {
  return {
    schema: "pacs.review-snapshot.v2",
    exported_at: exportedAt,
    source: {
      label: sourceLabel,
      prd_id: prd.meta.prd_id ?? null,
      title: prd.meta.title,
      product_name: prd.meta.product_name,
      document_version: prd.meta.version,
      schema_version: prd.meta.schema_contract?.schema_version ?? null
    },
    validation: {
      status: validation.status,
      checked_at: validation.checkedAt,
      issue_count: validation.issues.length,
      issues: validation.issues
    },
    compatibility: {
      status: compatibility.status,
      current_schema_version: compatibility.currentSchemaVersion,
      declared_schema_version: compatibility.declaredSchemaVersion,
      migration_required: compatibility.migrationRequired,
      required_extensions: compatibility.requiredExtensions.map((extension) => extension.extension_id),
      warnings: compatibility.warnings
    },
    readiness: {
      status: readinessSignals.some((signal) => signal.severity === "blocker")
        ? "blocked"
        : readinessSignals.length > 0
          ? "warnings"
          : "clear",
      signal_count: readinessSignals.length,
      blocker_count: readinessSignals.filter((signal) => signal.severity === "blocker").length,
      warning_count: readinessSignals.filter((signal) => signal.severity === "warning").length,
      signals: readinessSignals
    },
    counts: {
      functional_requirements: prd.requirements.functional.length,
      non_functional_requirements: prd.requirements.non_functional.length,
      user_stories: prd.user_stories.length,
      project_tracking_pending_work: prd.project_tracking.pending_work.length,
      project_tracking_issues: prd.project_tracking.issues_found.length,
      project_tracking_blockers: prd.project_tracking.blockers.filter((blocker) => blocker.status === "active").length,
      open_questions: prd.open_questions.filter((question) => question.status !== "resolved").length,
      proposed_decisions: prd.decisions.filter((decision) => decision.status === "proposed").length,
      high_score_risks: prd.risks.filter((risk) => risk.score >= 6).length
    },
    project_tracking: {
      status: prd.project_tracking.status,
      owner: prd.project_tracking.owner,
      summary: prd.project_tracking.summary,
      updated_at: prd.project_tracking.updated_at,
      pending_work_count: prd.project_tracking.pending_work.length,
      issue_count: prd.project_tracking.issues_found.length,
      active_blocker_count: prd.project_tracking.blockers.filter((blocker) => blocker.status === "active").length,
      note_count: prd.project_tracking.notes.length
    },
    traceability: {
      counts: traceability.counts,
      issues: traceability.issues
    }
  };
}

export function buildReviewSnapshotFilename(prd: PrdDocument, exportedAt: string): string {
  const date = exportedAt.slice(0, 10);
  const slug = slugify(prd.meta.product_name || prd.meta.title || "prd");

  return `prd-review-snapshot-${slug}-${date}.json`;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug || "prd";
}
