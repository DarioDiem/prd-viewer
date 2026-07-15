import type { SchemaCompatibilityResult } from "./schemaCompatibility";
import type { ValidationResult } from "./schemaValidation";
import type { Traceability } from "./traceability";
import type { PrdDocument, SectionKey } from "../types/prd";

export type ReadinessCategory =
  | "schema_validation"
  | "schema_compatibility"
  | "project_tracking"
  | "open_questions"
  | "decisions"
  | "risks"
  | "coverage"
  | "traceability";

export type ReadinessSeverity = "blocker" | "warning";

export type ApprovalReadinessSignal = {
  id: string;
  category: ReadinessCategory;
  severity: ReadinessSeverity;
  sourceSection: SectionKey | "schema" | "compatibility";
  sourceId: string | null;
  jsonPath: string | null;
  message: string;
};

export type ApprovalReadiness = {
  status: "blocked" | "warnings" | "ready";
  checkedAt: string | null;
  blockerCount: number;
  warningCount: number;
  signals: ApprovalReadinessSignal[];
};

export type ApprovalReadinessInput = {
  prd: PrdDocument;
  validation: ValidationResult;
  compatibility: SchemaCompatibilityResult;
  traceability: Traceability;
};

const highRiskScoreThreshold = 6;

export function buildApprovalReadiness({
  prd,
  validation,
  compatibility,
  traceability
}: ApprovalReadinessInput): ApprovalReadiness {
  const signals: ApprovalReadinessSignal[] = [
    ...buildValidationSignals(validation),
    ...buildProjectTrackingSignals(prd),
    ...buildOpenQuestionSignals(prd),
    ...buildDecisionSignals(prd),
    ...buildRiskSignals(prd),
    ...buildCoverageSignals(prd, traceability),
    ...buildTraceabilitySignals(traceability),
    ...buildCompatibilitySignals(compatibility)
  ];
  const blockerCount = signals.filter((signal) => signal.severity === "blocker").length;
  const warningCount = signals.filter((signal) => signal.severity === "warning").length;

  return {
    status: blockerCount > 0 ? "blocked" : warningCount > 0 ? "warnings" : "ready",
    checkedAt: validation.checkedAt,
    blockerCount,
    warningCount,
    signals
  };
}

function buildProjectTrackingSignals(prd: PrdDocument): ApprovalReadinessSignal[] {
  return prd.project_tracking.blockers.flatMap((blocker, index) => {
    if (blocker.status !== "active") {
      return [];
    }

    return [
      {
        id: `project_tracking:${blocker.blocker_id}`,
        category: "project_tracking" as const,
        severity: "blocker" as const,
        sourceSection: "project_tracking" as const,
        sourceId: blocker.blocker_id,
        jsonPath: jsonPath("project_tracking", "blockers", index),
        message: `${blocker.blocker_id} is active: ${blocker.title}`
      }
    ];
  });
}

function buildValidationSignals(validation: ValidationResult): ApprovalReadinessSignal[] {
  if (validation.status === "valid") {
    return [];
  }

  if (validation.status === "not_run") {
    return [
      {
        id: "schema_validation:not_run",
        category: "schema_validation",
        severity: "blocker",
        sourceSection: "schema",
        sourceId: null,
        jsonPath: null,
        message: "Strict schema validation must run before approval."
      }
    ];
  }

  return validation.issues.map((issue, index) => ({
    id: `schema_validation:${issue.path}:${issue.keyword ?? "issue"}:${index}`,
    category: "schema_validation",
    severity: "blocker",
    sourceSection: "schema",
    sourceId: null,
    jsonPath: issue.path,
    message: `Schema validation fails at ${issue.path}: ${issue.message}`
  }));
}

function buildOpenQuestionSignals(prd: PrdDocument): ApprovalReadinessSignal[] {
  return prd.open_questions.flatMap((question, index) => {
    if (question.status === "resolved") {
      return [];
    }

    return [
      {
        id: `open_questions:${question.question_id}`,
        category: "open_questions" as const,
        severity: "blocker" as const,
        sourceSection: "open_questions" as const,
        sourceId: question.question_id,
        jsonPath: jsonPath("open_questions", index),
        message: `${question.question_id} is ${question.status}: ${question.question}`
      }
    ];
  });
}

function buildDecisionSignals(prd: PrdDocument): ApprovalReadinessSignal[] {
  return prd.decisions.flatMap((decision, index) => {
    if (decision.status !== "proposed") {
      return [];
    }

    return [
      {
        id: `decisions:${decision.decision_id}`,
        category: "decisions" as const,
        severity: "blocker" as const,
        sourceSection: "decisions" as const,
        sourceId: decision.decision_id,
        jsonPath: jsonPath("decisions", index),
        message: `${decision.decision_id} remains proposed: ${decision.title}`
      }
    ];
  });
}

