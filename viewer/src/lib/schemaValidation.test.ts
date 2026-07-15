import { describe, expect, it } from "vitest";
import {
  backwardCompatiblePrdFixture,
  brokenTraceLinksPrdFixture,
  largePrdFixture,
  malformedPrdJsonFixture,
  requiredExtensionPrdFixture,
  schemaInvalidPrdFixture,
  unsupportedSchemaVersionPrdFixture,
  validPrdFixture
} from "../test/prdFixtures";
import {
  createValidationFailureResult,
  createValidationNotRunResult,
  validatePrdDocument
} from "./schemaValidation";

describe("schemaValidation", () => {
  it("validates the canonical viewer PRD against schema.strict.json", () => {
    const result = validatePrdDocument(validPrdFixture(), "2026-04-20T00:00:00Z");

    expect(result).toEqual({
      status: "valid",
      checkedAt: "2026-04-20T00:00:00Z",
      issues: []
    });
  });

  it("returns JSON paths and messages for schema failures", () => {
    const result = validatePrdDocument(schemaInvalidPrdFixture(), "2026-04-20T00:00:00Z");

    expect(result.status).toBe("invalid");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '$["meta"]["title"]',
          keyword: "minLength",
          severity: "error"
        })
      ])
    );
  });

  it("requires external_refs to contain unique canonical URIs", () => {
    const invalidUri = validPrdFixture();
    invalidUri.project_tracking.pending_work[0].external_refs = ["not a URI"];

    expect(validatePrdDocument(invalidUri).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ keyword: "format" })])
    );

    const duplicateUri = validPrdFixture();
    duplicateUri.project_tracking.pending_work[0].external_refs = [
      "https://github.com/example/project/issues/123",
      "https://github.com/example/project/issues/123"
    ];

    expect(validatePrdDocument(duplicateUri).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ keyword: "uniqueItems" })])
    );
  });

  it("keeps named PRD fixtures aligned with strict schema expectations", () => {
    const validFixtures = [
      ["valid", validPrdFixture()],
      ["backward compatible", backwardCompatiblePrdFixture()],
      ["unsupported schema version", unsupportedSchemaVersionPrdFixture()],
      ["required extension", requiredExtensionPrdFixture()],
      ["broken trace links", brokenTraceLinksPrdFixture()],
      ["large PRD", largePrdFixture()]
    ] as const;

    validFixtures.forEach(([name, fixture]) => {
      expect(validatePrdDocument(fixture), name).toEqual(
        expect.objectContaining({
          status: "valid",
          issues: []
        })
      );
    });
    expect(validatePrdDocument(schemaInvalidPrdFixture())).toEqual(
      expect.objectContaining({
        status: "invalid"
      })
    );
  });

  it("keeps an explicit not-run state for unloaded or stale validation", () => {
    expect(createValidationNotRunResult()).toEqual({
      status: "not_run",
      checkedAt: null,
      issues: []
    });
  });

  it("creates a parse failure result for malformed local files", () => {
    expect(() => JSON.parse(malformedPrdJsonFixture)).toThrow();
    expect(createValidationFailureResult("Unable to parse JSON.", "2026-04-20T00:00:00Z")).toEqual({
      status: "invalid",
      checkedAt: "2026-04-20T00:00:00Z",
      issues: [
        {
          path: "$",
          keyword: "parse",
          message: "Unable to parse JSON.",
          severity: "error"
        }
      ]
    });
  });
});
