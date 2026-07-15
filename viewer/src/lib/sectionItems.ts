import type { PrdDocument, SectionKey } from "../types/prd";

export type SectionItem = {
  id: string;
  title: string;
  summary: string;
  meta: string;
};

export function buildSectionItems(prd: PrdDocument, section: SectionKey): SectionItem[] {
  switch (section) {
    case "meta":
      return [
        {
          id: "meta",
          title: prd.meta.product_name,
          summary: prd.meta.summary,
          meta: `${prd.meta.status} / ${prd.meta.lifecycle_stage} / v${prd.meta.version}`
        }
      ];
    case "problem":
      return [
        {
          id: "problem",
          title: prd.problem.statement,
          summary: prd.problem.opportunity,
          meta: `${prd.problem.evidence.length} evidence items`
        }
      ];
    case "goals":
      return [
        ...prd.goals.business_goals.map((goal, index) =>
          item(`BG-${index + 1}`, goal.statement, goal.rationale ?? "", goal.priority)
        ),
        ...prd.goals.user_outcomes.map((outcome, index) =>
          item(`UO-${index + 1}`, outcome.desired_outcome, outcome.measurement_signal, outcome.actor)
        ),
        ...prd.goals.success_metrics.map((metric, index) =>
          item(`SM-${index + 1}`, metric.metric, metric.measurement_method, metric.target)
        )
      ];
    case "assumptions":
      return prd.assumptions.map((assumption) =>
        item(assumption.assumption_id, assumption.statement, assumption.validation_plan ?? "", assumption.status)
      );
    case "personas":
      return prd.personas.map((persona) =>
        item(persona.persona_id, persona.name, persona.role, persona.goals[0])
      );
    case "requirements":
      return [
        ...prd.requirements.functional.map((requirement) =>
          item(requirement.req_id, requirement.title, requirement.description, `${requirement.priority} / ${requirement.release_phase}`)
        ),
        ...prd.requirements.non_functional.map((requirement) =>
          item(requirement.req_id, requirement.category, requirement.description, requirement.priority)
        )
      ];
    case "user_stories":
      return prd.user_stories.map((story) =>
        item(story.story_id, story.statement.i_want, story.statement.so_that, `${story.persona_id} / ${story.priority}`)
      );
    case "constraints":
      return [
        ...prd.constraints.technical.map((constraint) =>
          item(constraint.constraint_id, constraint.description, constraint.impact, constraint.imposed_by)
        ),
        ...prd.constraints.dependencies.map((dependency) =>
          item(dependency.dependency_id, dependency.name, dependency.description, dependency.status)
        )
      ];
    case "delivery":
      return [
        ...prd.delivery.milestones.map((milestone) =>
          item(milestone.name, milestone.name, milestone.deliverable, milestone.owner)
        ),
        ...prd.delivery.operational_readiness.map((readiness) =>
          item(readiness.area, readiness.area, readiness.notes ?? "", readiness.status)
        )
      ];
    case "project_tracking":
      return [
        item(
          "project_tracking",
          `Overall status: ${prd.project_tracking.status.replace(/_/g, " ")}`,
          prd.project_tracking.summary ?? "No project summary recorded.",
          [
            prd.project_tracking.owner ?? "Owner unset",
            prd.project_tracking.updated_at ? `updated ${prd.project_tracking.updated_at}` : "update time unset"
          ].join(" / ")
        ),
        ...prd.project_tracking.blockers.map((blocker) =>
          item(
            blocker.blocker_id,
            blocker.title,
            blocker.unblock_criteria,
            `${blocker.status} / ${blocker.severity}`
          )
        ),
        ...prd.project_tracking.pending_work.map((workItem) =>
          item(
            workItem.work_item_id,
            workItem.title,
            workItem.description,
            `${workItem.status} / ${workItem.priority}`
          )
        ),
        ...prd.project_tracking.issues_found.map((issue) =>
          item(issue.issue_id, issue.title, issue.description, `${issue.status} / ${issue.severity}`)
        ),
        ...prd.project_tracking.notes.map((note) =>
          item(note.note_id, note.note, note.owner ?? "Owner unset", note.noted_at)
        )
      ];
    case "risks":
      return prd.risks.map((risk) =>
        item(risk.risk_id, risk.description, risk.mitigation, `${risk.category} / score ${risk.score}`)
      );
    case "open_questions":
      return prd.open_questions.map((question) =>
        item(question.question_id, question.question, question.resolution ?? "No resolution recorded.", question.status)
      );
    case "decisions":
      return prd.decisions.map((decision) =>
        item(decision.decision_id, decision.title, decision.statement, decision.status)
      );
  }
}

function item(id: string, title: string, summary: string, meta: string | null | undefined): SectionItem {
  return {
    id,
    title,
    summary,
    meta: meta ?? "Not specified"
  };
}
