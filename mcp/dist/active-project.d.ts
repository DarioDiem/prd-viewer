import type { PacsMcpConfig } from "./config.js";
import { type PacsMcpServerServices } from "./server.js";
export type RootUriProvider = () => Promise<string[]>;
export declare function createActiveProjectServicesResolver(listRootUris: RootUriProvider, env?: NodeJS.ProcessEnv): () => Promise<PacsMcpServerServices>;
export declare function resolveActiveConfig(listRootUris: RootUriProvider, env?: NodeJS.ProcessEnv): Promise<PacsMcpConfig>;
