import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { expect, test } from "@playwright/test";
import { largePrdFixture, serializePrdFixture } from "../../src/test/prdFixtures";

const seedPrdPath = fileURLToPath(new URL("../../PRD_web_ui.json", import.meta.url));

test("loads the read-only PRD dashboard", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "PRD Viewer" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "PRD Reviewer Local/Web UI" })).toBeVisible();
  await expect(page.getByRole("button", { name: "View Functional requirements" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schema validation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schema compatibility" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Traceability matrix" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Traceability graph" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Focused node" })).toHaveValue("FR-005");
  await expect(page.getByRole("button", { name: "Export trace" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Export snapshot" })).toBeEnabled();
  await expect(page.getByText("Loaded PRD matches schema.strict.json.")).toBeVisible();
  await expect(page.getByText("Loaded PRD is compatible with the current schema manifest.")).toBeVisible();
  await expect(page.getByText("All derived story, decision, dependency, and persona links resolve to known PRD IDs.")).toBeVisible();
  await expect(page.getByText("FR-001").first()).toBeVisible();
  await expect(page.getByText("US-003").first()).toBeVisible();
  await expect(page.getByText("DEC-007").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open canonical PRD in browser" })).toBeVisible();
});

test("focuses the traceability graph and exports the selected trace summary", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("combobox", { name: "Focused node" }).selectOption("US-003");

  await expect(page.getByText("Focused node: US-003")).toBeVisible();
  await expect(page.getByText("FR-005").last()).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export trace" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();

  expect(download.suggestedFilename()).toBe("trace-summary-US-003.json");
  expect(downloadPath).toBeTruthy();

  const bundle = JSON.parse(readFileSync(downloadPath ?? "", "utf8")) as {
    schema: string;
    selected_node_id: string;
    nodes: Array<{ id: string }>;
  };

  expect(bundle.schema).toBe("pacs.trace-summary.v1");
  expect(bundle.selected_node_id).toBe("US-003");
  expect(bundle.nodes).toContainEqual(expect.objectContaining({ id: "FR-005" }));
  expect(bundle.nodes).toContainEqual(expect.objectContaining({ id: "FR-007" }));
});

test("exports a read-only review snapshot", async ({ page }) => {
  await page.goto("/");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export snapshot" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();

  expect(download.suggestedFilename()).toMatch(/^prd-review-snapshot-prd-reviewer-ui-\d{4}-\d{2}-\d{2}\.json$/);
  expect(downloadPath).toBeTruthy();

  const snapshot = JSON.parse(readFileSync(downloadPath ?? "", "utf8")) as {
    schema: string;
    source: { title: string };
    validation: { status: string };
    readiness: {
      status: string;
      blocker_count: number;
      signals: Array<{ category: string; severity: string; sourceId: string | null }>;
    };
    traceability: { counts: { requirements: number } };
  };

  expect(snapshot.schema).toBe("pacs.review-snapshot.v2");
  expect(snapshot.source.title).toBe("PRD Reviewer Local/Web UI");
  expect(snapshot.validation.status).toBe("valid");
  expect(snapshot.readiness.status).toBe("blocked");
  expect(snapshot.readiness.blocker_count).toBeGreaterThan(0);
  expect(snapshot.readiness.signals).toContainEqual(
    expect.objectContaining({
      category: "open_questions",
      severity: "blocker",
      sourceId: "Q-001"
    })
  );
  expect(snapshot.traceability.counts.requirements).toBeGreaterThan(0);
});

test("navigates between PRD sections", async ({ page }) => {
  await page.goto("/");
  const sectionNav = page.getByRole("navigation", { name: "PRD section navigation" });

  await sectionNav.getByRole("button", { name: /Questions/i }).click();

  await expect(page.locator("#selected-section-panel").getByRole("heading", { name: "Questions", exact: true })).toBeVisible();
  await expect(page.getByText(/Unresolved product, engineering, compliance/)).toBeVisible();
  await expect(page.getByText("Q-001").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /target launch date and pilot cohort/i })).toBeVisible();
});

test("navigates from dashboard signals to their target sections", async ({ page }) => {
  await page.goto("/");
  const sectionNav = page.getByRole("navigation", { name: "PRD section navigation" });

  await page.getByRole("button", { name: "View Open questions" }).click();

  await expect(page.locator("#selected-section-panel").getByRole("heading", { name: "Questions", exact: true })).toBeVisible();
  await expect(sectionNav.getByRole("button", { name: /Questions/i })).toHaveClass(/is-active/);

  await page.getByRole("button", { name: /Q-001 is open/i }).click();

  await expect(page.getByText("Q-001").first()).toBeVisible();
  await expect(sectionNav.getByRole("button", { name: /Questions/i })).toHaveClass(/is-active/);
});

