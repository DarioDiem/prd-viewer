import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { resolveActiveConfig } from "./active-project.js";

test("resolves PRD and metrics paths from the active MCP project root", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "prd-active-project-"));
  const nestedRoot = path.join(projectRoot, "packages", "app");
  await fs.mkdir(nestedRoot, { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "prd.config.json"),
    JSON.stringify({
      prd: { path: "product/PRD.json" },
      metrics: { path: ".prd/metrics.jsonl" }
    })
  );

  const config = await resolveActiveConfig(
    async () => [pathToFileURL(nestedRoot).href],
    {}
  );

  assert.equal(config.repoRoot, projectRoot);
  assert.equal(config.prdPath, path.join(projectRoot, "product", "PRD.json"));
  assert.equal(config.metricsPath, path.join(projectRoot, ".prd", "metrics.jsonl"));
  assert.equal(config.transport, "stdio");
});

test("keeps explicit PRD environment configuration as a compatibility override", async () => {
  let rootsRequested = false;
  const config = await resolveActiveConfig(
    async () => {
      rootsRequested = true;
      return [];
    },
    {
      PRD_PATH: "/tmp/legacy/PRD.json",
      PRD_MCP_METRICS_PATH: "/tmp/legacy/metrics.jsonl"
    }
  );

  assert.equal(rootsRequested, false);
  assert.equal(config.prdPath, "/tmp/legacy/PRD.json");
  assert.equal(config.metricsPath, "/tmp/legacy/metrics.jsonl");
});

test("fails clearly when the active root is not a PRD project", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "not-prd-project-"));

  await assert.rejects(
    () => resolveActiveConfig(async () => [pathToFileURL(projectRoot).href], {}),
    /No prd\.config\.json was found/
  );
});
