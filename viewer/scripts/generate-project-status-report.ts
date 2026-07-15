#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildApprovalReadiness } from "../src/lib/approvalReadiness.ts";
import {
  buildProjectStatusReportHtml,
  slugifyProjectStatusReport
} from "../src/lib/projectStatusReport.ts";
import { checkSchemaCompatibility } from "../src/lib/schemaCompatibility.ts";
import { validatePrdDocument } from "../src/lib/schemaValidation.ts";
import { buildTraceability } from "../src/lib/traceability.ts";
import type { PrdDocument } from "../src/types/prd.ts";

type CliOptions = {
  prdPath: string;
  outDir: string;
  projectName: string | null;
  slug: string | null;
  sourceLabel: string | null;
  allowInvalid: boolean;
};

const options = parseArgs(process.argv.slice(2));
const prdPath = path.resolve(options.prdPath);
const rawPrd = await readFile(prdPath, "utf8");
const prd = JSON.parse(rawPrd) as PrdDocument;
const exportedAt = new Date().toISOString();
const validation = validatePrdDocument(prd, exportedAt);

if (validation.status !== "valid" && !options.allowInvalid) {
  console.error("Cannot generate report: PRD failed strict schema validation.");
  for (const issue of validation.issues.slice(0, 10)) {
    console.error(`- ${issue.path}: ${issue.message}`);
  }
  process.exit(1);
}

const compatibility = checkSchemaCompatibility(prd);
const traceability = buildTraceability(prd);
const readiness = buildApprovalReadiness({
  prd,
  validation,
  compatibility,
  traceability
});
const projectName = options.projectName ?? prd.meta.product_name ?? prd.meta.title ?? "Project status";
const slug = options.slug ?? `${slugifyProjectStatusReport(projectName)}-${exportedAt.slice(0, 10)}`;
const outputDir = path.resolve(options.outDir, slug);
const htmlPath = path.join(outputDir, "index.html");
const metadataPath = path.join(outputDir, "metadata.json");
const sourceLabel = options.sourceLabel ?? path.relative(process.cwd(), prdPath);
const html = buildProjectStatusReportHtml({
  prd,
  sourceLabel,
  reportTitle: projectName,
  exportedAt,
  readiness
});

await mkdir(outputDir, { recursive: true });
await writeFile(htmlPath, html, "utf8");
await writeFile(
  metadataPath,
  `${JSON.stringify(
    {
      schema: "prd.viewer.project-status-report.v1",
      generated_at: exportedAt,
      project_name: projectName,
      slug,
      prd_path: sourceLabel,
      prd_title: prd.meta.title,
      schema_validation_status: validation.status,
      readiness_status: readiness.status,
      blocker_count: readiness.blockerCount,
      warning_count: readiness.warningCount
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(`Report written to ${htmlPath}`);
console.log(`Metadata written to ${metadataPath}`);

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    prdPath: "PRD_web_ui.json",
    outDir: "dist/reports",
    projectName: null,
    slug: null,
    sourceLabel: null,
    allowInvalid: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    switch (arg) {
      case "--prd":
        options.prdPath = requireValue(arg, next);
        index += 1;
        break;
      case "--out-dir":
        options.outDir = requireValue(arg, next);
        index += 1;
        break;
      case "--project-name":
        options.projectName = requireValue(arg, next);
        index += 1;
        break;
      case "--slug":
        options.slug = slugifyProjectStatusReport(requireValue(arg, next));
        index += 1;
        break;
      case "--source-label":
        options.sourceLabel = requireValue(arg, next);
        index += 1;
        break;
      case "--allow-invalid":
        options.allowInvalid = true;
        break;
      case "--help":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function printHelp() {
  console.log(`Usage: npm run report:generate -- [options]

Options:
  --prd <path>             PRD JSON file to render. Defaults to PRD_web_ui.json.
  --out-dir <path>         Parent output directory. Defaults to dist/reports.
  --project-name <name>    Report title shown to readers.
  --slug <slug>            Output slug under the report directory.
  --source-label <label>   Source label rendered in the report.
  --allow-invalid          Generate even when schema validation fails.
`);
}
