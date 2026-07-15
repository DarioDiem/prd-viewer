import type { PrdDocument } from "../types/prd";

export type TraceNodeKind =
  | "requirement"
  | "story"
  | "decision"
  | "risk"
  | "question"
  | "dependency"
  | "persona"
  | "constraint"
  | "missing";

export type TraceEdgeKind =
  | "story_requirement"
  | "story_persona"
  | "decision_requirement"
  | "requirement_persona"
  | "requirement_dependency"
  | "requirement_requirement";

export type TraceNode = {
  id: string;
  label: string;
  kind: TraceNodeKind;
  status: string | null;
};

export type TraceEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: TraceEdgeKind;
  valid: boolean;
};

export type TraceIssue = {
  id: string;
  source: string;
  target: string;
  message: string;
};

export type TraceMatrixRow = {
  requirementId: string;
  title: string;
  stories: string[];
  decisions: string[];
  dependencies: string[];
  prerequisites: string[];
  personas: string[];
  inboundLinks: number;
  outboundLinks: number;
  issueCount: number;
};

export type Traceability = {
  nodes: TraceNode[];
  edges: TraceEdge[];
  issues: TraceIssue[];
  matrixRows: TraceMatrixRow[];
  counts: {
    requirements: number;
    stories: number;
    decisions: number;
    dependencies: number;
    personas: number;
    relationships: number;
    brokenReferences: number;
  };
};

export type TraceGraph = {
  nodes: TraceNode[];
  edges: TraceEdge[];
};

export type FocusedTraceGraph = TraceGraph & {
  selectedNode: TraceNode | null;
  inboundEdges: TraceEdge[];
  outboundEdges: TraceEdge[];
  issues: TraceIssue[];
};

export type AgentTraceBundle = {
  schema: "prd.trace-summary.v1";
  exported_at: string;
  selected_node_id: string;
  selected_node: TraceNode | null;
  nodes: TraceNode[];
  edges: TraceEdge[];
  issues: TraceIssue[];
  counts: {
    nodes: number;
    edges: number;
    issues: number;
    inbound: number;
    outbound: number;
  };
};

const requirementPattern = /^(FR|NFR)-[0-9]{3}$/;
const dependencyPattern = /^D-[0-9]{3}$/;

export function buildTraceability(prd: PrdDocument): Traceability {
  const nodes: TraceNode[] = [];
  const nodeById = new Map<string, TraceNode>();
  const edges: TraceEdge[] = [];
  const issues: TraceIssue[] = [];
  const requirements = [
    ...prd.requirements.functional.map((requirement) => ({
      id: requirement.req_id,
      title: requirement.title,
      status: requirement.status
    })),
    ...prd.requirements.non_functional.map((requirement) => ({
      id: requirement.req_id,
      title: `${requirement.category}: ${requirement.description}`,
      status: null
    }))
  ];

  function addNode(node: TraceNode) {
    if (!nodeById.has(node.id)) {
      nodeById.set(node.id, node);
      nodes.push(node);
    }
  }

  function addEdge(source: string, target: string, kind: TraceEdgeKind, label: string) {
    const valid = nodeById.has(target);
    const edge: TraceEdge = {
      id: `${kind}:${source}->${target}`,
      source,
      target,
      label,
      kind,
      valid
    };

    edges.push(edge);

    if (!valid) {
      issues.push({
        id: edge.id,
        source,
        target,
        message: missingReferenceMessage(source, target, kind)
      });
    }
  }

  requirements.forEach((requirement) => {
    addNode({
      id: requirement.id,
      label: requirement.title,
      kind: "requirement",
      status: requirement.status
    });
  });
  prd.personas.forEach((persona) => {
    addNode({ id: persona.persona_id, label: persona.name, kind: "persona", status: null });
  });
  prd.user_stories.forEach((story) => {
    addNode({ id: story.story_id, label: story.statement.i_want, kind: "story", status: story.release_phase });
  });
  prd.decisions.forEach((decision) => {
    addNode({ id: decision.decision_id, label: decision.title, kind: "decision", status: decision.status });
  });
  prd.constraints.dependencies.forEach((dependency) => {
    addNode({ id: dependency.dependency_id, label: dependency.name, kind: "dependency", status: dependency.status });
  });
  prd.constraints.technical.forEach((constraint) => {
    addNode({ id: constraint.constraint_id, label: constraint.description, kind: "constraint", status: null });
  });
  prd.risks.forEach((risk) => {
    addNode({ id: risk.risk_id, label: risk.description, kind: "risk", status: `${risk.probability}/${risk.impact}` });
  });
  prd.open_questions.forEach((question) => {
    addNode({ id: question.question_id, label: question.question, kind: "question", status: question.status });
  });

  prd.requirements.functional.forEach((requirement) => {
    requirement.persona_ids.forEach((personaId) => {
      addEdge(requirement.req_id, personaId, "requirement_persona", "persona");
    });
    requirement.dependencies.forEach((dependencyId) => {
      if (requirementPattern.test(dependencyId)) {
        addEdge(requirement.req_id, dependencyId, "requirement_requirement", "requires");
        return;
      }

      addEdge(requirement.req_id, dependencyId, "requirement_dependency", dependencyPattern.test(dependencyId) ? "depends on" : "dependency ref");
    });
  });

  prd.user_stories.forEach((story) => {
    addEdge(story.story_id, story.persona_id, "story_persona", "persona");
    story.linked_req_ids.forEach((requirementId) => {
      addEdge(story.story_id, requirementId, "story_requirement", "covers");
    });
  });

  prd.decisions.forEach((decision) => {
    decision.linked_req_ids.forEach((requirementId) => {
      addEdge(decision.decision_id, requirementId, "decision_requirement", "decides");
    });
  });

  return {
    nodes,
    edges,
    issues,
    matrixRows: buildMatrixRows(requirements, edges, issues),
    counts: {
      requirements: requirements.length,
      stories: prd.user_stories.length,
      decisions: prd.decisions.length,
      dependencies: prd.constraints.dependencies.length,
      personas: prd.personas.length,
      relationships: edges.filter((edge) => edge.valid).length,
      brokenReferences: issues.length
    }
  };
}