function buildRiskSignals(prd: PrdDocument): ApprovalReadinessSignal[] {
  return prd.risks.flatMap((risk, index) => {
    if (risk.score < highRiskScoreThreshold) {
      return [];
    }

    return [
      {
        id: `risks:${risk.risk_id}`,
        category: "risks" as const,
        severity: "blocker" as const,
        sourceSection: "risks" as const,
        sourceId: risk.risk_id,
        jsonPath: jsonPath("risks", index),
        message: `${risk.risk_id} has score ${risk.score}: ${risk.description}`
      }
    ];
  });
}

function buildCoverageSignals(prd: PrdDocument, traceability: Traceability): ApprovalReadinessSignal[] {
  const coveredRequirementIds = new Set(
    traceability.edges
      .filter((edge) => edge.kind === "story_requirement" && edge.valid)
      .map((edge) => edge.target)
  );
  const functionalSignals = prd.requirements.functional.flatMap((requirement, index) => {
    if (requirement.priority !== "must" || coveredRequirementIds.has(requirement.req_id)) {
      return [];
    }

    return [
      {
        id: `coverage:${requirement.req_id}`,
        category: "coverage" as const,
        severity: "blocker" as const,
        sourceSection: "requirements" as const,
        sourceId: requirement.req_id,
        jsonPath: jsonPath("requirements", "functional", index),
        message: `${requirement.req_id} is must-have but has no linked user story coverage.`
      }
    ];
  });
  const nonFunctionalSignals = prd.requirements.non_functional.flatMap((requirement, index) => {
    if (requirement.priority !== "must" || coveredRequirementIds.has(requirement.req_id)) {
      return [];
    }

    return [
      {
        id: `coverage:${requirement.req_id}`,
        category: "coverage" as const,
        severity: "blocker" as const,
        sourceSection: "requirements" as const,
        sourceId: requirement.req_id,
        jsonPath: jsonPath("requirements", "non_functional", index),
        message: `${requirement.req_id} is must-have but has no linked user story coverage.`
      }
    ];
  });

  return [...functionalSignals, ...nonFunctionalSignals];
}

function buildTraceabilitySignals(traceability: Traceability): ApprovalReadinessSignal[] {
  return traceability.issues.map((issue) => ({
    id: `traceability:${issue.id}`,
    category: "traceability",
    severity: "blocker",
    sourceSection: "requirements",
    sourceId: issue.source,
    jsonPath: null,
    message: issue.message
  }));
}

function buildCompatibilitySignals(compatibility: SchemaCompatibilityResult): ApprovalReadinessSignal[] {
  const signals: ApprovalReadinessSignal[] = [];

  if (compatibility.migrationRequired) {
    signals.push({
      id: "schema_compatibility:migration_required",
      category: "schema_compatibility",
      severity: "blocker",
      sourceSection: "compatibility",
      sourceId: compatibility.declaredSchemaVersion,
      jsonPath: "$[\"meta\"][\"schema_contract\"][\"schema_version\"]",
      message: "Schema migration is required before approval or writeback."
    });
  }

  compatibility.requiredExtensions.forEach((extension) => {
    signals.push({
      id: `schema_compatibility:required_extension:${extension.extension_id}`,
      category: "schema_compatibility",
      severity: "blocker",
      sourceSection: "compatibility",
      sourceId: extension.extension_id,
      jsonPath: "$[\"meta\"][\"schema_contract\"][\"extensions\"]",
      message: `Required extension ${extension.extension_id} must be supported before approval or writeback.`
    });
  });

  compatibility.warnings.forEach((warning, index) => {
    const duplicatesBlockingExtension = compatibility.requiredExtensions.some(
      (extension) => warning.includes("required extensions") && extension.required === true
    );

    if (!duplicatesBlockingExtension) {
      signals.push({
        id: `schema_compatibility:warning:${index}`,
        category: "schema_compatibility",
        severity: "warning",
        sourceSection: "compatibility",
        sourceId: compatibility.declaredSchemaVersion,
        jsonPath: "$[\"meta\"][\"schema_contract\"]",
        message: warning
      });
    }
  });

  return signals;
}

function jsonPath(...segments: Array<string | number>): string {
  return `$${segments.map((segment) => `[${typeof segment === "number" ? segment : JSON.stringify(segment)}]`).join("")}`;
}
