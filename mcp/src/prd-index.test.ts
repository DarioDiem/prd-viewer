import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveConfig } from "./config.js";
import { PrdIndexStore, buildPrdIndex } from "./prd-index.js";
import { PrdLoader } from "./prd-loader.js";
import { createFixture, loadSeedPrd } from "./test-fixtures.js";

test("builds section, entity, and link indexes for a valid PRD", async () => {
  const seed = await loadSeedPrd();
  const index = buildPrdIndex(seed);
  const requirement = index.entityById.get("FR-012");
  const workItem = index.entityById.get("PTW-007");
  const linkedToRequirement = index.inboundById.get("FR-012") ?? [];
  const projectTrackingLinks = index.outboundById.get("PTW-007") ?? [];

  assert.ok(requirement);
  assert.equal(requirement?.kind, "functional_requirement");
  assert.ok(workItem);
  assert.equal(workItem?.kind, "work_item");
  assert.ok(index.sections.some((section) => section.key === "requirements.functional" && section.count > 0));
  assert.ok(index.sections.some((section) => section.key === "project_tracking.pending_work" && section.count > 0));
  assert.ok(linkedToRequirement.some((link) => link.kind === "story_requirement" || link.kind === "project_tracking_link"));
  assert.ok(projectTrackingLinks.some((link) => link.target === "PTW-006"));
});

test("tracks broken links without failing the index build", async () => {
  const fixture = await createFixture("broken_trace_links", "prd-mcp-index-");
  const seed = JSON.parse(await fs.readFile(fixture.prdPath, "utf8")) as Record<string, unknown>;

  const index = buildPrdIndex(seed);
  assert.ok(index.brokenLinks.some((link) => link.target === "FR-999"));
});

test("reuses the cached index until the source file changes", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prd-mcp-index-"));
  const prdPath = path.join(tempDir, "prd.json");
  const seed = await loadSeedPrd();
  await fs.writeFile(prdPath, JSON.stringify(seed, null, 2));

  const config = resolveConfig({
    PRD_PATH: prdPath,
    PRD_MCP_METRICS_PATH: path.join(tempDir, "metrics.jsonl")
  });
  const store = new PrdIndexStore(new PrdLoader(config));

  const first = await store.load();
  assert.equal(first.snapshot.status, "ready");
  assert.equal(first.snapshot.cacheState, "cold");

  const second = await store.load();
  assert.equal(second.snapshot.status, "ready");
  assert.equal(second.snapshot.cacheState, "hit");

  const updated = structuredClone(seed);
  (updated.meta as Record<string, unknown>).title = "Reloaded Index Fixture";
  await fs.writeFile(prdPath, JSON.stringify(updated, null, 2));

  const third = await store.load();
  assert.equal(third.snapshot.status, "ready");
  assert.equal(third.snapshot.cacheState, "reloaded");
});

test("blocks the index when the loader blocks the PRD", async () => {
  const fixture = await createFixture("schema_invalid", "prd-mcp-index-");

  const config = resolveConfig({
    PRD_PATH: fixture.prdPath,
    PRD_MCP_METRICS_PATH: fixture.metricsPath
  });
  const store = new PrdIndexStore(new PrdLoader(config));
  const result = await store.load();

  assert.equal(result.snapshot.status, "blocked");
  assert.equal(result.index, null);
});
