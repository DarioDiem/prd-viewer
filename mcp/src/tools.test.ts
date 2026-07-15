import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveConfig } from "./config.js";
import { PrdIndexStore } from "./prd-index.js";
import { PrdLoader } from "./prd-loader.js";
import {
  buildAgentPacketResult,
  getEntityResult,
  getLinkedEntitiesResult,
  listBlockersResult,
  listOpenQuestionsResult,
  listProposedDecisionsResult,
  searchPrd
} from "./tools.js";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const seedPrdPath = path.resolve(repoRoot, "viewer/PRD_web_ui.json");

async function loadState() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prd-mcp-tools-"));
  const prdPath = path.join(tempDir, "prd.json");
  const seed = await fs.readFile(seedPrdPath, "utf8");
  await fs.writeFile(prdPath, seed);

  const config = resolveConfig({
    PRD_PATH: prdPath,
    PRD_MCP_METRICS_PATH: path.join(tempDir, "metrics.jsonl")
  });
  const loader = new PrdLoader(config);
  const indexStore = new PrdIndexStore(loader);
  const [load, index] = await Promise.all([loader.load(), indexStore.load()]);

  return { load, index };
}

test("searches indexed entities and sections", async () => {
  const { index } = await loadState();
  const byId = searchPrd("FR-012", index, [], 5);
  const bySection = searchPrd("project_tracking", index, ["project_tracking"], 10);

  assert.ok(byId.some((result) => result.id === "FR-012" && result.type === "entity"));
  assert.ok(bySection.some((result) => result.type === "section"));
});

test("returns entity and linked-entity views", async () => {
  const { load, index } = await loadState();
  const entity = getEntityResult("PTW-008", load, index);
  const linked = getLinkedEntitiesResult("PTW-008", load, index);

  assert.ok(entity);
  assert.equal(entity?.entity.id, "PTW-008");
  assert.ok(linked);
  assert.ok(linked?.linked_entities.length !== undefined);
  assert.ok(linked?.outbound_links.some((link) => link.target === "PTW-006"));
});

test("lists blockers, unresolved questions, and proposed decisions", async () => {
  const { load, index } = await loadState();
  const blockers = listBlockersResult(load, index);
  const openQuestions = listOpenQuestionsResult(load);
  const proposedDecisions = listProposedDecisionsResult(load);

  assert.ok(blockers.count > 0);
  assert.ok(openQuestions.count > 0);
  assert.ok(proposedDecisions.count > 0);
});

test("builds a compact default agent packet from ids and sections", async () => {
  const { load, index } = await loadState();
  const packet = buildAgentPacketResult(
    load,
    index,
    ["FR-012", "PTW-008"],
    ["project_tracking.pending_work", "requirements.functional"],
    "Plan the next MCP implementation step"
  );

  assert.equal(packet.schema, "prd.agent-packet.v2");
  assert.equal(packet.goal, "Plan the next MCP implementation step");
  assert.equal(packet.selected_ids.length, 2);
  assert.equal(packet.selected_sections.length, 2);
  assert.ok(packet.entities.length > 0);
  assert.ok(packet.entities.length + packet.sections.length + packet.traces.length > 0);
  assert.equal(packet.include_unresolved, false);
  assert.equal(packet.unresolved.blockers.length, 0);
  assert.ok(packet.estimated_tokens <= packet.max_tokens);
});

test("enforces packet budgets and task presets", async () => {
  const { load, index } = await loadState();
  const packet = buildAgentPacketResult(
    load,
    index,
    ["FR-012", "PTW-008"],
    ["requirements.functional", "project_tracking.pending_work"],
    "Review the selected work",
    { preset: "review", maxTokens: 700 }
  );

  assert.equal(packet.preset, "review");
  assert.equal(packet.include_unresolved, true);
  assert.ok(packet.estimated_tokens <= 700);
  assert.equal(packet.truncated, true);
});