test("reruns schema validation from the workspace action", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Validate" }).click();

  await expect(page.getByRole("heading", { name: "Schema validation" })).toBeVisible();
  await expect(page.getByText("Loaded PRD matches schema.strict.json.")).toBeVisible();
});

test("opens a valid local PRD file and refreshes the dashboard", async ({ page }) => {
  const uploadedPrd = JSON.parse(readFileSync(seedPrdPath, "utf8")) as {
    meta: {
      title: string;
      summary: string;
    };
  };
  uploadedPrd.meta.title = "Uploaded PRD";
  uploadedPrd.meta.summary = "Uploaded through Playwright.";

  await page.goto("/");

  await page.getByLabel("Open PRD").setInputFiles({
    name: "uploaded-prd.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(uploadedPrd))
  });

  await expect(page.getByRole("heading", { name: "Uploaded PRD" })).toBeVisible();
  await expect(page.getByText("uploaded-prd.json").first()).toBeVisible();
  await expect(page.getByText("Loaded PRD matches schema.strict.json.")).toBeVisible();
  await expect(page.getByText("Loaded PRD is compatible with the current schema manifest.")).toBeVisible();
});

test("shows malformed local PRD file errors without replacing the loaded document", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Open PRD").setInputFiles({
    name: "broken-prd.json",
    mimeType: "application/json",
    buffer: Buffer.from("{")
  });

  await expect(page.getByRole("heading", { name: "PRD Reviewer Local/Web UI" })).toBeVisible();
  await expect(page.getByText("broken-prd.json").first()).toBeVisible();
  await expect(page.locator("#validation-panel").getByText(/Unable to parse JSON/)).toBeVisible();
});

test("loads and navigates a representative large PRD within smoke thresholds", async ({ page }) => {
  const largePrd = largePrdFixture();

  await page.goto("/");

  const loadStartedAt = Date.now();

  await page.getByLabel("Open PRD").setInputFiles({
    name: "large-prd.json",
    mimeType: "application/json",
    buffer: Buffer.from(serializePrdFixture(largePrd))
  });

  await expect(page.getByRole("heading", { name: "Large PRD Fixture" })).toBeVisible();
  await expect(page.getByText("large-prd.json").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "View Functional requirements" })).toContainText("120");
  expect(Date.now() - loadStartedAt).toBeLessThan(10_000);

  const navigationStartedAt = Date.now();

  await page.getByRole("button", { name: "View User stories" }).click();
  await expect(page.locator("#selected-section-panel").getByRole("heading", { name: "Stories", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View Trace links" }).click();
  await expect(page.locator("#traceability-panel")).toBeFocused();
  await expect(page.getByRole("combobox", { name: "Focused node" })).toBeVisible();
  expect(Date.now() - navigationStartedAt).toBeLessThan(5_000);
});

test("supports keyboard accessibility for navigation, status messages, readiness, and trace views", async ({ page }) => {
  await page.goto("/");

  const sectionNav = page.getByRole("navigation", { name: "PRD section navigation" });
  await expect(sectionNav.getByRole("button", { name: /Requirements/i })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "View Open questions" }).focus();
  await page.keyboard.press("Enter");

  await expect(page.locator("#selected-section-panel")).toBeFocused();
  await expect(page.locator("#selected-section-panel").getByRole("heading", { name: "Questions", exact: true })).toBeVisible();
  await expect(sectionNav.getByRole("button", { name: /Questions/i })).toHaveAttribute("aria-current", "page");

  const readinessSignal = page.getByRole("button", { name: /View readiness signal: Q-001 is open/i });
  await readinessSignal.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator("#selected-section-panel")).toBeFocused();
  await expect(page.locator("#selected-section-panel").getByRole("heading", { name: "Questions", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "View Trace links" }).focus();
  await page.keyboard.press("Enter");

  await expect(page.locator("#traceability-panel")).toBeFocused();
  await expect(page.getByRole("group", { name: "Traceability relationship graph" })).toBeVisible();
  await expect(page.getByLabel("Focused trace details")).toContainText("Focused node: FR-005");

  await page.getByRole("combobox", { name: "Focused node" }).selectOption("US-003");
  await expect(page.getByLabel("Focused trace details")).toContainText("Focused node: US-003");

  await page.getByRole("button", { name: "Section editor" }).click();
  await page.getByLabel("Section JSON editor").fill("{");
  await page.getByRole("button", { name: "Apply section" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Section JSON is invalid/ })).toBeVisible();
});
