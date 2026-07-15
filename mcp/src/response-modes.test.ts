import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveConfig } from "./config.js";
import { PrdIndexStore } from "./prd-index.js";
import { PrdLoader } from "./prd-loader.js";
import { wrapResponse } from "./response-modes.js";
import { buildSectionPayload } from "./resources.js";
import { buildAgentPacketResult } from "./tools.js";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const seedPrdPath = path.resolve(repoRoot, "viewer/PRD_web_ui.json");

async function loadState() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pacs-mcp-modes-"));
  const prdPath = path.join(tempDir, "prd.json");
  const seed = await fs.readFile(seedPrdPath, "utf8");
  await fs.writeFile(prdPath, seed);

  const config = resolveConfig({
    PACS_PRD_PATH: prdPath,
    PACS_MCP_METRICS_PATH: path.join(tempDir, "metrics.jsonl")
  });
  const loader = new PrdLoader(config);
  const indexStore = new PrdIndexStore(loader);
  const [load, index] = await Promise.all([loader.load(), indexStore.load()]);

  return { load, index };
}

test("wrapResponse applies compact, standard, and full shapes with estimates", async () => {
  const { load, index } = await loadState();
  const section = buildSectionPayload("requirements.functional", load, index);
  assert.ok(section);

  const compact = wrapResponse("section", "compact", section, load.snapshot.file.size);
  const standard = wrapResponse("section", "standard", section, load.snapshot.file.size);
  const full = wrapResponse("section", "full", section, load.snapshot.file.size);

  assert.equal(compact.mode, "compact");
  assert.equal(standard.mode, "standard");
  assert.equal(full.mode, "full");
  assert.ok(compact.estimates.json_bytes <= standard.estimates.json_bytes);
  assert.ok(standard.estimates.json_bytes <= full.estimates.json_bytes);
  assert.ok(compact.estimates.baseline_document_bytes !== null);
  assert.ok(asRecord(compact.payload)?.sample !== undefined);
  assert.ok(asRecord(standard.payload)?.data !== undefined);
  assert.ok(asRecord(full.payload)?.data !== undefined);
});

test("wrapResponse keeps compact agent packets smaller than full packets", async () => {
  const { load, index } = await loadState();
  const packet = buildAgentPacketResult(load, index, ["FR-012", "PTW-008"], ["requirements.functional"], "compare modes");
  const compact = wrapResponse("build_agent_packet", "compact", packet, load.snapshot.file.size);
  const full = wrapResponse("build_agent_packet", "full", packet, load.snapshot.file.size);

  assert.ok(compact.estimates.json_bytes < full.estimates.json_bytes);
  assert.ok(asRecord(compact.payload)?.counts !== undefined);
  assert.ok(asRecord(full.payload)?.sections !== undefined);
});

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
