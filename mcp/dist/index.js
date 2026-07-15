import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createActiveProjectServicesResolver } from "./active-project.js";
import { resolveConfig } from "./config.js";
import { startHttpServer } from "./http-server.js";
import { createServer, createServerServices } from "./server.js";
async function main() {
    const config = resolveConfig();
    if (config.transport === "http") {
        const services = createServerServices(config);
        const started = await startHttpServer(config, services);
        console.error(`[pacs-prd-mcp] streamable HTTP listening on ${started.endpointUrl}`);
        const shutdown = async () => {
            await started.close().catch(() => undefined);
            process.exit(0);
        };
        process.once("SIGINT", () => {
            void shutdown();
        });
        process.once("SIGTERM", () => {
            void shutdown();
        });
        return;
    }
    let server;
    const resolveServices = createActiveProjectServicesResolver(async () => {
        const capabilities = server.server.getClientCapabilities();
        if (!capabilities?.roots) {
            return [];
        }
        const result = await server.server.listRoots();
        return result.roots.map((root) => root.uri);
    });
    server = createServer(config, createServerServices(config), resolveServices);
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    console.error("[pacs-prd-mcp] failed to start", error);
    process.exitCode = 1;
});
