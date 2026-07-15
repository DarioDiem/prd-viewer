export type CompatibilityStatus = "exact" | "fully_compatible" | "backward_compatible" | "migration_required" | "legacy_unversioned" | "unknown";
export type ExtensionDescriptor = {
    extension_id: string;
    name?: string | null;
    version?: string | null;
    compatibility?: string | null;
    required?: boolean;
    owner?: string | null;
    schema_ref?: string | null;
    description?: string | null;
};
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
export declare function checkSchemaCompatibility(prd: unknown, repoRoot: string): Promise<SchemaCompatibilityResult>;
export declare function isLossyCompatibilityStatus(status: CompatibilityStatus): boolean;
