import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PLANNED_RESOURCES, PLANNED_TOOLS, RESPONSE_MODES } from "./surface.js";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DEFAULT_PRD_RELATIVE_PATH = path.join("viewer", "PRD_web_ui.json");
const DEFAULT_METRICS_RELATIVE_PATH = path.join(".metrics", "pacs_prd_mcp.jsonl");
const DEFAULT_HTTP_HOST = "127.0.0.1";
const DEFAULT_HTTP_PORT = 3334;
const DEFAULT_HTTP_PATH = "/mcp";
const PROJECT_CONFIG_NAME = "pacs.config.json";
const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "::1", "[::1]"] as const;

export type PacsMcpTransport = "stdio" | "http";

export type PacsMcpHttpConfig = {
  host: string;
  port: number;
  path: string;
  allowedHosts: string[];
  allowedOrigins: string[];
  url: string;
};

export type PacsMcpConfig = {
  repoRoot: string;
  prdPath: string;
  metricsPath: string;
  transport: PacsMcpTransport;
  mode: "local-read-only";
  plannedResources: readonly string[];
  plannedTools: readonly string[];
  responseModes: readonly string[];
  http: PacsMcpHttpConfig | null;
};

type ServerInfoSnapshot = PacsMcpConfig & {
  prdExists: boolean;
  metricsDirectoryExists: boolean;
};

function resolveRepoRelativePath(repoRoot: string, candidate: string): string {
  return path.isAbsolute(candidate) ? candidate : path.resolve(repoRoot, candidate);
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): PacsMcpConfig {
  const root = env.PACS_PROJECT_ROOT ? path.resolve(env.PACS_PROJECT_ROOT) : repoRoot();
  const transport = readTransport(env.PACS_MCP_TRANSPORT);
  const prdPath = resolveRepoRelativePath(root, env.PACS_PRD_PATH ?? DEFAULT_PRD_RELATIVE_PATH);
  const metricsPath = resolveRepoRelativePath(root, env.PACS_MCP_METRICS_PATH ?? DEFAULT_METRICS_RELATIVE_PATH);
  const http = transport === "http" ? readHttpConfig(env) : null;

  return {
    repoRoot: root,
    prdPath,
    metricsPath,
    transport,
    mode: "local-read-only",
    plannedResources: PLANNED_RESOURCES,
    plannedTools: PLANNED_TOOLS,
    responseModes: RESPONSE_MODES,
    http
  };
}

export async function resolveConfigFromProjectRoots(
  rootUris: string[],
  env: NodeJS.ProcessEnv = process.env
): Promise<PacsMcpConfig> {
  if (env.PACS_PRD_PATH) {
    return resolveConfig(env);
  }

  const candidates = [
    env.PACS_PROJECT_ROOT,
    ...rootUris.map(filePathFromUri).filter((value): value is string => value !== null),
    env.INIT_CWD,
    env.PWD
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const projectRoot = await findProjectRoot(candidate);
    if (projectRoot) {
      return resolveProjectConfig(projectRoot, env);
    }
  }

  throw new Error(
    "No pacs.config.json was found for the active project. Open a PACS project or run the PACS project initializer."
  );
}

export async function resolveProjectConfig(
  projectRoot: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<PacsMcpConfig> {
  const configPath = path.join(projectRoot, PROJECT_CONFIG_NAME);
  const document = JSON.parse(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
  const prd = asRecord(document.prd);
  const metrics = asRecord(document.metrics);
  const prdPath = readPath(prd?.path, "PRD.json", "prd.path");
  const metricsPath = readPath(
    metrics?.path,
    DEFAULT_METRICS_RELATIVE_PATH,
    "metrics.path"
  );

  return resolveConfig({
    ...env,
    PACS_PROJECT_ROOT: projectRoot,
    PACS_PRD_PATH: prdPath,
    PACS_MCP_METRICS_PATH: metricsPath,
    PACS_MCP_TRANSPORT: env.PACS_MCP_TRANSPORT ?? "stdio"
  });
}

export function repoRoot(): string {
  return REPO_ROOT;
}

async function findProjectRoot(start: string): Promise<string | null> {
  let current = path.resolve(start);

  try {
    if (!(await fs.stat(current)).isDirectory()) {
      current = path.dirname(current);
    }
  } catch {
    return null;
  }

  while (true) {
    if (await pathExists(path.join(current, PROJECT_CONFIG_NAME))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function filePathFromUri(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "file:" ? fileURLToPath(url) : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readPath(value: unknown, fallback: string, field: string): string {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} in ${PROJECT_CONFIG_NAME} must be a non-empty string.`);
  }
  return value;
}

export async function getServerInfoSnapshot(config: PacsMcpConfig): Promise<ServerInfoSnapshot> {
  const [prdExists, metricsDirectoryExists] = await Promise.all([
    pathExists(config.prdPath),
    pathExists(path.dirname(config.metricsPath))
  ]);

  return {
    ...config,
    prdExists,
    metricsDirectoryExists
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function isLocalHostname(value: string): boolean {
  return LOCAL_HOSTNAMES.includes(value as (typeof LOCAL_HOSTNAMES)[number]);
}

function readTransport(value: string | undefined): PacsMcpTransport {
  if (value === "http") {
    return "http";
  }

  return "stdio";
}

function readHttpConfig(env: NodeJS.ProcessEnv): PacsMcpHttpConfig {
  const host = env.PACS_MCP_HTTP_HOST ?? DEFAULT_HTTP_HOST;
  if (!isLocalHostname(host)) {
    throw new Error(`PACS_MCP_HTTP_HOST must stay on localhost; received ${host}`);
  }

  const port = readPort(env.PACS_MCP_HTTP_PORT);
  const pathValue = normalizeHttpPath(env.PACS_MCP_HTTP_PATH ?? DEFAULT_HTTP_PATH);
  const allowedOrigins = readCsv(env.PACS_MCP_HTTP_ALLOWED_ORIGINS);
  const allowedHosts = [...new Set(LOCAL_HOSTNAMES)];

  return {
    host,
    port,
    path: pathValue,
    allowedHosts,
    allowedOrigins,
    url: `http://${formatHttpHost(host)}:${port}${pathValue}`
  };
}

function readPort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_HTTP_PORT;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`PACS_MCP_HTTP_PORT must be an integer between 0 and 65535; received ${value}`);
  }

  return parsed;
}

function normalizeHttpPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    throw new Error(`PACS_MCP_HTTP_PATH must start with '/'; received ${value}`);
  }

  return trimmed.length > 1 ? trimmed.replace(/\/+$/, "") : trimmed;
}

function readCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatHttpHost(host: string): string {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}
