import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PacsMcpConfig } from "./config.js";
import { MetricsRecorder } from "./metrics.js";
import { PrdIndexStore } from "./prd-index.js";
import { PrdLoader } from "./prd-loader.js";
export type PacsMcpServerServices = {
    config: PacsMcpConfig;
    loader: PrdLoader;
    indexStore: PrdIndexStore;
    metrics: MetricsRecorder;
};
export type PacsMcpServerServicesResolver = () => Promise<PacsMcpServerServices>;
export declare function createServerServices(config: PacsMcpConfig): PacsMcpServerServices;
export declare function createServer(config: PacsMcpConfig, services?: PacsMcpServerServices, resolveServices?: PacsMcpServerServicesResolver): McpServer;
