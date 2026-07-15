import { type IncomingMessage } from "node:http";
import type { PrdMcpConfig } from "./config.js";
import { type PrdMcpServerServices } from "./server.js";
export type StartedHttpServer = {
    close(): Promise<void>;
    endpointUrl: string;
    healthUrl: string;
    host: string;
    port: number;
    path: string;
};
export declare function startHttpServer(config: PrdMcpConfig, services?: PrdMcpServerServices): Promise<StartedHttpServer>;
export declare function validateHttpRequest(req: Pick<IncomingMessage, "headers">, config: PrdMcpConfig): {
    statusCode: number;
    message: string;
} | null;
