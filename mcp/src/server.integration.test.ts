import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import type { FixtureVariant } from "./test-fixtures.js";
import { createFixture } from "./test-fixtures.js";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const mcpRoot = path.resolve(repoRoot, "mcp");

test("stdio integration exposes tools, resources, templates, and focused results", async () => {
  const session = await connectFixture("valid", "pacs-mcp-integration-valid-");

  try {
    const tools = await session.client.listTools();
    const resources = await session.client.listResources();
    const templates = await session.client.listResourceTemplates();

    assert.ok(tools.tools.some((tool) => tool.name === "search_prd"));
    assert.ok(tools.tools.some((tool) => tool.name === "build_agent_packet"));
    assert.ok(resources.resources.some((resource) => resource.uri === "prd://summary"));
    assert.ok(
      templates.resourceTemplates.some((template) => template.uriTemplate === "prd://section/{name}{?mode}")
    );

    const summary = parseResourceEnvelope(await session.client.readResource({ uri: "prd://summary?mode=compact" }));
    const search = parseToolEnvelope(
      await session.client.callTool({
        name: "search_prd",
        arguments: {
          query: "FR-012",
          mode: "compact"
        }
      })
    );

    assert.equal(summary.kind, "summary");
    assert.equal(summary.mode, "compact");
    assert.equal(summary.payload.status, "valid");
    assert.equal(search.kind, "search_prd");
    assert.ok(search.payload.count > 0);
    assert.ok(Array.isArray(search.payload.results));
  } finally {
    await closeSession(session);
  }
});

test("stdio integration discovers pacs.config.json from MCP roots", async () => {
  const fixture = await createRootDiscoveryFixture("pacs-mcp-root-discovery-");
  const session = await connectProjectRoot(fixture);

  try {
    const summary = parseResourceEnvelope(
      await session.client.readResource({ uri: "prd://summary?mode=full" })
    );
    assert.equal(summary.payload.status, "valid");
    assert.equal(summary.payload.load.artifactName, "prd.json");
    assert.equal(summary.payload.load.artifactPath, fixture.prdPath);
  } finally {
    await closeSession(session);
  }
});

test("bundled plugin MCP works after being copied outside the PACS repository", async () => {
  const fixture = await createRootDiscoveryFixture("pacs-plugin-bundle-project-");
  const cacheRoot = await fs.mkdtemp(path.join(fixture.tempDir, "plugin-cache-"));
  const pluginRoot = path.join(cacheRoot, "pacs-context");
  await fs.cp(path.join(repoRoot, "plugins", "pacs-context"), pluginRoot, {
    recursive: true
  });
  const session = await connectProjectRoot(fixture, {
    args: ["mcp/index.mjs"],
    cwd: pluginRoot
  });

  try {
    const info = parseToolEnvelope(
      await session.client.callTool({
        name: "server_info",
        arguments: { mode: "full" }
      })
    );
    assert.equal(info.payload.repoRoot, fixture.tempDir);
    assert.equal(info.payload.prdPath, fixture.prdPath);
    assert.equal(info.payload.activePrd.status, "valid");
  } finally {
    await closeSession(session);
  }
});

test("stdio integration reports blocked malformed PRDs through focused reads", async () => {
  const session = await connectFixture("malformed_json", "pacs-mcp-integration-blocked-");

  try {
    const summary = parseResourceEnvelope(await session.client.readResource({ uri: "prd://summary?mode=compact" }));
    const info = parseToolEnvelope(
      await session.client.callTool({
        name: "server_info",
        arguments: {
          mode: "compact"
        }
      })
    );

    assert.equal(summary.payload.status, "blocked");
    assert.equal(info.kind, "server_info");
    assert.equal(info.payload.activePrd.status, "blocked");
    assert.ok(info.payload.activePrd.failureReasons.includes("parse_error"));
  } finally {
    await closeSession(session);
  }
});

