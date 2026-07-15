import { buildPrdSummary } from "./prdSummary";
import type { ApprovalReadiness } from "./approvalReadiness";
import type { PrdDocument } from "../types/prd";

export type ProjectStatusReportInput = {
  prd: PrdDocument;
  sourceLabel: string;
  reportTitle: string;
  exportedAt: string;
  readiness: ApprovalReadiness;
};

export function buildProjectStatusReportHtml({
  prd,
  sourceLabel,
  reportTitle,
  exportedAt,
  readiness
}: ProjectStatusReportInput): string {
  const summary = buildPrdSummary(prd, sourceLabel);
  const unresolvedQuestions = prd.open_questions.filter((question) => question.status !== "resolved");
  const proposedDecisions = prd.decisions.filter((decision) => decision.status === "proposed");
  const highRisks = prd.risks.filter((risk) => risk.score >= 6);
  const activeBlockers = prd.project_tracking.blockers.filter((blocker) => blocker.status === "active");
  const visibleSections = summary.sections.filter((section) =>
    !["meta", "problem", "goals", "assumptions", "personas"].includes(section.key)
  );
  const reportDate = new Date(exportedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
  const reportDay = exportedAt.slice(0, 10);
  const readinessTone =
    readiness.status === "blocked" ? "danger" : readiness.status === "warnings" ? "warning" : "success";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(reportTitle)} - Project Status</title>
    <style>
      :root {
        color-scheme: light;
        --page: #f5f7f4;
        --surface: #ffffff;
        --surface-muted: #eef2ed;
        --rail: #10231a;
        --rail-muted: #b8c8bd;
        --rail-border: rgba(255, 255, 255, 0.12);
        --line: #d8ded5;
        --text: #172019;
        --muted: #657064;
        --accent: #a77813;
        --danger: #b84a3a;
        --warning: #b87518;
        --success: #347354;
        --shadow: 0 16px 48px rgba(16, 35, 26, 0.08);
      }
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: var(--page);
        color: var(--text);
        line-height: 1.5;
      }
      a { color: inherit; }
      h1, h2, h3, h4, p { margin: 0; }
      .report-shell {
        display: grid;
        grid-template-columns: 280px minmax(0, 1fr);
        min-height: 100vh;
      }
      .report-sidebar {
        position: sticky;
        top: 0;
        align-self: start;
        height: 100vh;
        padding: 28px 24px;
        background: var(--rail);
        color: #f7fbf5;
        overflow: auto;
      }
      .brand-mark {
        color: #d3a837;
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .report-sidebar h1 {
        margin-top: 10px;
        font-size: 34px;
        line-height: 1.04;
      }
      .report-sidebar p {
        margin-top: 10px;
        color: var(--rail-muted);
      }
      .sidebar-facts {
        display: grid;
        gap: 10px;
        margin: 18px 0 0;
      }
      .sidebar-fact {
        padding: 12px;
        border: 1px solid var(--rail-border);
        border-radius: 8px;
      }
      .sidebar-fact span {
        display: block;
        color: var(--rail-muted);
        font-size: 12px;
        text-transform: uppercase;
      }
      .sidebar-fact strong {
        display: block;
        margin-top: 6px;
        overflow-wrap: anywhere;
      }
      .report-nav {
        display: grid;
        gap: 4px;
        margin-top: 18px;
        padding-top: 8px;
        border-top: 1px solid var(--rail-border);
      }
      .report-nav a {
        display: flex;
        min-height: 38px;
        align-items: center;
        border-radius: 8px;
        padding: 8px 10px;
        color: #f7fbf5;
        font-weight: 650;
        text-decoration: none;
      }
      .report-nav a:hover,
      .report-nav a:focus-visible {
        background: rgba(255, 255, 255, 0.1);
        outline: none;
      }
      .report-main {
        width: min(1160px, 100%);
        padding: 32px 32px 56px;
      }
      .report-header,
      .section-panel {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 8px;
        box-shadow: var(--shadow);
      }
      .report-header {
        padding: 28px;
      }
      .eyebrow {
        color: var(--accent);
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .report-header h2 {
        margin-top: 8px;
        font-size: 40px;
        line-height: 1.08;
      }
      .report-header p {
        margin-top: 10px;
        max-width: 78ch;
        color: var(--muted);
        font-size: 17px;
      }
      .section-panel {
        margin-top: 18px;
        padding: 22px;
        scroll-margin-top: 24px;
      }
      .section-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }
      .section-heading h2 {
        margin-top: 4px;
        font-size: 25px;
        line-height: 1.15;
      }
      .section-heading p {
        margin-top: 6px;
        max-width: 70ch;
        color: var(--muted);
      }
      .status-pill {
        display: inline-flex;
        min-height: 30px;
        align-items: center;
        border-radius: 999px;
        padding: 5px 11px;
        font-size: 13px;
        font-weight: 800;
        text-transform: capitalize;
        white-space: nowrap;
      }
      .status-danger { background: rgba(184, 74, 58, 0.14); color: var(--danger); }
      .status-warning { background: rgba(184, 117, 24, 0.16); color: var(--warning); }
      .status-success { background: rgba(52, 115, 84, 0.14); color: var(--success); }
      .status-neutral { background: rgba(101, 112, 100, 0.14); color: var(--muted); }
      .stat-grid,
      .fact-grid,
      .split-grid,
      .section-grid,
      .list-grid {
        display: grid;
        gap: 12px;
      }
      .stat-grid {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      }
      .fact-grid {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        margin-bottom: 16px;
      }
      .split-grid {
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }
      .section-grid,
      .list-grid {
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }
      .stat-card,
      .fact-card,
      .list-item,
      .section-card {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface-muted);
        padding: 14px 16px;
      }
      .stat-card strong,
      .fact-card dt {
        display: block;
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .stat-card span {
        display: block;
        margin-top: 8px;
        font-size: 34px;
        font-weight: 800;
        line-height: 1;
      }
      .fact-card {
        margin: 0;
      }
      .fact-card dd {
        margin: 8px 0 0;
        font-size: 26px;
        font-weight: 800;
        line-height: 1.05;
      }
      .list-item h4,
      .section-card h4 {
        font-size: 17px;
        line-height: 1.25;
      }
      .list-item p,
      .section-card p {
        margin-top: 9px;
        color: var(--muted);
      }
      .meta-line {
        display: inline-block;
        margin-top: 10px;
        color: var(--accent);
        font-size: 13px;
        font-weight: 750;
        text-transform: capitalize;
      }
      .empty {
        color: var(--muted);
        font-style: italic;
      }
      .readiness-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .readiness-list li {
        border-top: 1px solid var(--line);
        padding: 11px 0;
      }
      .readiness-list li:first-child {
        border-top: 0;
        padding-top: 0;
      }
      .readiness-list strong {
        display: block;
      }
      footer {
        margin-top: 18px;
        color: var(--muted);
        font-size: 13px;
      }
      @media (max-width: 860px) {
        .report-shell {
          grid-template-columns: 1fr;
        }
        .report-sidebar {
          position: static;
          height: auto;
        }
        .report-nav {
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        }
        .report-main {
          padding: 18px 14px 40px;
        }
        .report-header h2 {
          font-size: 32px;
        }
      }
      @media print {
        body { background: #ffffff; }
        .report-shell { display: block; }
        .report-sidebar {
          position: static;
          height: auto;
          color: var(--text);
          background: #ffffff;
          border-bottom: 1px solid var(--line);
        }
        .report-nav { display: none; }
        .report-main { width: auto; padding: 20px 0; }
        .report-header,
        .section-panel {
          box-shadow: none;
          break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>
    <div class="report-shell">
      <aside class="report-sidebar" aria-label="Report navigation">
        <span class="brand-mark">Standalone Project Status</span>
        <h1>${escapeHtml(reportTitle)}</h1>
        <p>${escapeHtml(summary.subtitle)}</p>
        <nav class="report-nav" aria-label="Report sections">
          <a href="#overview">Overview</a>
          <a href="#readiness">Readiness</a>
          <a href="#tracking">Project tracking</a>
          <a href="#sections">Sections</a>
          <a href="#risks">Risks</a>
          <a href="#questions">Questions</a>
          <a href="#decisions">Decisions</a>
        </nav>
        <div class="sidebar-facts" aria-label="Report facts">
          ${sidebarFact("Lifecycle", summary.lifecycle)}
          ${sidebarFact("Readiness", readiness.status)}
          ${sidebarFact("Source", summary.sourceLabel)}
          ${sidebarFact("Generated", reportDay)}
        </div>
      </aside>

      <main class="report-main">
        <header class="report-header">
          <span class="eyebrow">Project report</span>
          <h2>${escapeHtml(reportTitle)}</h2>
          <p>${escapeHtml(summary.subtitle)}</p>
        </header>

        <section id="overview" class="section-panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Overview</span>
              <h2>Status summary</h2>
            </div>
            ${statusPill(readinessTone, readiness.status)}
          </div>
          <div class="stat-grid">
            ${statCard("Functional requirements", String(summary.metrics.functionalRequirements))}
            ${statCard("User stories", String(summary.metrics.userStories))}
            ${statCard("Tracking work", String(summary.metrics.projectTrackingPendingWork))}
            ${statCard("Tracking issues", String(summary.metrics.projectTrackingIssues))}
            ${statCard("Tracking blockers", String(summary.metrics.projectTrackingBlockers))}
            ${statCard("Open questions", String(summary.metrics.openQuestions))}
            ${statCard("Decisions", String(summary.metrics.decisions))}
            ${statCard("Risks", String(summary.metrics.risks))}
          </div>
        </section>

        <section id="readiness" class="section-panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Readiness</span>
              <h2>Approval readiness</h2>
              <p>Status signals that still need review or resolution.</p>
            </div>
            ${statusPill(readinessTone, readiness.status)}
          </div>
          <div class="fact-grid">
            ${factCard("Blockers", String(readiness.blockerCount))}
            ${factCard("Warnings", String(readiness.warningCount))}
            ${factCard("Checked", readiness.checkedAt ? new Date(readiness.checkedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "Not run")}
          </div>
          ${
            readiness.signals.length > 0
              ? `<ul class="readiness-list">
                  ${readiness.signals.slice(0, 10).map((signal) => `<li><strong>${escapeHtml(signal.message)}</strong><span class="meta-line">${escapeHtml([signal.severity, signal.category.replace(/_/g, " "), signal.sourceId ?? signal.sourceSection].join(" / "))}</span></li>`).join("")}
                </ul>`
              : `<p class="empty">No readiness blockers or warnings are recorded.</p>`
          }
        </section>

        <section id="tracking" class="section-panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Execution</span>
              <h2>Project tracking</h2>
              <p>${escapeHtml(prd.project_tracking.summary ?? "No project tracking summary recorded.")}</p>
            </div>
            ${statusPill(projectTrackingTone(prd), prd.project_tracking.status.replace(/_/g, " "))}
          </div>
          <div class="fact-grid">
            ${factCard("Pending work", String(prd.project_tracking.pending_work.length))}
            ${factCard("Issues", String(prd.project_tracking.issues_found.length))}
            ${factCard("Active blockers", String(activeBlockers.length))}
            ${factCard("Notes", String(prd.project_tracking.notes.length))}
          </div>
          <div class="split-grid">
            ${renderListBlock("Blockers", activeBlockers.map((blocker) => ({
              title: `${blocker.blocker_id} ${blocker.title}`,
              summary: blocker.unblock_criteria,
              meta: `${blocker.severity} / ${blocker.status}`
            })))}
            ${renderListBlock("Pending work", prd.project_tracking.pending_work.slice(0, 6).map((item) => ({
              title: `${item.work_item_id} ${item.title}`,
              summary: item.description,
              meta: `${item.priority} / ${item.status}`
            })))}
            ${renderListBlock("Issues found", prd.project_tracking.issues_found.slice(0, 6).map((issue) => ({
              title: `${issue.issue_id} ${issue.title}`,
              summary: issue.description,
              meta: `${issue.severity} / ${issue.status}`
            })))}
          </div>
        </section>

        <section id="sections" class="section-panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Sections</span>
              <h2>Section overview</h2>
              <p>Counts and status summaries for the reviewable project sections.</p>
            </div>
          </div>
          <div class="section-grid">
            ${visibleSections.map((section) => `
              <article class="section-card">
                <h4>${escapeHtml(section.label)}</h4>
                <p>${escapeHtml(section.description)}</p>
                <span class="meta-line">${escapeHtml(`${section.count} items / ${section.status}`)}</span>
              </article>
            `).join("")}
          </div>
        </section>

        <section id="risks" class="section-panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Risks</span>
              <h2>High-score risks</h2>
            </div>
          </div>
          <div class="list-grid">
            ${renderListCards(
              (highRisks.length > 0 ? highRisks : prd.risks.slice(0, 6)).map((risk) => ({
                title: `${risk.risk_id} ${risk.description}`,
                summary: risk.mitigation,
                meta: `${risk.category} / score ${risk.score}`
              }))
            )}
          </div>
        </section>

        <section id="questions" class="section-panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Questions</span>
              <h2>Open questions</h2>
            </div>
          </div>
          <div class="list-grid">
            ${renderListCards(
              unresolvedQuestions.slice(0, 6).map((question) => ({
                title: `${question.question_id} ${question.question}`,
                summary: question.resolution ?? "No resolution recorded.",
                meta: question.status
              }))
            )}
          </div>
        </section>

        <section id="decisions" class="section-panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Decisions</span>
              <h2>Proposed decisions</h2>
              <p>Decisions that still require acceptance or retirement.</p>
            </div>
          </div>
          <div class="list-grid">
            ${renderListCards(
              proposedDecisions.slice(0, 6).map((decision) => ({
                title: `${decision.decision_id} ${decision.title}`,
                summary: decision.statement,
                meta: decision.status
              }))
            )}
          </div>
        </section>

        <footer>
          Exported from ${escapeHtml(sourceLabel)} on ${escapeHtml(reportDate)}.
        </footer>
      </main>
    </div>
  </body>
</html>
`;
}

export function buildProjectStatusReportFilename(reportTitle: string, exportedAt: string): string {
  return `project-status-${slugifyProjectStatusReport(reportTitle)}-${exportedAt.slice(0, 10)}.html`;
}

export function slugifyProjectStatusReport(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);

  return slug || "project-status";
}

function sidebarFact(label: string, value: string): string {
  return `<div class="sidebar-fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function statCard(label: string, value: string): string {
  return `<article class="stat-card"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></article>`;
}

function factCard(label: string, value: string): string {
  return `<dl class="fact-card"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></dl>`;
}

function statusPill(tone: "danger" | "warning" | "success" | "neutral", value: string): string {
  return `<span class="status-pill status-${tone}">${escapeHtml(value)}</span>`;
}

function renderListBlock(
  heading: string,
  items: Array<{ title: string; summary: string; meta: string }>
): string {
  return `<section>
    <h3>${escapeHtml(heading)}</h3>
    <div class="list-grid" style="margin-top: 12px;">
      ${renderListCards(items)}
    </div>
  </section>`;
}

function renderListCards(items: Array<{ title: string; summary: string; meta: string }>): string {
  if (items.length === 0) {
    return `<p class="empty">No items recorded.</p>`;
  }

  return items
    .map(
      (item) => `<article class="list-item">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.summary)}</p>
        <span class="meta-line">${escapeHtml(item.meta)}</span>
      </article>`
    )
    .join("");
}

function projectTrackingTone(prd: PrdDocument): "danger" | "warning" | "success" | "neutral" {
  if (prd.project_tracking.blockers.some((blocker) => blocker.status === "active")) {
    return "danger";
  }

  if (prd.project_tracking.status === "blocked" || prd.project_tracking.status === "at_risk") {
    return "warning";
  }

  if (prd.project_tracking.status === "completed") {
    return "success";
  }

  return "neutral";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
