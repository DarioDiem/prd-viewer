import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveConfig } from "./config.js";
import { buildMetricEvent, MetricsRecorder } from "./metrics.js";
import { PrdIndexStore } from "./prd-index.js";
import { PrdLoader } from "./prd-loader.js";
import { wrapResponse } from "./response-modes.js";
import { buildSectionPayload } from "./resources.js";
import { buildAgentPacketResult, searchPrd } from "./tools.js";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const seedPrdPath = path.resolve(repoRoot, "viewer/PRD_web_ui.json");

async function loadState() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prd-mcp-metrics-"));
  const prdPath = path.join(tempDir, "prd.json");
  const metricsPath = path.join(tempDir, "events", "metrics.jsonl");
  const seed = await fs.readFile(seedPrdPath, "utf8");
  await fs.writeFile(prdPath, seed);

  const config = resolveConfig({
    PRD_PATH: prdPath,
    PRD_MCP_METRICS_PATH: metricsPath
  });
  const loader = new PrdLoader(config);
  const indexStore = new PrdIndexStore(loader);
  const [load, index] = await Promise.all([loader.load(), indexStore.load()]);

  return { config, load, index, metricsPath };
}

test("buildMetricEvent redacts free-text inputs and keeps focused response estimates", async () => {
  const { config, load, index } = await loadState();
  const results = searchPrd("FR-012 viewer framework", index, ["project_tracking"], 5);
  const response = wrapResponse(
    "search_prd",
    "compact",
    {
      query: "FR-012 viewer framework",
      count: results.length,
      results
    },
    load.snapshot.file.size
  );

  const event = buildMetricEvent(config, {
    channel: "tool",
    name: "search_prd",
    target: "search_prd",
    requestedMode: "compact",
    input: {
      query: "FR-012 viewer framework",
      sections: ["project_tracking"],
      limit: 5,
      mode: "compact"
    },
    load,
    index,
    response,
    durationMs: 12.4
  });

  const serialized = JSON.stringify(event);
  assert.equal(event.request.input.query_length, 23);
  assert.deepEqual(event.request.input.sections, ["project_tracking"]);
  assert.deepEqual(event.request.input.redacted_fields, ["query"]);
  assert.equal(event.response.kind, "search_prd");
  assert.equal(event.response.mode, "compact");
  assert.equal(event.response.full_document_fallback, false);
  assert.equal(event.source.load_status, "valid");
  assert.ok(event.response.json_bytes !== null);
  assert.ok(!serialized.includes("viewer framework"));
});

test("MetricsRecorder writes JSONL metrics and preserves failure context without payload content", async () => {
  const { config, load, index, metricsPath } = await loadState();
  const recorder = new MetricsRecorder(config);
  const packet = buildAgentPacketResult(load, index, ["FR-012", "PTW-010"], ["project_tracking"], "Draft next task", {
    preset: "review",
    maxTokens: 3000,
    includeUnresolved: false
  });
  const response = wrapResponse("build_agent_packet", "compact", packet, load.snapshot.file.size);

  await recorder.record({
    channel: "tool",
    name: "build_agent_packet",
    target: "build_agent_packet",
    requestedMode: "compact",
    input: {
      ids: ["FR-012", "PTW-010"],
      sections: ["project_tracking"],
      goal: "Draft next task",
      preset: "review",
      max_tokens: 3000,
      include_unresolved: false,
      mode: "compact"
    },
    load,
    index,
    response,
    durationMs: 18.9
  });

  await recorder.record({
    channel: "resource",
    name: "prd-section",
    target: "prd://section/requirements.functional?mode=compact",
    requestedMode: "compact",
    input: {
      sections: ["requirements.functional"],
      mode: "compact"
    },
    load,
    index,
    response: wrapResponse(
      "section",
      "compact",
      buildSectionPayload("requirements.functional", load, index),
      load.snapshot.file.size
    ),
    durationMs: 9.1,
    error: new Error("Section requirements.functional failed to load after invalid parameter retry")
  });

  const lines = (await fs.readFile(metricsPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  const [successEvent, failureEvent] = lines;

  assert.equal(lines.length, 2);
  assert.equal(successEvent.schema, "prd.mcp.metric.v1");
  assert.deepEqual(successEvent.request.input.ids, ["FR-012", "PTW-010"]);
  assert.equal(successEvent.request.input.goal_length, 15);
  assert.equal(successEvent.request.input.preset, "review");
  assert.equal(successEvent.request.input.max_tokens, 3000);
  assert.equal(successEvent.request.input.include_unresolved, false);
  assert.deepEqual(successEvent.request.input.redacted_fields, ["goal"]);
  assert.equal(successEvent.response.kind, "build_agent_packet");
  assert.equal(successEvent.response.packet_preset, "review");
  assert.equal(successEvent.response.packet_max_tokens, 3000);
  assert.equal(successEvent.response.packet_truncated, packet.truncated);
  assert.equal(failureEvent.outcome.status, "error");
  assert.equal(failureEvent.outcome.error_code, "internal_error");
  assert.equal(failureEvent.request.input.sections[0], "requirements.functional");
  assert.ok(!JSON.stringify(lines).includes("Draft next task"));
});
