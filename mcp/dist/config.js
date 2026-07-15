import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLANNED_RESOURCES, PLANNED_TOOLS, RESPONSE_MODES } from "./surface.js";
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DEFAULT_PRD_RELATIVE_PATH = path.join("viewer", "PRD_web_ui.json");
const DEFAULT_METRICS_RELATIVE_PATH = path.join(".metrics", "prd_viewer_mcp.jsonl");
const DEFAULT_HTTP_HOST = "127.0.0.1";
const DEFAULT_HTTP_PORT = 3334;
const DEFAULT_HTTP_PATH = "/mcp";
const PROJECT_CONFIG_NAME = "prd.config.json";
const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "::1", "[::1]"];
function resolveRepoRelativePath(repoRoot, candidate) {
    return path.isAbsolute(candidate) ? candidate : path.resolve(repoRoot, candidate);
}
export function resolveConfig(env = process.env) {
    const root = env.PRD_PROJECT_ROOT ? path.resolve(env.PRD_PROJECT_ROOT) : repoRoot();
    const transport = readTransport(env.PRD_MCP_TRANSPORT);
    const prdPath = resolveRepoRelativePath(root, env.PRD_PATH ?? DEFAULT_PRD_RELATIVE_PATH);
    const metricsPath = resolveRepoRelativePath(root, env.PRD_MCP_METRICS_PATH ?? DEFAULT_METRICS_RELATIVE_PATH);
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
export async function resolveConfigFromProjectRoots(rootUris, env = process.env) {
    if (env.PRD_PATH) {
        return resolveConfig(env);
    }
    const candidates = [
        env.PRD_PROJECT_ROOT,
        ...rootUris.map(filePathFromUri).filter((value) => value !== null),
        env.INIT_CWD,
        env.PWD
    ].filter((value) => Boolean(value));
    for (const candidate of candidates) {
        const projectRoot = await findProjectRoot(candidate);
        if (projectRoot) {
            return resolveProjectConfig(projectRoot, env);
        }
    }
    throw new Error("No prd.config.json was found for the active project. Open a PRD project or run the PRD project initializer.");
}
export async function resolveProjectConfig(projectRoot, env = process.env) {
    const configPath = path.join(projectRoot, PROJECT_CONFIG_NAME);
    const document = JSON.parse(await fs.readFile(configPath, "utf8"));
    const prd = asRecord(document.prd);
    const metrics = asRecord(document.metrics);
    const prdPath = readPath(prd?.path, "PRD.json", "prd.path");
    const metricsPath = readPath(metrics?.path, DEFAULT_METRICS_RELATIVE_PATH, "metrics.path");
    return resolveConfig({
        ...env,
        PRD_PROJECT_ROOT: projectRoot,
        PRD_PATH: prdPath,
        PRD_MCP_METRICS_PATH: metricsPath,
        PRD_MCP_TRANSPORT: env.PRD_MCP_TRANSPORT ?? "stdio"
    });
}
export function repoRoot() {
    return REPO_ROOT;
}
async function findProjectRoot(start) {
    let current = path.resolve(start);
    try {
        if (!(await fs.stat(current)).isDirectory()) {
            current = path.dirname(current);
        }
    }
    catch {
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
function filePathFromUri(value) {
    try {
        const url = new URL(value);
        return url.protocol === "file:" ? fileURLToPath(url) : null;
    }
    catch {
        return null;
    }
}
function asRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : null;
}
function readPath(value, fallback, field) {
    if (value === undefined) {
        return fallback;
    }
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`${field} in ${PROJECT_CONFIG_NAME} must be a non-empty string.`);
    }
    return value;
}
export async function getServerInfoSnapshot(config) {
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
async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    }
    catch {
        return false;
    }
}
export function isLocalHostname(value) {
    return LOCAL_HOSTNAMES.includes(value);
}
function readTransport(value) {
    if (value === "http") {
        return "http";
    }
    return "stdio";
}
function readHttpConfig(env) {
    const host = env.PRD_MCP_HTTP_HOST ?? DEFAULT_HTTP_HOST;
    if (!isLocalHostname(host)) {
        throw new Error(`PRD_MCP_HTTP_HOST must stay on localhost; received ${host}`);
    }
    const port = readPort(env.PRD_MCP_HTTP_PORT);
    const pathValue = normalizeHttpPath(env.PRD_MCP_HTTP_PATH ?? DEFAULT_HTTP_PATH);
    const allowedOrigins = readCsv(env.PRD_MCP_HTTP_ALLOWED_ORIGINS);
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
function readPort(value) {
    if (!value) {
        return DEFAULT_HTTP_PORT;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
        throw new Error(`PRD_MCP_HTTP_PORT must be an integer between 0 and 65535; received ${value}`);
    }
    return parsed;
}
function normalizeHttpPath(value) {
    const trimmed = value.trim();
    if (!trimmed.startsWith("/")) {
        throw new Error(`PRD_MCP_HTTP_PATH must start with '/'; received ${value}`);
    }
    return trimmed.length > 1 ? trimmed.replace(/\/+$/, "") : trimmed;
}
function readCsv(value) {
    if (!value) {
        return [];
    }
    return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function formatHttpHost(host) {
    return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}
