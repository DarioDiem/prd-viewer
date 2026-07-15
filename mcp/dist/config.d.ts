export type PacsMcpTransport = "stdio" | "http";
export type PacsMcpHttpConfig = {
    host: string;
    port: number;
    path: string;
    allowedHosts: string[];
    allowedOrigins: string[];
    url: string;
};
export type PacsMcpConfig = {
    repoRoot: string;
    prdPath: string;
    metricsPath: string;
    transport: PacsMcpTransport;
    mode: "local-read-only";
    plannedResources: readonly string[];
    plannedTools: readonly string[];
    responseModes: readonly string[];
    http: PacsMcpHttpConfig | null;
};
type ServerInfoSnapshot = PacsMcpConfig & {
    prdExists: boolean;
    metricsDirectoryExists: boolean;
};
export declare function resolveConfig(env?: NodeJS.ProcessEnv): PacsMcpConfig;
export declare function resolveConfigFromProjectRoots(rootUris: string[], env?: NodeJS.ProcessEnv): Promise<PacsMcpConfig>;
export declare function resolveProjectConfig(projectRoot: string, env?: NodeJS.ProcessEnv): Promise<PacsMcpConfig>;
export declare function repoRoot(): string;
export declare function getServerInfoSnapshot(config: PacsMcpConfig): Promise<ServerInfoSnapshot>;
export declare function isLocalHostname(value: string): boolean;
export {};
