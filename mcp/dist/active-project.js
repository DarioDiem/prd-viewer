import { resolveConfigFromProjectRoots } from "./config.js";
import { createServerServices } from "./server.js";
export function createActiveProjectServicesResolver(listRootUris, env = process.env) {
    let services = null;
    return () => {
        services ??= resolveActiveConfig(listRootUris, env).then(createServerServices);
        return services;
    };
}
export async function resolveActiveConfig(listRootUris, env = process.env) {
    const rootUris = env.PACS_PRD_PATH ? [] : await listRootUris();
    return resolveConfigFromProjectRoots(rootUris, env);
}
