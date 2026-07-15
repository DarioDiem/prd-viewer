import type { PrdMcpConfig } from "./config.js";
import { resolveConfigFromProjectRoots } from "./config.js";
import { createServerServices, type PrdMcpServerServices } from "./server.js";

export type RootUriProvider = () => Promise<string[]>;

export function createActiveProjectServicesResolver(
  listRootUris: RootUriProvider,
  env: NodeJS.ProcessEnv = process.env
): () => Promise<PrdMcpServerServices> {
  let services: Promise<PrdMcpServerServices> | null = null;

  return () => {
    services ??= resolveActiveConfig(listRootUris, env).then(createServerServices);
    return services;
  };
}

export async function resolveActiveConfig(
  listRootUris: RootUriProvider,
  env: NodeJS.ProcessEnv = process.env
): Promise<PrdMcpConfig> {
  const rootUris = env.PRD_PATH ? [] : await listRootUris();
  return resolveConfigFromProjectRoots(rootUris, env);
}
