import { describe, expect, it } from "vitest";
import seedPrd from "../../PRD_web_ui.json";
import { buildChangePreview } from "./changePreview";
import type { PrdDocument } from "../types/prd";

describe("buildChangePreview", () => {
  it("summarizes changed section fields with stable PRD IDs", () => {
    const before = seedPrd as PrdDocument;
    const after = structuredClone(before);

    after.requirements.functional[0].title = "Open canonical PRD with previewed writeback";

    expect(buildChangePreview(before, after)).toEqual([
      {
        section: "requirements",
        added: 0,
        removed: 0,
        changed: 1,
        samplePaths: ["requirements.functional[FR-001].title"]
      }
    ]);
  });

  it("reports added and removed ID-backed rows without noisy index shifts", () => {
    const before = seedPrd as PrdDocument;
    const after = structuredClone(before);

    after.open_questions = after.open_questions.slice(1);
    after.open_questions.push({
      ...after.open_questions[0],
      question_id: "Q-999",
      question: "Should this item appear in the writeback preview?"
    });

    expect(buildChangePreview(before, after)).toEqual([
      {
        section: "open_questions",
        added: 1,
        removed: 1,
        changed: 0,
        samplePaths: ["open_questions[Q-001]", "open_questions[Q-999]"]
      }
    ]);
  });

  it("tracks project-tracking row changes with stable IDs", () => {
    const before = seedPrd as PrdDocument;
    const after = structuredClone(before);

    after.project_tracking.pending_work[0].title = "Implemented viewer project-tracking surface";

    expect(buildChangePreview(before, after)).toEqual([
      {
        section: "project_tracking",
        added: 0,
        removed: 0,
        changed: 1,
        samplePaths: ["project_tracking.pending_work[PTW-001].title"]
      }
    ]);
  });
});
