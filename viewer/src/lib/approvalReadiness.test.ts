import { describe, expect, it } from "vitest";
import seedPrd from "../../PRD_web_ui.json";
import { buildApprovalReadiness } from "./approvalReadiness";
import { checkSchemaCompatibility } from "./schemaCompatibility";
import { validatePrdDocument } from "./schemaValidation";
import { buildTraceability } from "./traceability";
import type { PrdDocument, Requirement } from "../types/prd";

describe("buildApprovalReadiness", () => {
  it("returns categorized approval blockers with source IDs and JSON paths", () => {
    const prd = seedPrd as PrdDocument;
    const readiness = buildApprovalReadiness({
      prd,
      validation: validatePrdDocument(prd, "2026-04-21T05:00:00Z"),
      compatibility: checkSchemaCompatibility(prd),
      traceability: buildTraceability(prd)
    });

    expect(readiness.status).toBe("blocked");
    expect(readiness.checkedAt).toBe("2026-04-21T05:00:00Z");
    expect(readiness.blockerCount).toBeGreaterThan(0);
    expect(readiness.signals).toContainEqual(
      expect.objectContaining({
        category: "project_tracking",
        severity: "blocker",
        sourceSection: "project_tracking",
        sourceId: "PTB-002",
        jsonPath: "$[\"project_tracking\"][\"blockers\"][1]"
      })
    );
    expect(readiness.signals).toContainEqual(
      expect.objectContaining({
        category: "open_questions",
        severity: "blocker",
        sourceSection: "open_questions",
        sourceId: "Q-001",
        jsonPath: "$[\"open_questions\"][0]"
      })
    );
    expect(readiness.signals).toContainEqual(
      expect.objectContaining({
        category: "decisions",
        severity: "blocker",
        sourceSection: "decisions"
      })
    );
    expect(readiness.signals).toContainEqual(
      expect.objectContaining({
        category: "risks",
        severity: "blocker",
        sourceSection: "risks"
      })
    );
  });

  it("flags missing story coverage for must-have requirements", () => {
    const prd = structuredClone(seedPrd) as PrdDocument;
    const newRequirementIndex = prd.requirements.functional.length;
    const uncoveredRequirement: Requirement = {
      ...prd.requirements.functional[0],
      req_id: "FR-999",
      title: "Uncovered must-have requirement",
      dependencies: [],
      priority: "must"
    };

    prd.requirements.functional.push(uncoveredRequirement);

    const readiness = buildApprovalReadiness({
      prd,
      validation: validatePrdDocument(prd),
      compatibility: checkSchemaCompatibility(prd),
      traceability: buildTraceability(prd)
    });

    expect(readiness.signals).toContainEqual(
      expect.objectContaining({
        id: "coverage:FR-999",
        category: "coverage",
        severity: "blocker",
        sourceId: "FR-999",
        jsonPath: `$["requirements"]["functional"][${newRequirementIndex}]`
      })
    );
  });

  it("keeps compatibility warnings separate from approval blockers", () => {
    const prd = structuredClone(seedPrd) as PrdDocument;

    prd.meta.schema_contract = null;

    const readiness = buildApprovalReadiness({
      prd,
      validation: validatePrdDocument(prd),
      compatibility: checkSchemaCompatibility(prd),
      traceability: buildTraceability(prd)
    });

    expect(readiness.signals).toContainEqual(
      expect.objectContaining({
        category: "schema_compatibility",
        severity: "warning",
        sourceSection: "compatibility"
      })
    );
  });
});
