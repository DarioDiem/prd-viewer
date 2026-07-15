import { describe, expect, it } from "vitest";
import { checkSchemaCompatibility, formatCompatibilityStatus } from "./schemaCompatibility";
import {
  backwardCompatiblePrdFixture,
  requiredExtensionPrdFixture,
  unsupportedSchemaVersionPrdFixture,
  validPrdFixture
} from "../test/prdFixtures";

describe("schemaCompatibility", () => {
  it("reports exact compatibility for the current viewer PRD", () => {
    const result = checkSchemaCompatibility(validPrdFixture());

    expect(result.currentSchemaVersion).toBe("1.2.0");
    expect(result.declaredSchemaVersion).toBe("1.2.0");
    expect(result.status).toBe("exact");
    expect(result.fullyCompatible).toBe(true);
    expect(result.migrationRequired).toBe(false);
    expect(result.extensions).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("marks 1.0.0 documents as backward compatible with the current schema", () => {
    const result = checkSchemaCompatibility(backwardCompatiblePrdFixture());

    expect(result.currentSchemaVersion).toBe("1.2.0");
    expect(result.declaredSchemaVersion).toBe("1.0.0");
    expect(result.status).toBe("backward_compatible");
    expect(result.backwardCompatible).toBe(true);
    expect(result.migrationRequired).toBe(false);
  });

  it("marks 1.1.0 project-tracking documents as backward compatible", () => {
    const prd = validPrdFixture();
    prd.meta.schema_contract = {
      ...prd.meta.schema_contract,
      schema_id: "https://example.com/prd.schema.strict.v1.1.0.json",
      schema_version: "1.1.0",
      compatible_schema_versions: ["1.1.0"],
      compatibility_mode: "backward_compatible"
    };

    const result = checkSchemaCompatibility(prd);

    expect(result.currentSchemaVersion).toBe("1.2.0");
    expect(result.status).toBe("backward_compatible");
    expect(result.backwardCompatible).toBe(true);
  });

  it("marks documents without schema_contract as legacy unversioned", () => {
    const prd = validPrdFixture();
    prd.meta.schema_contract = null;

    const result = checkSchemaCompatibility(prd);

    expect(result.status).toBe("legacy_unversioned");
    expect(result.legacyUnversioned).toBe(true);
    expect(result.warnings).toContain("PRD validates structurally but does not declare meta.schema_contract.");
  });

  it("warns when the declared schema version is unknown", () => {
    const result = checkSchemaCompatibility(unsupportedSchemaVersionPrdFixture());

    expect(result.status).toBe("unknown");
    expect(result.warnings[0]).toContain("9.9.9");
  });

  it("deduplicates extension declarations and flags required extensions", () => {
    const result = checkSchemaCompatibility(requiredExtensionPrdFixture());

    expect(result.extensions).toHaveLength(1);
    expect(result.requiredExtensions).toHaveLength(1);
    expect(result.warnings).toContain(
      "PRD declares required extensions; consumers must support them or fail closed."
    );
  });

  it("formats compatibility labels for UI display", () => {
    expect(formatCompatibilityStatus("legacy_unversioned")).toBe("Legacy Unversioned");
  });
});
