import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { resolveConfig } from "./config.js";
import { startHttpServer, validateHttpRequest } from "./http-server.js";
import { createFixture } from "./test-fixtures.js";

test("validateHttpRequest rejects missing host and non-local origins", () => {
  const config = resolveConfig({
    PACS_MCP_TRANSPORT: "http",
    PACS_MCP_HTTP_PORT: "3334"
  });

  assert.deepEqual(validateHttpRequest({ headers: {} }, config), {
    statusCode: 403,
    message: "Missing Host header"
  });
  assert.deepEqual(
    validateHttpRequest(
      {
        headers: {
          host: "127.0.0.1:3334",
          origin: "http://evil.example"
        }
      },
      config
    ),
    {
      statusCode: 403,
      message: "Invalid Origin: http://evil.example"
    }
  );
});

test("streamable HTTP transport serves focused MCP reads on localhost", async () => {
  const fixture = await createFixture("valid", "pacs-mcp-http-valid-");
  const config = resolveConfig({
    PACS_PRD_PATH: fixture.prdPath,
    PACS_MCP_METRICS_PATH: fixture.metricsPath,
    PACS_MCP_TRANSPORT: "http",
    PACS_MCP_HTTP_PORT: "0"
  });
  const started = await startHttpServer(config);
  const transport = new StreamableHTTPClientTransport(new URL(started.endpointUrl));
  const client = new Client(
    {
      name: "pacs-prd-http-test-client",
      version: "0.1.0"
    },
    {
      capabilities: {}
    }
  );

  try {
    const health = await fetch(started.healthUrl);
    assert.equal(health.status, 200);

    await client.connect(transport);
    const summary = await client.readResource({ uri: "prd://summary?mode=compact" });
    const packet = await client.callTool({
      name: "build_agent_packet",
      arguments: {
        ids: ["FR-012"],
        sections: ["project_tracking"],
        mode: "compact"
      }
    });

    const summaryData = JSON.parse(summary.contents[0]?.text ?? "{}") as Record<string, any>;
    const packetData = JSON.parse(
      packet.content.find((item) => item.type === "text")?.text ?? "{}"
    ) as Record<string, any>;

    assert.equal(summaryData.kind, "summary");
    assert.equal(summaryData.mode, "compact");
    assert.equal(packetData.kind, "build_agent_packet");
    assert.equal(packetData.mode, "compact");
  } finally {
    await client.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
    await started.close().catch(() => undefined);
  }
});

test("streamable HTTP transport rejects non-local origins", async () => {
  const fixture = await createFixture("valid", "pacs-mcp-http-origin-");
  const config = resolveConfig({
    PACS_PRD_PATH: fixture.prdPath,
    PACS_MCP_METRICS_PATH: fixture.metricsPath,
    PACS_MCP_TRANSPORT: "http",
    PACS_MCP_HTTP_PORT: "0"
  });
  const started = await startHttpServer(config);
  const transport = new StreamableHTTPClientTransport(new URL(started.endpointUrl), {
    requestInit: {
      headers: {
        Origin: "http://evil.example"
      }
    }
  });
  const client = new Client(
    {
      name: "pacs-prd-http-origin-client",
      version: "0.1.0"
    },
    {
      capabilities: {}
    }
  );

  try {
    await assert.rejects(() => client.connect(transport));
  } finally {
    await client.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
    await started.close().catch(() => undefined);
  }
});
