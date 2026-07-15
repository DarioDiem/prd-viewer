import schemaManifest from "../../../schema.versions.json";
import type { ExtensionDescriptor, PrdDocument } from "../types/prd";

type SchemaManifest = {
  current_schema_version: string;
  schemas: Array<{
    schema_version: string;
    fully_compatible_with?: string[];
    backward_compatible_with?: string[];
    migration_required_from?: string[];
  }>;
};

export type CompatibilityStatus =
  | "exact"
  | "fully_compatible"
  | "backward_compatible"
  | "migration_required"
  | "legacy_unversioned"
  | "unknown";

export type SchemaCompatibilityResult = {
  currentSchemaVersion: string;
  declaredSchemaVersion: string | null;
  status: CompatibilityStatus;
  fullyCompatible: boolean;
  backwardCompatible: boolean;
  migrationRequired: boolean;
  legacyUnversioned: boolean;
  extensions: ExtensionDescriptor[];
  requiredExtensions: ExtensionDescriptor[];
  warnings: string[];
};

const manifest = schemaManifest as SchemaManifest;

export function checkSchemaCompatibility(prd: PrdDocument): SchemaCompatibilityResult {
  const currentSchemaVersion = manifest.current_schema_version;
  const contract = prd.meta.schema_contract ?? null;
  const declaredSchemaVersion = contract?.schema_version ?? null;
  const entry = manifest.schemas.find((schema) => schema.schema_version === declaredSchemaVersion);
  const extensions = collectDeclaredExtensions(prd);
  const requiredExtensions = extensions.filter((extension) => extension.required === true);
  const result: SchemaCompatibilityResult = {
    currentSchemaVersion,
    declaredSchemaVersion,
    status: "unknown",
    fullyCompatible: false,
    backwardCompatible: false,
    migrationRequired: false,
    legacyUnversioned: contract === null,
    extensions,
    requiredExtensions,
    warnings: []
  };

  if (contract === null) {
    result.status = "legacy_unversioned";
    result.warnings.push("PRD validates structurally but does not declare meta.schema_contract.");
    return result;
  }

  if (!entry) {
    result.warnings.push(
      `Declared schema version ${declaredSchemaVersion ?? "unknown"} is not listed in schema.versions.json.`
    );
    appendExtensionWarning(result);
    return result;
  }

  const fullyCompatible = entry.fully_compatible_with?.includes(currentSchemaVersion) ?? false;
  const backwardCompatible = entry.backward_compatible_with?.includes(currentSchemaVersion) ?? false;
  const migrationRequired = entry.migration_required_from?.includes(currentSchemaVersion) ?? false;

  if (declaredSchemaVersion === currentSchemaVersion) {
    result.status = "exact";
    result.fullyCompatible = true;
  } else if (fullyCompatible) {
    result.status = "fully_compatible";
    result.fullyCompatible = true;
  } else if (backwardCompatible) {
    result.status = "backward_compatible";
    result.backwardCompatible = true;
  } else if (migrationRequired) {
    result.status = "migration_required";
    result.migrationRequired = true;
  } else {
    result.warnings.push(
      `No compatibility rule found from declared version ${declaredSchemaVersion} to current version ${currentSchemaVersion}.`
    );
  }

  if (contract.compatibility_mode && !["exact", result.status].includes(contract.compatibility_mode)) {
    result.warnings.push(
      `Declared compatibility_mode=${contract.compatibility_mode} does not match manifest result ${result.status}.`
    );
  }

  appendExtensionWarning(result);
  return result;
}

export function formatCompatibilityStatus(status: CompatibilityStatus): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function collectDeclaredExtensions(prd: PrdDocument): ExtensionDescriptor[] {
  const byId = new Map<string, ExtensionDescriptor>();

  for (const extension of prd.meta.schema_contract?.extensions ?? []) {
    byId.set(extension.extension_id, extension);
  }

  for (const extension of prd.extensions?.registry ?? []) {
    if (!byId.has(extension.extension_id)) {
      byId.set(extension.extension_id, extension);
    }
  }

  return [...byId.values()];
}

function appendExtensionWarning(result: SchemaCompatibilityResult) {
  if (result.requiredExtensions.length > 0) {
    result.warnings.push(
      "PRD declares required extensions; consumers must support them or fail closed."
    );
  }
}
