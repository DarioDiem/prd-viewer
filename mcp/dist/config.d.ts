export type PrdMcpTransport = "stdio" | "http";
export type PrdMcpHttpConfig = {
    host: string;
    port: number;
    path: string;
    allowedHosts: string[];
    allowedOrigins: string[];
    url: string;
};
export type PrdMcpConfig = {
    repoRoot: string;
    prdPath: string;
    metricsPath: string;
    transport: PrdMcpTransport;
    mode: "local-read-only";
    plannedResources: readonly string[];
    plannedTools: readonly string[];
    responseModes: readonly string[];
    http: PrdMcpHttpConfig | null;
};
type ServerInfoSnapshot = PrdMcpConfig & {
    prdExists: boolean;
    metricsDirectoryExists: boolean;
};
export declare function resolveConfig(env?: NodeJS.ProcessEnv): PrdMcpConfig;
export declare function resolveConfigFromProjectRoots(rootUris: string[], env?: NodeJS.ProcessEnv): Promise<PrdMcpConfig>;
export declare function resolveProjectConfig(projectRoot: string, env?: NodeJS.ProcessEnv): Promise<PrdMcpConfig>;
export declare function repoRoot(): string;
export declare function getServerInfoSnapshot(config: PrdMcpConfig): Promise<ServerInfoSnapshot>;
export declare function isLocalHostname(value: string): boolean;
export {};
