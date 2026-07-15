import { type IncomingMessage } from "node:http";
import type { PacsMcpConfig } from "./config.js";
import { type PacsMcpServerServices } from "./server.js";
export type StartedHttpServer = {
    close(): Promise<void>;
    endpointUrl: string;
    healthUrl: string;
    host: string;
    port: number;
    path: string;
};
export declare function startHttpServer(config: PacsMcpConfig, services?: PacsMcpServerServices): Promise<StartedHttpServer>;
export declare function validateHttpRequest(req: Pick<IncomingMessage, "headers">, config: PacsMcpConfig): {
    statusCode: number;
    message: string;
} | null;