test("stdio integration surfaces broken trace links and records invalid request failures", async () => {
  const session = await connectFixture("broken_trace_links", "pacs-mcp-integration-broken-");

  try {
    const readiness = parseResourceEnvelope(await session.client.readResource({ uri: "prd://readiness?mode=full" }));
    const trace = parseResourceEnvelope(await session.client.readResource({ uri: "prd://trace/PTW-008?mode=full" }));

    assert.ok(readiness.payload.blockers.some((blocker: string) => blocker.startsWith("traceability:")));
    assert.ok(trace.payload.broken_links.length > 0);
    assert.ok(trace.payload.nodes.some((node: Record<string, unknown>) => node.id === "FR-999" && node.kind === "missing"));

    await assert.rejects(() =>
      session.client.readResource({ uri: "prd://section/not-a-real-section?mode=compact" })
    );
    const invalidEntity = await session.client.callTool({
      name: "get_entity",
      arguments: {
        id: "FR-999",
        mode: "compact"
      }
    });
    assert.equal(invalidEntity.isError, true);
  } finally {
    await closeSession(session);
  }

  const events = await readMetricEvents(session.fixture.metricsPath);
  assert.ok(events.some((event) => event.request.name === "prd-section" && event.outcome.status === "error"));
  assert.ok(events.some((event) => event.request.name === "get_entity" && event.outcome.status === "error"));
});

async function connectFixture(variant: FixtureVariant, prefix: string) {
  const fixture = await createFixture(variant, prefix);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "src/index.ts"],
    cwd: mcpRoot,
    env: {
      ...process.env,
      PACS_PRD_PATH: fixture.prdPath,
      PACS_MCP_METRICS_PATH: fixture.metricsPath
    },
    stderr: "pipe"
  });
  const client = new Client(
    {
      name: "pacs-prd-mcp-test-client",
      version: "0.1.0"
    },
    {
      capabilities: {}
    }
  );

  await client.connect(transport);

  return {
    fixture,
    client,
    transport
  };
}

async function createRootDiscoveryFixture(prefix: string) {
  const fixture = await createFixture("valid", prefix);
  await Promise.all([
    fs.copyFile(path.join(repoRoot, "schema.strict.json"), path.join(fixture.tempDir, "schema.strict.json")),
    fs.copyFile(path.join(repoRoot, "schema.versions.json"), path.join(fixture.tempDir, "schema.versions.json")),
    fs.writeFile(
      path.join(fixture.tempDir, "pacs.config.json"),
      JSON.stringify({
        prd: { path: "prd.json" },
        metrics: { path: "metrics/root-discovery.jsonl" }
      })
    )
  ]);
  return fixture;
}

async function connectProjectRoot(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  launch: { args: string[]; cwd: string } = {
    args: ["--import", "tsx", "src/index.ts"],
    cwd: mcpRoot
  }
) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: launch.args,
    cwd: launch.cwd,
    env: {
      ...process.env,
      PACS_PROJECT_ROOT: undefined,
      PACS_PRD_PATH: undefined,
      PACS_MCP_METRICS_PATH: undefined
    },
    stderr: "pipe"
  });
  const client = new Client(
    {
      name: "pacs-prd-mcp-roots-test-client",
      version: "0.1.0"
    },
    {
      capabilities: {
        roots: {
          listChanged: false
        }
      }
    }
  );
  client.setRequestHandler(ListRootsRequestSchema, async () => ({
    roots: [{ uri: pathToFileURL(fixture.tempDir).href }]
  }));
  await client.connect(transport);

  return {
    fixture,
    client,
    transport
  };
}

async function closeSession(session: {
  client: Client;
  transport: StdioClientTransport;
}) {
  await session.client.close().catch(() => undefined);
  await session.transport.close().catch(() => undefined);
}

function parseResourceEnvelope(result: {
  contents: Array<{
    text?: string;
  }>;
}) {
  const text = result.contents[0]?.text;
  assert.ok(text);
  return JSON.parse(text) as Record<string, any>;
}

function parseToolEnvelope(result: {
  content: Array<{
    type: string;
    text?: string;
  }>;
}) {
  const textItem = result.content.find((item) => item.type === "text");
  assert.ok(textItem?.text);
  return JSON.parse(textItem.text) as Record<string, any>;
}

async function readMetricEvents(metricsPath: string) {
  const text = await fs.readFile(metricsPath, "utf8");
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, any>);
}
