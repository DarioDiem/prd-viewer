import type { PacsMcpConfig } from "./config.js";
import { resolveConfigFromProjectRoots } from "./config.js";
import { createServerServices, type PacsMcpServerServices } from "./server.js";

export type RootUriProvider = () => Promise<string[]>;

export function createActiveProjectServicesResolver(
  listRootUris: RootUriProvider,
  env: NodeJS.ProcessEnv = process.env
): () => Promise<PacsMcpServerServices> {
  let services: Promise<PacsMcpServerServices> | null = null;

  return () => {
    services ??= resolveActiveConfig(listRootUris, env).then(createServerServices);
    return services;
  };
}

export async function resolveActiveConfig(
  listRootUris: RootUriProvider,
  env: NodeJS.ProcessEnv = process.env
): Promise<PacsMcpConfig> {
  const rootUris = env.PACS_PRD_PATH ? [] : await listRootUris();
  return resolveConfigFromProjectRoots(rootUris, env);
}
