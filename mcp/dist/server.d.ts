import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PrdMcpConfig } from "./config.js";
import { MetricsRecorder } from "./metrics.js";
import { PrdIndexStore } from "./prd-index.js";
import { PrdLoader } from "./prd-loader.js";
export type PrdMcpServerServices = {
    config: PrdMcpConfig;
    loader: PrdLoader;
    indexStore: PrdIndexStore;
    metrics: MetricsRecorder;
};
export type PrdMcpServerServicesResolver = () => Promise<PrdMcpServerServices>;
export declare function createServerServices(config: PrdMcpConfig): PrdMcpServerServices;
export declare function createServer(config: PrdMcpConfig, services?: PrdMcpServerServices, resolveServices?: PrdMcpServerServicesResolver): McpServer;
