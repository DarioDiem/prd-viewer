import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { resolveActiveConfig } from "./active-project.js";

test("resolves PRD and metrics paths from the active MCP project root", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pacs-active-project-"));
  const nestedRoot = path.join(projectRoot, "packages", "app");
  await fs.mkdir(nestedRoot, { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "pacs.config.json"),
    JSON.stringify({
      prd: { path: "product/PRD.json" },
      metrics: { path: ".pacs/metrics.jsonl" }
    })
  );

  const config = await resolveActiveConfig(
    async () => [pathToFileURL(nestedRoot).href],
    {}
  );

  assert.equal(config.repoRoot, projectRoot);
  assert.equal(config.prdPath, path.join(projectRoot, "product", "PRD.json"));
  assert.equal(config.metricsPath, path.join(projectRoot, ".pacs", "metrics.jsonl"));
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
      PACS_PRD_PATH: "/tmp/legacy/PRD.json",
      PACS_MCP_METRICS_PATH: "/tmp/legacy/metrics.jsonl"
    }
  );

  assert.equal(rootsRequested, false);
  assert.equal(config.prdPath, "/tmp/legacy/PRD.json");
  assert.equal(config.metricsPath, "/tmp/legacy/metrics.jsonl");
});

test("fails clearly when the active root is not a PACS project", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "not-pacs-project-"));

  await assert.rejects(
    () => resolveActiveConfig(async () => [pathToFileURL(projectRoot).href], {}),
    /No pacs\.config\.json was found/
  );
});
