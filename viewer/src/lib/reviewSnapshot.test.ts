import { describe, expect, it } from "vitest";
import seedPrd from "../../PRD_web_ui.json";
import { buildApprovalReadiness } from "./approvalReadiness";
import { checkSchemaCompatibility } from "./schemaCompatibility";
import { validatePrdDocument } from "./schemaValidation";
import { buildTraceability } from "./traceability";
import { buildReviewSnapshot, buildReviewSnapshotFilename } from "./reviewSnapshot";
import type { PrdDocument } from "../types/prd";

describe("reviewSnapshot", () => {
  it("builds a read-only review snapshot from derived viewer state", () => {
    const prd = seedPrd as PrdDocument;
    const validation = validatePrdDocument(prd, "2026-04-21T05:00:00Z");
    const compatibility = checkSchemaCompatibility(prd);
    const traceability = buildTraceability(prd);
    const readiness = buildApprovalReadiness({
      prd,
      validation,
      compatibility,
      traceability
    });
    const snapshot = buildReviewSnapshot({
      prd,
      sourceLabel: "viewer/PRD_web_ui.json",
      exportedAt: "2026-04-21T05:01:00Z",
      validation,
      compatibility,
      readinessSignals: readiness.signals,
      traceability
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        schema: "prd.review-snapshot.v2",
        exported_at: "2026-04-21T05:01:00Z",
        source: expect.objectContaining({
          label: "viewer/PRD_web_ui.json",
          title: "PRD Reviewer Local/Web UI",
          schema_version: "1.2.0"
        }),
        validation: expect.objectContaining({
          status: "valid",
          issue_count: 0
        }),
        readiness: expect.objectContaining({
          status: "blocked",
          signal_count: readiness.signals.length,
          blocker_count: readiness.blockerCount
        })
      })
    );
    expect(snapshot.readiness.signals).toContainEqual(
      expect.objectContaining({
        category: "project_tracking",
        severity: "blocker",
        sourceId: "PTB-002"
      })
    );
    expect(snapshot.readiness.signals).toContainEqual(
      expect.objectContaining({
        category: "open_questions",
        severity: "blocker",
        sourceId: "Q-001"
      })
    );
    expect(snapshot.counts.functional_requirements).toBe(seedPrd.requirements.functional.length);
    expect(snapshot.counts.project_tracking_pending_work).toBe(seedPrd.project_tracking.pending_work.length);
    expect(snapshot.project_tracking.status).toBe(seedPrd.project_tracking.status);
    expect(snapshot.project_tracking.active_blocker_count).toBeGreaterThan(0);
    expect(snapshot.traceability.counts.requirements).toBeGreaterThan(0);
  });

  it("builds stable snapshot filenames from PRD product names", () => {
    expect(buildReviewSnapshotFilename(seedPrd as PrdDocument, "2026-04-21T05:01:00Z")).toBe(
      "prd-review-snapshot-prd-viewer-2026-04-21.json"
    );
  });
});
