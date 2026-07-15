export type FixtureVariant = "valid" | "malformed_json" | "schema_invalid" | "unsupported_schema_version" | "required_extension" | "broken_trace_links";
export type FixtureState = {
    repoRoot: string;
    tempDir: string;
    prdPath: string;
    metricsPath: string;
};
export declare function loadSeedPrd(): Promise<Record<string, unknown>>;
export declare function createFixture(variant: FixtureVariant, prefix?: string): Promise<FixtureState>;
