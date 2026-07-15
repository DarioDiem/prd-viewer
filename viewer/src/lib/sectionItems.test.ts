import { describe, expect, it } from "vitest";
import seedPrd from "../../PRD_web_ui.json";
import { buildSectionItems } from "./sectionItems";
import type { PrdDocument } from "../types/prd";

describe("buildSectionItems", () => {
  it("normalizes requirements into reviewable section rows", () => {
    const items = buildSectionItems(seedPrd as PrdDocument, "requirements");

    expect(items[0]).toEqual(
      expect.objectContaining({
        id: "FR-001",
        title: "Open canonical PRD in browser"
      })
    );
    expect(items).toHaveLength(
      seedPrd.requirements.functional.length + seedPrd.requirements.non_functional.length
    );
  });

  it("normalizes open questions with IDs and status metadata", () => {
    const items = buildSectionItems(seedPrd as PrdDocument, "open_questions");

    expect(items[0]).toEqual(
      expect.objectContaining({
        id: "Q-001",
        title: "What is the target launch date and pilot cohort for the first reviewer release?",
        meta: "open"
      })
    );
  });

  it("normalizes project tracking with overview and stable item IDs", () => {
    const items = buildSectionItems(seedPrd as PrdDocument, "project_tracking");

    expect(items[0]).toEqual(
      expect.objectContaining({
        id: "project_tracking",
        title: "Overall status: in progress"
      })
    );
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "PTW-001",
          title: "Implement viewer project-tracking surface"
        }),
        expect.objectContaining({
          id: "PTB-001",
          title: "Viewer implementation needed structured project_tracking editing"
        })
      ])
    );
  });
});
