import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveConfig } from "./config.js";
import { PrdIndexStore } from "./prd-index.js";
import { PrdLoader } from "./prd-loader.js";
import {
  buildCompatibilityPayload,
  buildEntityPayload,
  buildProjectTrackingPayload,
  buildReadinessPayload,
  buildSectionPayload,
  buildSummaryPayload,
  buildTracePayload,
  listAvailableSectionNames
} from "./resources.js";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const seedPrdPath = path.resolve(repoRoot, "viewer/PRD_web_ui.json");

async function loadIndexResult() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prd-mcp-resources-"));
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

test("builds compact summary, compatibility, readiness, and project tracking payloads", async () => {
  const { load, index } = await loadIndexResult();
  const summary = buildSummaryPayload(load, index);
  const compatibility = buildCompatibilityPayload(load);
  const readiness = buildReadinessPayload(load, index);
  const projectTracking = buildProjectTrackingPayload(load, index);

  assert.equal(summary.status, "valid");
  assert.equal(summary.summary?.title, "PRD Reviewer Local/Web UI");
  assert.equal(compatibility.compatibility?.status, "exact");
  assert.ok(["ready", "warnings", "blocked"].includes(readiness.status));
  assert.equal(projectTracking.summary.status, "in_progress");
  assert.ok(projectTracking.counts.pending_work > 0);
});

test("builds section, entity, and trace payloads for focused reads", async () => {
  const { load, index } = await loadIndexResult();
  const section = buildSectionPayload("project_tracking.pending_work", load, index);
  const entity = buildEntityPayload("PTW-008", load, index);
  const trace = buildTracePayload("PTW-008", index);

  assert.ok(section);
  assert.equal(section?.section, "project_tracking.pending_work");
  assert.ok(Array.isArray(section?.data));
  assert.ok(entity);
  assert.equal(entity?.entity.id, "PTW-008");
  assert.ok(Array.isArray(entity?.outbound_links));
  assert.ok(trace);
  assert.equal(trace?.selected_entity.id, "PTW-008");
  assert.ok(trace?.outbound_count !== undefined);
});

test("lists available section names including top-level and nested aliases", () => {
  const names = listAvailableSectionNames();

  assert.ok(names.includes("requirements"));
  assert.ok(names.includes("requirements.functional"));
  assert.ok(names.includes("project_tracking"));
  assert.ok(names.includes("project_tracking.pending_work"));
});
