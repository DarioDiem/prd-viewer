import { describe, expect, it } from "vitest";
import seedPrd from "../../PRD_web_ui.json";
import { buildApprovalReadiness } from "./approvalReadiness";
import {
  buildProjectStatusReportFilename,
  buildProjectStatusReportHtml
} from "./projectStatusReport";
import { checkSchemaCompatibility } from "./schemaCompatibility";
import { validatePrdDocument } from "./schemaValidation";
import { buildTraceability } from "./traceability";
import type { PrdDocument } from "../types/prd";

describe("projectStatusReport", () => {
  it("builds a standalone html project status report without maintainer panels", () => {
    const prd = seedPrd as PrdDocument;
    const validation = validatePrdDocument(prd, "2026-06-03T18:00:00Z");
    const compatibility = checkSchemaCompatibility(prd);
    const traceability = buildTraceability(prd);
    const readiness = buildApprovalReadiness({
      prd,
      validation,
      compatibility,
      traceability
    });

    const html = buildProjectStatusReportHtml({
      prd,
      sourceLabel: "viewer/PRD_web_ui.json",
      reportTitle: "Acme Program Status",
      exportedAt: "2026-06-03T18:05:00Z",
      readiness
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Acme Program Status");
    expect(html).toContain('class="report-sidebar"');
    expect(html).toContain('aria-label="Report navigation"');
    expect(html).toContain('href="#tracking"');
    expect(html).toContain("Approval readiness");
    expect(html).toContain("Project tracking");
    expect(html).toContain("Open questions");
    expect(html).toContain("Proposed decisions");
    expect(html).not.toContain("<h3>Section editor</h3>");
    expect(html).not.toContain("<h2>Schema validation</h2>");
    expect(html).not.toContain("<h2>Schema compatibility</h2>");
    expect(html).not.toContain("<h3>Diagnostics</h3>");
    expect(html).not.toContain("Workspace actions");
  });

  it("builds stable html filenames from the requested report title", () => {
    expect(buildProjectStatusReportFilename("Acme Program Status", "2026-06-03T18:05:00Z")).toBe(
      "project-status-acme-program-status-2026-06-03.html"
    );
  });
});