export function createEmptyTraceGraph(): TraceGraph {
  return {
    nodes: [],
    edges: []
  };
}

export function buildFocusedTraceGraph(traceability: Traceability, selectedNodeId: string): FocusedTraceGraph {
  const selectedNode = traceability.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const relatedEdges = traceability.edges.filter(
    (edge) => edge.source === selectedNodeId || edge.target === selectedNodeId
  );
  const relatedIds = new Set<string>([selectedNodeId]);

  relatedEdges.forEach((edge) => {
    relatedIds.add(edge.source);
    relatedIds.add(edge.target);
  });

  const nodes = Array.from(relatedIds).map((id) => {
    const node = traceability.nodes.find((candidate) => candidate.id === id);

    return node ?? { id, label: "Missing reference", kind: "missing" as const, status: "missing" };
  });

  return {
    selectedNode,
    nodes,
    edges: relatedEdges,
    inboundEdges: relatedEdges.filter((edge) => edge.target === selectedNodeId),
    outboundEdges: relatedEdges.filter((edge) => edge.source === selectedNodeId),
    issues: traceability.issues.filter((issue) => issue.source === selectedNodeId || issue.target === selectedNodeId)
  };
}

export function buildAgentTraceBundle(
  traceability: Traceability,
  selectedNodeId: string,
  exportedAt: string
): AgentTraceBundle {
  const graph = buildFocusedTraceGraph(traceability, selectedNodeId);

  return {
    schema: "prd.trace-summary.v1",
    exported_at: exportedAt,
    selected_node_id: selectedNodeId,
    selected_node: graph.selectedNode,
    nodes: graph.nodes,
    edges: graph.edges,
    issues: graph.issues,
    counts: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      issues: graph.issues.length,
      inbound: graph.inboundEdges.length,
      outbound: graph.outboundEdges.length
    }
  };
}

function buildMatrixRows(
  requirements: Array<{ id: string; title: string }>,
  edges: TraceEdge[],
  issues: TraceIssue[]
): TraceMatrixRow[] {
  return requirements.map((requirement) => {
    const inbound = edges.filter((edge) => edge.target === requirement.id && edge.valid);
    const outbound = edges.filter((edge) => edge.source === requirement.id && edge.valid);

    return {
      requirementId: requirement.id,
      title: requirement.title,
      stories: uniqueSorted(
        inbound.filter((edge) => edge.kind === "story_requirement").map((edge) => edge.source)
      ),
      decisions: uniqueSorted(
        inbound.filter((edge) => edge.kind === "decision_requirement").map((edge) => edge.source)
      ),
      dependencies: uniqueSorted(
        outbound.filter((edge) => edge.kind === "requirement_dependency").map((edge) => edge.target)
      ),
      prerequisites: uniqueSorted(
        outbound.filter((edge) => edge.kind === "requirement_requirement").map((edge) => edge.target)
      ),
      personas: uniqueSorted(
        outbound.filter((edge) => edge.kind === "requirement_persona").map((edge) => edge.target)
      ),
      inboundLinks: inbound.length,
      outboundLinks: outbound.length,
      issueCount: issues.filter((issue) => issue.source === requirement.id || issue.target === requirement.id).length
    };
  });
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function missingReferenceMessage(source: string, target: string, kind: TraceEdgeKind): string {
  if (kind === "story_requirement" || kind === "decision_requirement") {
    return `${source} references missing requirement ${target}.`;
  }
  if (kind === "story_persona" || kind === "requirement_persona") {
    return `${source} references missing persona ${target}.`;
  }
  if (kind === "requirement_requirement") {
    return `${source} references missing prerequisite requirement ${target}.`;
  }

  return `${source} references missing dependency ${target}.`;
}
