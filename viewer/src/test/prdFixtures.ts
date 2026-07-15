import seedPrd from "../../PRD_web_ui.json" with { type: "json" };
import type { ExtensionDescriptor, PrdDocument } from "../types/prd";

export const malformedPrdJsonFixture = "{";

export function validPrdFixture(): PrdDocument {
  return structuredClone(seedPrd) as PrdDocument;
}

export function schemaInvalidPrdFixture(): PrdDocument {
  const prd = validPrdFixture();

  prd.meta.title = "";

  return prd;
}

export function unsupportedSchemaVersionPrdFixture(): PrdDocument {
  const prd = validPrdFixture();

  prd.meta.schema_contract = {
    ...prd.meta.schema_contract,
    schema_version: "9.9.9",
    compatibility_mode: "unknown"
  };

  return prd;
}

export function backwardCompatiblePrdFixture(): PrdDocument {
  const prd = validPrdFixture();

  prd.meta.schema_contract = {
    ...prd.meta.schema_contract,
    schema_id: "https://example.com/prd.schema.strict.v1.0.0.json",
    schema_version: "1.0.0",
    compatible_schema_versions: ["1.0.0"],
    compatibility_mode: "backward_compatible",
    migrations: [
      {
        from_version: "1.0.0",
        to_version: "1.2.0",
        status: "available",
        migration_path: "Add optional top-level project_tracking.",
        backward_compatible: true,
        notes: "Schema 1.0.0 remains valid under 1.2.0."
      }
    ]
  };
  const { project_tracking: _projectTracking, ...legacyPrd } = prd;

  return legacyPrd as PrdDocument;
}

export function requiredExtensionPrdFixture(): PrdDocument {
  const prd = validPrdFixture();
  const extension = requiredExtensionDescriptorFixture();

  prd.meta.schema_contract = {
    ...prd.meta.schema_contract,
    extension_policy: "registered_extensions",
    extensions: [extension]
  };
  prd.extensions = {
    registry: [extension],
    data: {
      [extension.extension_id]: {
        enabled: true
      }
    }
  };

  return prd;
}

export function brokenTraceLinksPrdFixture(): PrdDocument {
  const prd = validPrdFixture();

  prd.user_stories[0].linked_req_ids = ["FR-999"];

  return prd;
}

