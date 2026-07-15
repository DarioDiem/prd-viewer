import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveConfig } from "./config.js";
import { PrdLoader } from "./prd-loader.js";
import { createFixture, loadSeedPrd } from "./test-fixtures.js";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("loads a valid PRD and reuses the cache until the file changes", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pacs-mcp-loader-"));
  const prdPath = path.join(tempDir, "prd.json");
  const seed = await loadSeedPrd();

  await fs.writeFile(prdPath, JSON.stringify(seed, null, 2));

  const loader = new PrdLoader(
    resolveConfig({
      PACS_PRD_PATH: prdPath,
      PACS_MCP_METRICS_PATH: path.join(tempDir, "metrics.jsonl")
    })
  );

  const first = await loader.load();
  assert.equal(first.snapshot.status, "valid");
  assert.equal(first.snapshot.cacheState, "cold");
  assert.equal(first.snapshot.summary?.title, "PRD Reviewer Local/Web UI");
  assert.equal(first.snapshot.validation.status, "valid");

  const second = await loader.load();
  assert.equal(second.snapshot.status, "valid");
  assert.equal(second.snapshot.cacheState, "hit");
  assert.equal(second.snapshot.file.sha256, first.snapshot.file.sha256);

  const updated = structuredClone(seed);
  (updated.meta as Record<string, unknown>).title = "Updated MCP Fixture";
  (updated.meta as Record<string, unknown>).updated_at = "2026-05-04T12:00:00Z";
  await fs.writeFile(prdPath, JSON.stringify(updated, null, 2));

  const third = await loader.load();
  assert.equal(third.snapshot.status, "valid");
  assert.equal(third.snapshot.cacheState, "reloaded");
  assert.equal(third.snapshot.summary?.title, "Updated MCP Fixture");
});

test("blocks malformed JSON files", async () => {
  const fixture = await createFixture("malformed_json", "pacs-mcp-loader-");

  const loader = new PrdLoader(
    resolveConfig({
      PACS_PRD_PATH: fixture.prdPath,
      PACS_MCP_METRICS_PATH: fixture.metricsPath
    })
  );

  const result = await loader.load();
  assert.equal(result.snapshot.status, "blocked");
  assert.deepEqual(result.snapshot.failureReasons, ["parse_error"]);
  assert.equal(result.snapshot.validation.status, "invalid");
});

test("blocks schema-invalid PRDs", async () => {
  const fixture = await createFixture("schema_invalid", "pacs-mcp-loader-");

  const loader = new PrdLoader(
    resolveConfig({
      PACS_PRD_PATH: fixture.prdPath,
      PACS_MCP_METRICS_PATH: fixture.metricsPath
    })
  );

  const result = await loader.load();
  assert.equal(result.snapshot.status, "blocked");
  assert.ok(result.snapshot.failureReasons.includes("schema_invalid"));
  assert.equal(result.snapshot.validation.status, "invalid");
});

test("blocks PRDs with required extensions the server does not support yet", async () => {
  const fixture = await createFixture("required_extension", "pacs-mcp-loader-");

  const loader = new PrdLoader(
    resolveConfig({
      PACS_PRD_PATH: fixture.prdPath,
      PACS_MCP_METRICS_PATH: fixture.metricsPath
    })
  );

  const result = await loader.load();
  assert.equal(result.snapshot.status, "blocked");
  assert.ok(result.snapshot.failureReasons.includes("required_extension"));
});

test("blocks PRDs with unknown schema versions", async () => {
  const fixture = await createFixture("unsupported_schema_version", "pacs-mcp-loader-");

  const loader = new PrdLoader(
    resolveConfig({
      PACS_PRD_PATH: fixture.prdPath,
      PACS_MCP_METRICS_PATH: fixture.metricsPath
    })
  );

  const result = await loader.load();
  assert.equal(result.snapshot.status, "blocked");
  assert.ok(result.snapshot.failureReasons.includes("unknown_schema_version"));
});
