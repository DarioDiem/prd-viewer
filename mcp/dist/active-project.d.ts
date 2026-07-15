import type { PrdMcpConfig } from "./config.js";
import { type PrdMcpServerServices } from "./server.js";
export type RootUriProvider = () => Promise<string[]>;
export declare function createActiveProjectServicesResolver(listRootUris: RootUriProvider, env?: NodeJS.ProcessEnv): () => Promise<PrdMcpServerServices>;
export declare function resolveActiveConfig(listRootUris: RootUriProvider, env?: NodeJS.ProcessEnv): Promise<PrdMcpConfig>;