export function largePrdFixture(): PrdDocument {
  const prd = validPrdFixture();
  const personaIds = prd.personas.map((persona) => persona.persona_id);
  const dependencyIds = prd.constraints.dependencies.map((dependency) => dependency.dependency_id);
  const categories = ["performance", "security", "scalability", "accessibility", "reliability", "compliance", "usability", "observability", "privacy"];
  const priorities = ["must", "should", "could"] as const;
  const riskCategories = ["technical", "market", "legal", "resource", "schedule", "operational"];
  const riskLevels = ["low", "medium", "high"] as const;

  prd.meta.title = "Large PRD Fixture";
  prd.meta.summary = "Representative large PRD used for viewer performance and accessibility smoke coverage.";
  prd.meta.updated_at = "2026-04-22T12:00:00Z";
  prd.requirements.functional = Array.from({ length: 120 }, (_item, index) => {
    const itemNumber = index + 1;

    return {
      req_id: formatFixtureId("FR", itemNumber),
      title: `Large fixture workflow requirement ${itemNumber}`,
      description: `Reviewer workflow ${itemNumber} must remain scannable, traceable, and editable in the local-first PRD viewer.`,
      rationale: itemNumber % 3 === 0 ? null : `Supports large-document review path ${itemNumber}.`,
      priority: priorities[index % priorities.length],
      persona_ids: [personaIds[index % personaIds.length]],
      dependencies: index > 0 && index % 7 === 0
        ? [formatFixtureId("FR", itemNumber - 1)]
        : dependencyIds.length > 0 && index % 9 === 0
          ? [dependencyIds[index % dependencyIds.length]]
          : [],
      acceptance_criteria: [
        `Requirement ${itemNumber} appears in section, trace, and export views.`,
        `Requirement ${itemNumber} can be reviewed without raw JSON editing.`
      ],
      status: index % 11 === 0 ? "proposed" : "approved",
      release_phase: index % 5 === 0 ? "ga" : "mvp"
    };
  });
  prd.requirements.non_functional = Array.from({ length: 36 }, (_item, index) => ({
    req_id: formatFixtureId("NFR", index + 1),
    category: categories[index % categories.length],
    description: `Large fixture non-functional requirement ${index + 1} keeps the viewer usable with dense PRDs.`,
    target: `Smoke threshold target ${index + 1}`,
    priority: priorities[index % priorities.length],
    acceptance_criteria: [`NFR ${index + 1} remains visible in validation and traceability views.`]
  }));
  prd.user_stories = Array.from({ length: 180 }, (_item, index) => {
    const storyNumber = index + 1;
    const requirementNumber = (index % prd.requirements.functional.length) + 1;

    return {
      story_id: formatFixtureId("US", storyNumber),
      epic: `Large fixture epic ${Math.floor(index / 12) + 1}`,
      persona_id: personaIds[index % personaIds.length],
      priority: priorities[index % priorities.length],
      release_phase: index % 6 === 0 ? "ga" : "mvp",
      statement: {
        as_a: "PRD reviewer",
        i_want: `to inspect large fixture story ${storyNumber}`,
        so_that: "I can verify the viewer remains responsive and accessible"
      },
      acceptance_criteria: [
        {
          given: `large fixture story ${storyNumber} is loaded`,
          when: "the reviewer navigates sections",
          then: "the related requirements and trace links remain available"
        }
      ],
      linked_req_ids: [formatFixtureId("FR", requirementNumber)],
      story_points: (index % 8) + 1,
      edge_cases: index % 4 === 0 ? [`Large fixture edge case ${storyNumber}`] : []
    };
  });
  prd.risks = Array.from({ length: 48 }, (_item, index) => ({
    risk_id: formatFixtureId("R", index + 1),
    description: `Large fixture risk ${index + 1} could slow review or obscure validation state.`,
    category: riskCategories[index % riskCategories.length],
    probability: riskLevels[index % riskLevels.length],
    impact: riskLevels[(index + 1) % riskLevels.length],
    score: (index % 9) + 1,
    mitigation: `Track performance and accessibility signal ${index + 1}.`,
    owner: index % 5 === 0 ? null : "Engineering",
    trigger: index % 6 === 0 ? null : `Smoke threshold ${index + 1} regresses.`
  }));
  prd.open_questions = Array.from({ length: 52 }, (_item, index) => ({
    question_id: formatFixtureId("Q", index + 1),
    question: `Large fixture question ${index + 1}: does this review path remain understandable?`,
    raised_by: index % 3 === 0 ? "Design" : "Engineering",
    raised_at: `2026-04-${String((index % 20) + 1).padStart(2, "0")}T12:00:00Z`,
    status: index % 4 === 0 ? "resolved" : index % 5 === 0 ? "deferred" : "open",
    resolution: index % 4 === 0 ? `Resolved fixture question ${index + 1}.` : null
  }));
  prd.decisions = Array.from({ length: 44 }, (_item, index) => ({
    decision_id: formatFixtureId("DEC", index + 1),
    title: `Large fixture decision ${index + 1}`,
    statement: `Decision ${index + 1} records how large PRD review should behave.`,
    rationale: index % 3 === 0 ? null : `Keeps large fixture decision ${index + 1} traceable.`,
    owner: index % 4 === 0 ? null : "Product",
    decided_at: index % 3 === 0 ? null : `2026-04-${String((index % 20) + 1).padStart(2, "0")}T12:00:00Z`,
    status: index % 7 === 0 ? "proposed" : "accepted",
    linked_req_ids: [formatFixtureId("FR", (index % prd.requirements.functional.length) + 1)]
  }));
  prd.delivery.operational_readiness = Array.from({ length: 36 }, (_item, index) => ({
    area: `Large readiness area ${index + 1}`,
    owner: index % 4 === 0 ? null : "Engineering",
    status: index % 6 === 0 ? "blocked" : index % 3 === 0 ? "in_progress" : "ready",
    notes: index % 5 === 0 ? null : `Readiness note ${index + 1} for large PRD smoke coverage.`
  }));

  return prd;
}

export function serializePrdFixture(prd: PrdDocument): string {
  return `${JSON.stringify(prd, null, 2)}\n`;
}

function formatFixtureId(prefix: string, value: number): string {
  return `${prefix}-${String(value).padStart(3, "0")}`;
}

function requiredExtensionDescriptorFixture(): ExtensionDescriptor {
  return {
    extension_id: "fixture.required",
    name: "Fixture required extension",
    version: "1.0.0",
    required: true,
    compatibility: "requires_viewer_support",
    owner: "Engineering",
    schema_ref: null,
    description: "Fixture extension used to verify fail-closed writeback behavior."
  };
}
