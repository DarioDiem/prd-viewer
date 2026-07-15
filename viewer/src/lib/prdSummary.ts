import type { PrdDocument, SectionKey, SectionSummary } from "../types/prd";

const sectionCopy: Record<SectionKey, string> = {
  meta: "Document ownership, lifecycle, authors, release target, and stakeholder context.",
  problem: "Problem framing, opportunity, affected users, strategic fit, and evidence.",
  goals: "Business goals, user outcomes, success metrics, guardrails, and non-goals.",
  assumptions: "Open assumptions and validation plans that can affect review readiness.",
  personas: "Actors and reviewer roles used to ground requirements and stories.",
  requirements: "Functional and non-functional requirements with acceptance criteria.",
  user_stories: "INVEST-style stories and Given-When-Then acceptance criteria.",
  constraints: "Technical constraints, dependencies, milestones, and external limits.",
  delivery: "Milestones, rollout plan, operational readiness, support, and training.",
  project_tracking: "Execution status, pending work, issues, blockers, and project notes.",
  risks: "Known risks with probability, impact, score, mitigation, and trigger data.",
  open_questions: "Unresolved product, engineering, compliance, and workflow questions.",
  decisions: "Accepted or proposed product and technical decisions linked to requirements."
};

const sectionLabels: Record<SectionKey, string> = {
  meta: "Meta",
  problem: "Problem",
  goals: "Goals",
  assumptions: "Assumptions",
  personas: "Personas",
  requirements: "Requirements",
  user_stories: "Stories",
  constraints: "Constraints",
  delivery: "Delivery",
  project_tracking: "Project tracking",
  risks: "Risks",
  open_questions: "Questions",
  decisions: "Decisions"
};

const sectionKeys = Object.keys(sectionLabels) as SectionKey[];

export function buildPrdSummary(prd: PrdDocument, sourceLabel = "viewer/PRD_web_ui.json") {
  const openQuestions = prd.open_questions.filter((question) => question.status !== "resolved");
  const proposedDecisions = prd.decisions.filter((decision) => decision.status === "proposed");
  const highRisks = prd.risks.filter((risk) => risk.score >= 6);
  const activeBlockers = prd.project_tracking.blockers.filter((blocker) => blocker.status === "active");

  return {
    title: prd.meta.title,
    subtitle: prd.meta.summary,
    lifecycle: `${prd.meta.status} / ${prd.meta.lifecycle_stage}`,
    sourceLabel,
    metrics: {
      functionalRequirements: prd.requirements.functional.length,
      userStories: prd.user_stories.length,
      projectTrackingPendingWork: prd.project_tracking.pending_work.length,
      projectTrackingIssues: prd.project_tracking.issues_found.length,
      projectTrackingBlockers: activeBlockers.length,
      openQuestions: openQuestions.length,
      decisions: prd.decisions.length,
      risks: prd.risks.length
    },
    blockers: buildBlockers(activeBlockers.length, openQuestions.length, proposedDecisions.length, highRisks.length),
    sections: buildSections(prd)
  };
}

function buildSections(prd: PrdDocument): SectionSummary[] {
  return sectionKeys.map((key) => ({
    key,
    label: sectionLabels[key],
    description: sectionCopy[key],
    count: countSectionItems(prd, key),
    status: deriveSectionStatus(prd, key),
    tone: deriveSectionTone(prd, key)
  }));
}

function countSectionItems(prd: PrdDocument, key: SectionKey): number {
  switch (key) {
    case "meta":
      return prd.meta.stakeholders.length;
    case "problem":
      return prd.problem.evidence.length;
    case "goals":
      return (
        prd.goals.business_goals.length +
        prd.goals.user_outcomes.length +
        prd.goals.success_metrics.length
      );
    case "requirements":
      return prd.requirements.functional.length + prd.requirements.non_functional.length;
    case "constraints":
      return prd.constraints.technical.length + prd.constraints.dependencies.length;
    case "project_tracking":
      return (
        prd.project_tracking.pending_work.length +
        prd.project_tracking.issues_found.length +
        prd.project_tracking.blockers.length +
        prd.project_tracking.notes.length
      );
    default: {
      const value = prd[key];
      return Array.isArray(value) ? value.length : 1;
    }
  }
}

function buildBlockers(
  projectTrackingBlockers: number,
  openQuestions: number,
  proposedDecisions: number,
  highRisks: number
): string[] {
  const blockers: string[] = [];

  if (projectTrackingBlockers > 0) {
    blockers.push(`${projectTrackingBlockers} active project blockers need resolution.`);
  }

  if (openQuestions > 0) {
    blockers.push(`${openQuestions} open questions need owner review.`);
  }

  if (proposedDecisions > 0) {
    blockers.push(`${proposedDecisions} decisions are still proposed.`);
  }

  if (highRisks > 0) {
    blockers.push(`${highRisks} high-score risks need mitigation tracking.`);
  }

  return blockers;
}

function deriveSectionStatus(prd: PrdDocument, key: SectionKey): string {
  if (key === "open_questions") {
    const openCount = prd.open_questions.filter((question) => question.status !== "resolved").length;
    return openCount > 0 ? `${openCount} open` : "Clear";
  }

  if (key === "decisions") {
    const proposedCount = prd.decisions.filter((decision) => decision.status === "proposed").length;
    return proposedCount > 0 ? `${proposedCount} proposed` : "Accepted";
  }

  if (key === "project_tracking") {
    const activeBlockers = prd.project_tracking.blockers.filter((blocker) => blocker.status === "active").length;

    if (activeBlockers > 0) {
      return `${activeBlockers} blocked`;
    }

    return prd.project_tracking.status.replace(/_/g, " ");
  }

  return "Ready";
}

function deriveSectionTone(prd: PrdDocument, key: SectionKey): SectionSummary["tone"] {
  if (key === "open_questions") {
    return prd.open_questions.some((question) => question.status !== "resolved") ? "warning" : "success";
  }

  if (key === "risks") {
    return prd.risks.some((risk) => risk.score >= 6) ? "danger" : "neutral";
  }

  if (key === "decisions") {
    return prd.decisions.some((decision) => decision.status === "proposed") ? "warning" : "success";
  }

  if (key === "project_tracking") {
    if (prd.project_tracking.blockers.some((blocker) => blocker.status === "active")) {
      return "danger";
    }

    if (
      prd.project_tracking.status === "blocked" ||
      prd.project_tracking.status === "at_risk" ||
      prd.project_tracking.pending_work.some((item) => item.status === "blocked")
    ) {
      return "warning";
    }

    return prd.project_tracking.status === "completed" ? "success" : "neutral";
  }

  return "neutral";
}
