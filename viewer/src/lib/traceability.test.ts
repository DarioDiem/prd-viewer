import { describe, expect, it } from "vitest";
import { brokenTraceLinksPrdFixture, validPrdFixture } from "../test/prdFixtures";
import { buildAgentTraceBundle, buildFocusedTraceGraph, buildTraceability } from "./traceability";

describe("buildTraceability", () => {
  it("derives requirement matrix rows from PRD link fields", () => {
    const prd = validPrdFixture();
    const traceability = buildTraceability(prd);
    const fr005 = traceability.matrixRows.find((row) => row.requirementId === "FR-005");

    expect(traceability.counts.requirements).toBe(
      prd.requirements.functional.length + prd.requirements.non_functional.length
    );
    expect(traceability.counts.brokenReferences).toBe(0);
    expect(fr005).toEqual(
      expect.objectContaining({
        requirementId: "FR-005",
        stories: expect.arrayContaining(["US-003", "US-007"]),
        decisions: ["DEC-007"],
        dependencies: ["D-002"],
        personas: ["P-002", "P-003", "P-004"],
        prerequisites: ["FR-001", "FR-003"]
      })
    );
  });

  it("classifies mixed requirement dependencies as dependency and requirement edges", () => {
    const traceability = buildTraceability(validPrdFixture());

    expect(traceability.edges).toContainEqual(
      expect.objectContaining({
        source: "FR-005",
        target: "D-002",
        kind: "requirement_dependency",
        valid: true
      })
    );
    expect(traceability.edges).toContainEqual(
      expect.objectContaining({
        source: "FR-005",
        target: "FR-001",
        kind: "requirement_requirement",
        valid: true
      })
    );
  });

  it("flags missing references that pass schema patterns", () => {
    const traceability = buildTraceability(brokenTraceLinksPrdFixture());

    expect(traceability.counts.brokenReferences).toBe(1);
    expect(traceability.issues[0]).toEqual(
      expect.objectContaining({
        source: "US-001",
        target: "FR-999",
        message: "US-001 references missing requirement FR-999."
      })
    );
  });

  it("builds a focused graph around a selected requirement", () => {
    const traceability = buildTraceability(validPrdFixture());
    const graph = buildFocusedTraceGraph(traceability, "FR-005");

    expect(graph.selectedNode?.id).toBe("FR-005");
    expect(graph.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["FR-005", "US-003", "DEC-007", "D-002", "P-002", "P-003", "P-004"])
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: "US-003",
        target: "FR-005",
        kind: "story_requirement"
      })
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: "FR-005",
        target: "D-002",
        kind: "requirement_dependency"
      })
    );
  });

  it("keeps unresolved targets visible in the focused graph", () => {
    const traceability = buildTraceability(brokenTraceLinksPrdFixture());
    const graph = buildFocusedTraceGraph(traceability, "US-001");

    expect(graph.nodes).toContainEqual(
      expect.objectContaining({
        id: "FR-999",
        kind: "missing"
      })
    );
    expect(graph.issues).toHaveLength(1);
  });

  it("builds an agent-ready trace bundle with stable IDs and statuses", () => {
    const traceability = buildTraceability(validPrdFixture());
    const bundle = buildAgentTraceBundle(traceability, "FR-005", "2026-04-21T01:00:00Z");

    expect(bundle.schema).toBe("prd.trace-summary.v1");
    expect(bundle.selected_node).toEqual(
      expect.objectContaining({
        id: "FR-005",
        kind: "requirement",
        status: "proposed"
      })
    );
    expect(bundle.nodes).toContainEqual(
      expect.objectContaining({
        id: "DEC-007",
        status: "accepted"
      })
    );
    expect(bundle.nodes).toContainEqual(
      expect.objectContaining({
        id: "D-002",
        status: "pending"
      })
    );
    expect(bundle.edges).toContainEqual(
      expect.objectContaining({
        source: "US-003",
        target: "FR-005",
        valid: true
      })
    );
  });
});
