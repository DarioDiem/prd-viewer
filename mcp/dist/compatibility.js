import fs from "node:fs/promises";
import path from "node:path";
const manifestCache = new Map();
export async function checkSchemaCompatibility(prd, repoRoot) {
    const manifest = await loadSchemaManifest(repoRoot);
    const currentSchemaVersion = manifest.current_schema_version;
    const prdRecord = asRecord(prd);
    const meta = asRecord(prdRecord?.meta);
    const contract = asRecord(meta?.schema_contract);
    const declaredSchemaVersion = readOptionalString(contract?.schema_version);
    const entry = manifest.schemas.find((schema) => schema.schema_version === declaredSchemaVersion);
    const extensions = collectDeclaredExtensions(prdRecord, contract);
    const requiredExtensions = extensions.filter((extension) => extension.required === true);
    const compatibilityMode = readOptionalString(contract?.compatibility_mode);
    const result = {
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
        appendExtensionWarning(result);
        return result;
    }
    if (!entry) {
        result.warnings.push(`Declared schema version ${declaredSchemaVersion ?? "unknown"} is not listed in schema.versions.json.`);
        appendExtensionWarning(result);
        return result;
    }
    const fullyCompatible = entry.fully_compatible_with?.includes(currentSchemaVersion) ?? false;
    const backwardCompatible = entry.backward_compatible_with?.includes(currentSchemaVersion) ?? false;
    const migrationRequired = entry.migration_required_from?.includes(currentSchemaVersion) ?? false;
    if (declaredSchemaVersion === currentSchemaVersion) {
        result.status = "exact";
        result.fullyCompatible = true;
    }
    else if (fullyCompatible) {
        result.status = "fully_compatible";
        result.fullyCompatible = true;
    }
    else if (backwardCompatible) {
        result.status = "backward_compatible";
        result.backwardCompatible = true;
    }
    else if (migrationRequired) {
        result.status = "migration_required";
        result.migrationRequired = true;
    }
    else {
        result.warnings.push(`No compatibility rule found from declared version ${declaredSchemaVersion} to current version ${currentSchemaVersion}.`);
    }
    if (compatibilityMode && !["exact", result.status].includes(compatibilityMode)) {
        result.warnings.push(`Declared compatibility_mode=${compatibilityMode} does not match manifest result ${result.status}.`);
    }
    appendExtensionWarning(result);
    return result;
}
export function isLossyCompatibilityStatus(status) {
    return status === "migration_required" || status === "legacy_unversioned" || status === "unknown";
}
async function loadSchemaManifest(repoRoot) {
    const manifestPath = path.resolve(repoRoot, "schema.versions.json");
    const cached = manifestCache.get(manifestPath);
    if (cached) {
        return cached;
    }
    const pending = fs.readFile(manifestPath, "utf8").then((text) => JSON.parse(text));
    manifestCache.set(manifestPath, pending);
    return pending;
}
function collectDeclaredExtensions(prdRecord, contract) {
    const byId = new Map();
    const contractExtensions = asArray(contract?.extensions);
    const extensionsContainer = asRecord(prdRecord?.extensions);
    const registry = asArray(extensionsContainer?.registry);
    for (const candidate of [...contractExtensions, ...registry]) {
        const descriptor = normalizeExtensionDescriptor(candidate);
        if (descriptor) {
            byId.set(descriptor.extension_id, descriptor);
        }
    }
    return [...byId.values()];
}
function normalizeExtensionDescriptor(candidate) {
    const record = asRecord(candidate);
    const extensionId = readOptionalString(record?.extension_id);
    if (!extensionId) {
        return null;
    }
    return {
        extension_id: extensionId,
        name: readOptionalString(record?.name),
        version: readOptionalString(record?.version),
        compatibility: readOptionalString(record?.compatibility),
        required: typeof record?.required === "boolean" ? record.required : undefined,
        owner: readOptionalString(record?.owner),
        schema_ref: readOptionalString(record?.schema_ref),
        description: readOptionalString(record?.description)
    };
}
function appendExtensionWarning(result) {
    if (result.requiredExtensions.length > 0) {
        result.warnings.push("PRD declares required extensions; consumers must support them or fail closed.");
    }
}
function asRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : null;
}
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function readOptionalString(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
}
