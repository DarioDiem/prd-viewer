export type PrdStatus = "draft" | "in_review" | "approved" | "implemented" | "deprecated";
export type LifecycleStage = "discovery" | "definition" | "delivery" | "launch" | "live";
export type Priority = "must" | "should" | "could" | "wont";
export type SectionTone = "neutral" | "success" | "warning" | "danger";

export type SectionKey =
  | "meta"
  | "problem"
  | "goals"
  | "assumptions"
  | "personas"
  | "requirements"
  | "user_stories"
  | "constraints"
  | "delivery"
  | "project_tracking"
  | "risks"
  | "open_questions"
  | "decisions";

export type SectionSummary = {
  key: SectionKey;
  label: string;
  description: string;
  count: number;
  status: string;
  tone: SectionTone;
};

export type PrdDocument = {
  meta: {
    prd_id?: string;
    title: string;
    summary: string;
    product_name: string;
    version: string;
    status: PrdStatus;
    lifecycle_stage: LifecycleStage;
    updated_at: string;
    stakeholders: unknown[];
    schema_contract?: SchemaContract | null;
  };
  problem: {
    statement: string;
    opportunity: string;
    evidence: unknown[];
  };
  goals: {
    business_goals: BusinessGoal[];
    user_outcomes: UserOutcome[];
    success_metrics: SuccessMetric[];
  };
  assumptions: Assumption[];
  personas: Persona[];
  requirements: {
    functional: Requirement[];
    non_functional: NonFunctionalRequirement[];
  };
  user_stories: UserStory[];
  constraints: {
    technical: TechnicalConstraint[];
    dependencies: Dependency[];
  };
  delivery: {
    milestones: Milestone[];
    operational_readiness: ReadinessItem[];
  };
  project_tracking: ProjectTracking;
  risks: Risk[];
  open_questions: OpenQuestion[];
  decisions: Decision[];
  extensions?: ExtensionsContainer | null;
};

export type BusinessGoal = {
  statement: string;
  rationale: string | null;
  priority: string;
};

export type UserOutcome = {
  actor: string;
  desired_outcome: string;
  measurement_signal: string;
};

export type SuccessMetric = {
  metric: string;
  target: string;
  measurement_method: string;
};

export type Assumption = {
  assumption_id: string;
  statement: string;
  validation_plan: string | null;
  status: string;
};

export type Persona = {
  persona_id: string;
  name: string;
  role: string;
  goals: string[];
  needs: string[];
  pain_points: string[];
  current_workarounds: string[];
  frequency_of_use: string;
  technical_proficiency: string;
  environment: string | null;
};

export type Requirement = {
  req_id: string;
  title: string;
  description: string;
  rationale?: string | null;
  priority: Priority;
  persona_ids: string[];
  dependencies: string[];
  acceptance_criteria?: string[];
  status: string;
  release_phase: string;
};

export type NonFunctionalRequirement = {
  req_id: string;
  category: string;
  description: string;
  target?: string;
  priority: Priority;
  acceptance_criteria?: string[];
};

export type UserStory = {
  story_id: string;
  epic: string;
  persona_id: string;
  priority: Priority;
  release_phase: string;
  linked_req_ids: string[];
  statement: {
    as_a: string;
    i_want: string;
    so_that: string;
  };
  acceptance_criteria: Array<{
    given: string;
    when: string;
    then: string;
  }>;
  story_points: number | null;
  edge_cases: string[];
};

export type TechnicalConstraint = {
  constraint_id: string;
  description: string;
  imposed_by: string;
  impact: string;
};

export type Dependency = {
  dependency_id: string;
  name: string;
  description: string;
  status: string;
};

export type Milestone = {
  name: string;
  deliverable: string;
  owner: string;
};

export type ReadinessItem = {
  area: string;
  owner: string | null;
  notes: string | null;
  status: string;
};

export type Risk = {
  risk_id: string;
  description: string;
  category: string;
  probability: string;
  impact: string;
  score: number;
  mitigation: string;
  owner: string | null;
  trigger: string | null;
};

export type OpenQuestion = {
  question_id: string;
  question: string;
  raised_by: string;
  raised_at: string;
  status: "open" | "deferred" | "resolved";
  resolution: string | null;
};

export type Decision = {
  decision_id: string;
  title: string;
  statement: string;
  rationale: string | null;
  owner: string | null;
  decided_at: string | null;
  status: "proposed" | "accepted" | "superseded" | "rejected";
  linked_req_ids: string[];
};

export type ProjectTrackingStatus =
  | "not_started"
  | "in_progress"
  | "at_risk"
  | "blocked"
  | "completed"
  | "on_hold"
  | "cancelled";

export type TrackingWorkStatus = "not_started" | "in_progress" | "blocked" | "done" | "deferred";
export type TrackingIssueStatus = "open" | "investigating" | "resolved" | "deferred";
export type TrackingBlockerStatus = "active" | "mitigated" | "cleared";
export type TrackingSeverity = "low" | "medium" | "high" | "critical";

export type ProjectTracking = {
  status: ProjectTrackingStatus;
  owner: string | null;
  summary: string | null;
  updated_at: string | null;
  linked_prd_ids: string[];
  pending_work: ProjectTrackingWorkItem[];
  issues_found: ProjectTrackingIssue[];
  blockers: ProjectTrackingBlocker[];
  notes: ProjectTrackingNote[];
};

export type ProjectTrackingWorkItem = {
  work_item_id: string;
  title: string;
  description: string;
  status: TrackingWorkStatus;
  priority: TrackingSeverity;
  owner: string | null;
  linked_prd_ids: string[];
  linked_entity_ids: string[];
  external_refs?: string[];
  notes: string | null;
};

export type ProjectTrackingIssue = {
  issue_id: string;
  title: string;
  description: string;
  status: TrackingIssueStatus;
  severity: TrackingSeverity;
  owner: string | null;
  linked_prd_ids: string[];
  linked_entity_ids: string[];
  external_refs?: string[];
  notes: string | null;
};

export type ProjectTrackingBlocker = {
  blocker_id: string;
  title: string;
  description: string;
  status: TrackingBlockerStatus;
  severity: TrackingSeverity;
  owner: string | null;
  linked_prd_ids: string[];
  linked_entity_ids: string[];
  external_refs?: string[];
  unblock_criteria: string;
  notes: string | null;
};

export type ProjectTrackingNote = {
  note_id: string;
  note: string;
  owner: string | null;
  noted_at: string;
  linked_prd_ids: string[];
  linked_entity_ids: string[];
  external_refs?: string[];
};

export type SchemaContract = {
  schema_id?: string | null;
  schema_version?: string | null;
  compatible_schema_versions?: string[];
  compatibility_mode?: string | null;
  extension_policy?: string | null;
  migrations?: unknown[];
  extensions?: ExtensionDescriptor[];
};

export type ExtensionDescriptor = {
  extension_id: string;
  name?: string | null;
  version?: string | null;
  compatibility?: string | null;
  required?: boolean;
  owner?: string | null;
  schema_ref?: string | null;
  description?: string | null;
};

export type ExtensionsContainer = {
  registry?: ExtensionDescriptor[];
  data?: Record<string, unknown>;
};
