import http from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isLocalHostname } from "./config.js";
import { createServer, createServerServices } from "./server.js";
export async function startHttpServer(config, services = createServerServices(config)) {
    const httpConfig = config.http;
    if (!httpConfig) {
        throw new Error("HTTP configuration is required when starting the HTTP transport.");
    }
    const nodeServer = http.createServer(async (req, res) => {
        try {
            if (req.url === "/health" && req.method === "GET") {
                writeJson(res, 200, {
                    status: "ok",
                    transport: config.transport,
                    mode: config.mode,
                    endpoint: httpConfig.url
                });
                return;
            }
            const requestUrl = new URL(req.url ?? "/", httpConfig.url);
            if (requestUrl.pathname !== httpConfig.path) {
                writeJson(res, 404, {
                    jsonrpc: "2.0",
                    error: {
                        code: -32000,
                        message: "Not found"
                    },
                    id: null
                });
                return;
            }
            const guard = validateHttpRequest(req, config);
            if (guard !== null) {
                writeJson(res, guard.statusCode, {
                    jsonrpc: "2.0",
                    error: {
                        code: -32000,
                        message: guard.message
                    },
                    id: null
                });
                return;
            }
            if (!["GET", "POST", "DELETE"].includes(req.method ?? "")) {
                writeJson(res, 405, {
                    jsonrpc: "2.0",
                    error: {
                        code: -32000,
                        message: "Method not allowed"
                    },
                    id: null
                });
                return;
            }
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined
            });
            const server = createServer(config, services);
            res.on("close", () => {
                transport.close().catch(() => undefined);
                server.close().catch(() => undefined);
            });
            await server.connect(transport);
            await transport.handleRequest(req, res);
        }
        catch (error) {
            if (!res.headersSent) {
                writeJson(res, 500, {
                    jsonrpc: "2.0",
                    error: {
                        code: -32603,
                        message: error instanceof Error ? error.message : "Internal server error"
                    },
                    id: null
                });
            }
        }
    });
    await new Promise((resolve, reject) => {
        nodeServer.once("error", reject);
        nodeServer.listen(httpConfig.port, httpConfig.host, () => {
            nodeServer.off("error", reject);
            resolve();
        });
    });
    const address = nodeServer.address();
    if (!address || typeof address === "string") {
        throw new Error("Failed to resolve HTTP server address.");
    }
    const host = formatHttpHostForUrl(httpConfig.host);
    const port = address.port;
    const endpointUrl = `http://${host}:${port}${httpConfig.path}`;
    return {
        endpointUrl,
        healthUrl: `http://${host}:${port}/health`,
        host: httpConfig.host,
        port,
        path: httpConfig.path,
        async close() {
            await new Promise((resolve, reject) => {
                nodeServer.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            });
        }
    };
}
export function validateHttpRequest(req, config) {
    if (!config.http) {
        return {
            statusCode: 500,
            message: "HTTP transport is not configured."
        };
    }
    const hostHeader = req.headers.host;
    if (!hostHeader) {
        return {
            statusCode: 403,
            message: "Missing Host header"
        };
    }
    let hostname;
    try {
        hostname = new URL(`http://${hostHeader}`).hostname;
    }
    catch {
        return {
            statusCode: 403,
            message: `Invalid Host header: ${hostHeader}`
        };
    }
    if (!config.http.allowedHosts.includes(hostname)) {
        return {
            statusCode: 403,
            message: `Invalid Host: ${hostname}`
        };
    }
    const originHeader = req.headers.origin;
    if (!originHeader) {
        return null;
    }
    let origin;
    try {
        origin = new URL(originHeader);
    }
    catch {
        return {
            statusCode: 403,
            message: `Invalid Origin header: ${originHeader}`
        };
    }
    if (config.http.allowedOrigins.length > 0) {
        if (!config.http.allowedOrigins.includes(origin.origin)) {
            return {
                statusCode: 403,
                message: `Invalid Origin: ${origin.origin}`
            };
        }
        return null;
    }
    if (!isLocalHostname(origin.hostname)) {
        return {
            statusCode: 403,
            message: `Invalid Origin: ${origin.origin}`
        };
    }
    return null;
}
function writeJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        "content-type": "application/json"
    });
    res.end(JSON.stringify(payload));
}
function formatHttpHostForUrl(host) {
    return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}
