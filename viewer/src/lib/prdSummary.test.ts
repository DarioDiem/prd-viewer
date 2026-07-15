import { describe, expect, it } from "vitest";
import seedPrd from "../../PRD_web_ui.json";
import { buildPrdSummary } from "./prdSummary";
import type { PrdDocument } from "../types/prd";

describe("buildPrdSummary", () => {
  it("derives dashboard counts from the canonical PRD document", () => {
    const summary = buildPrdSummary(seedPrd as PrdDocument);

    expect(summary.title).toBe("PRD Reviewer Local/Web UI");
    expect(summary.metrics.functionalRequirements).toBe(seedPrd.requirements.functional.length);
    expect(summary.metrics.userStories).toBe(seedPrd.user_stories.length);
    expect(summary.metrics.projectTrackingPendingWork).toBe(seedPrd.project_tracking.pending_work.length);
    expect(summary.metrics.projectTrackingBlockers).toBeGreaterThan(0);
    expect(summary.metrics.openQuestions).toBeGreaterThan(0);
    expect(summary.sections).toHaveLength(13);
  });

  it("flags unresolved content blockers without duplicating schema validation state", () => {
    const summary = buildPrdSummary(seedPrd as PrdDocument);

    expect(summary.blockers).toEqual(
      expect.arrayContaining([
        expect.stringContaining("active project blockers"),
        expect.stringContaining("open questions"),
        expect.stringContaining("decisions are still proposed")
      ])
    );
    expect(summary.blockers).not.toContain("Strict schema validation has not run in the UI yet.");
  });
});
