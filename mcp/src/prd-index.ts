import type { PrdCacheState, PrdLoadResult, PrdLoader } from "./prd-loader.js";

export type IndexedSectionKey =
  | "meta"
  | "problem"
  | "goals"
  | "assumptions"
  | "personas"
  | "requirements.functional"
  | "requirements.non_functional"
  | "user_stories"
  | "constraints.technical"
  | "constraints.dependencies"
  | "delivery.milestones"
  | "delivery.operational_readiness"
  | "project_tracking.pending_work"
  | "project_tracking.issues_found"
  | "project_tracking.blockers"
  | "project_tracking.notes"
  | "risks"
  | "open_questions"
  | "decisions"
  | "extensions.registry";

export type IndexEntityKind =
  | "prd"
  | "assumption"
  | "persona"
  | "functional_requirement"
  | "non_functional_requirement"
  | "story"
  | "technical_constraint"
  | "dependency"
  | "risk"
  | "question"
  | "decision"
  | "work_item"
  | "issue"
  | "blocker"
  | "note"
  | "extension";

export type IndexLinkKind =
  | "story_requirement"
  | "story_persona"
  | "decision_requirement"
  | "requirement_persona"
  | "requirement_dependency"
  | "requirement_requirement"
  | "project_tracking_link";

export type IndexedSection = {
  key: IndexedSectionKey;
  count: number;
  entityIds: string[];
};

export type IndexedEntity = {
  id: string;
  kind: IndexEntityKind;
  section: IndexedSectionKey | "meta";
  label: string;
  status: string | null;
  sourcePath: string;
};

export type IndexedLink = {
  id: string;
  source: string;
  target: string;
  kind: IndexLinkKind;
  label: string;
  valid: boolean;
};

export type PrdIndex = {
  sections: IndexedSection[];
  entities: IndexedEntity[];
  entityById: Map<string, IndexedEntity>;
  links: IndexedLink[];
  outboundById: Map<string, IndexedLink[]>;
  inboundById: Map<string, IndexedLink[]>;
  brokenLinks: IndexedLink[];
};

export type PrdIndexSnapshot = {
  status: "ready" | "blocked";
  cacheState: PrdCacheState;
  builtAt: string;
  sourceSha256: string | null;
  sectionCount: number;
  entityCount: number;
  linkCount: number;
  brokenLinkCount: number;
  sections: Array<{
    key: IndexedSectionKey;
    count: number;
  }>;
};

export type PrdIndexResult = {
  snapshot: PrdIndexSnapshot;
  index: PrdIndex | null;
  load: PrdLoadResult;
};

type CachedIndex = {
  sha256: string;
  result: PrdIndexResult;
};

export class PrdIndexStore {
  private cachedIndex: CachedIndex | null = null;

  constructor(private readonly loader: PrdLoader) {}

  async load(): Promise<PrdIndexResult> {
    const load = await this.loader.load();
    const builtAt = new Date().toISOString();
    const sha256 = load.snapshot.file.sha256;

    if (load.snapshot.status !== "valid" || load.document === null || sha256 === null) {
      return {
        load,
        index: null,
        snapshot: {
          status: "blocked",
          cacheState: load.snapshot.cacheState,
          builtAt,
          sourceSha256: sha256,
          sectionCount: 0,
          entityCount: 0,
          linkCount: 0,
          brokenLinkCount: 0,
          sections: []
        }
      };
    }

    if (this.cachedIndex && this.cachedIndex.sha256 === sha256) {
      return {
        ...this.cachedIndex.result,
        load,
        snapshot: {
          ...this.cachedIndex.result.snapshot,
          builtAt,
          cacheState: load.snapshot.cacheState
        }
      };
    }

    const index = buildPrdIndex(load.document);
    const result: PrdIndexResult = {
      load,
      index,
      snapshot: {
        status: "ready",
        cacheState: load.snapshot.cacheState,
        builtAt,
        sourceSha256: sha256,
        sectionCount: index.sections.length,
        entityCount: index.entities.length,
        linkCount: index.links.length,
        brokenLinkCount: index.brokenLinks.length,
        sections: index.sections.map((section) => ({
          key: section.key,
          count: section.count
        }))
      }
    };

    this.cachedIndex = {
      sha256,
      result
    };

    return result;
  }
}

export function buildPrdIndex(document: unknown): PrdIndex {
  const prd = asRecord(document);
  const sections: IndexedSection[] = [];
  const sectionMap = new Map<IndexedSectionKey, IndexedSection>();
  const entities: IndexedEntity[] = [];
  const entityById = new Map<string, IndexedEntity>();
  const links: IndexedLink[] = [];
  const outboundById = new Map<string, IndexedLink[]>();
  const inboundById = new Map<string, IndexedLink[]>();

  function ensureSection(key: IndexedSectionKey): IndexedSection {
    const existing = sectionMap.get(key);

    if (existing) {
      return existing;
    }

    const section: IndexedSection = {
      key,
      count: 0,
      entityIds: []
    };
    sectionMap.set(key, section);
    sections.push(section);
    return section;
  }

  function addEntity(
    id: string,
    kind: IndexEntityKind,
    sectionKey: IndexedSectionKey | "meta",
    label: string,
    status: string | null,
    sourcePath: string
  ) {
    if (entityById.has(id)) {
      return;
    }

    const entity: IndexedEntity = {
      id,
      kind,
      section: sectionKey,
      label,
      status,
      sourcePath
    };
    entityById.set(id, entity);
    entities.push(entity);

    if (sectionKey !== "meta") {
      const section = ensureSection(sectionKey);
      section.count += 1;
      section.entityIds.push(id);
    }
  }

  function addCountOnlySection(key: IndexedSectionKey, count: number) {
    const section = ensureSection(key);
    section.count = count;
  }

  function addLink(source: string, target: string, kind: IndexLinkKind, label: string) {
    const link: IndexedLink = {
      id: `${kind}:${source}->${target}`,
      source,
      target,
      kind,
      label,
      valid: entityById.has(source) && entityById.has(target)
    };

    links.push(link);
    appendToMap(outboundById, source, link);
    appendToMap(inboundById, target, link);
  }

  const meta = asRecord(prd?.meta);
  const prdId = readOptionalString(meta?.prd_id);
  if (prdId) {
    addEntity(prdId, "prd", "meta", readOptionalString(meta?.title) ?? "PRD", readOptionalString(meta?.status), "$.meta");
  }

  addCountOnlySection("meta", meta ? 1 : 0);
  addCountOnlySection("problem", asRecord(prd?.problem) ? 1 : 0);
  addCountOnlySection("goals", asRecord(prd?.goals) ? 1 : 0);

  const assumptions = asArray(prd?.assumptions);
  assumptions.forEach((item, index) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.assumption_id);
    if (id) {
      addEntity(id, "assumption", "assumptions", readOptionalString(record?.statement) ?? id, readOptionalString(record?.status), `$.assumptions[${index}]`);
    }
  });

  const personas = asArray(prd?.personas);
  personas.forEach((item, index) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.persona_id);
    if (id) {
      addEntity(id, "persona", "personas", readOptionalString(record?.name) ?? id, null, `$.personas[${index}]`);
    }
  });

  const requirements = asRecord(prd?.requirements);
  const functionalRequirements = asArray(requirements?.functional);
  functionalRequirements.forEach((item, index) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.req_id);
    if (id) {
      addEntity(id, "functional_requirement", "requirements.functional", readOptionalString(record?.title) ?? id, readOptionalString(record?.status), `$.requirements.functional[${index}]`);
    }
  });

  const nonFunctionalRequirements = asArray(requirements?.non_functional);
  nonFunctionalRequirements.forEach((item, index) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.req_id);
    const label = [readOptionalString(record?.category), readOptionalString(record?.description)].filter(Boolean).join(": ");
    if (id) {
      addEntity(id, "non_functional_requirement", "requirements.non_functional", label || id, null, `$.requirements.non_functional[${index}]`);
    }
  });

  const stories = asArray(prd?.user_stories);
  stories.forEach((item, index) => {
    const record = asRecord(item);
    const statement = asRecord(record?.statement);
    const id = readOptionalString(record?.story_id);
    if (id) {
      addEntity(id, "story", "user_stories", readOptionalString(statement?.i_want) ?? id, readOptionalString(record?.release_phase), `$.user_stories[${index}]`);
    }
  });

  const constraints = asRecord(prd?.constraints);
  const technicalConstraints = asArray(constraints?.technical);
  technicalConstraints.forEach((item, index) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.constraint_id);
    if (id) {
      addEntity(id, "technical_constraint", "constraints.technical", readOptionalString(record?.description) ?? id, null, `$.constraints.technical[${index}]`);
    }
  });

  const dependencies = asArray(constraints?.dependencies);
  dependencies.forEach((item, index) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.dependency_id);
    if (id) {
      addEntity(id, "dependency", "constraints.dependencies", readOptionalString(record?.name) ?? id, readOptionalString(record?.status), `$.constraints.dependencies[${index}]`);
    }
  });

  const delivery = asRecord(prd?.delivery);
  addCountOnlySection("delivery.milestones", asArray(delivery?.milestones).length);
  addCountOnlySection("delivery.operational_readiness", asArray(delivery?.operational_readiness).length);

  const risks = asArray(prd?.risks);
  risks.forEach((item, index) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.risk_id);
    const probability = readOptionalString(record?.probability);
    const impact = readOptionalString(record?.impact);
    if (id) {
      addEntity(id, "risk", "risks", readOptionalString(record?.description) ?? id, probability && impact ? `${probability}/${impact}` : null, `$.risks[${index}]`);
    }
  });

  const openQuestions = asArray(prd?.open_questions);
  openQuestions.forEach((item, index) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.question_id);
    if (id) {
      addEntity(id, "question", "open_questions", readOptionalString(record?.question) ?? id, readOptionalString(record?.status), `$.open_questions[${index}]`);
    }
  });

  const decisions = asArray(prd?.decisions);
  decisions.forEach((item, index) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.decision_id);
    if (id) {
      addEntity(id, "decision", "decisions", readOptionalString(record?.title) ?? id, readOptionalString(record?.status), `$.decisions[${index}]`);
    }
  });

  const extensions = asRecord(prd?.extensions);
  const extensionRegistry = asArray(extensions?.registry);
  extensionRegistry.forEach((item, index) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.extension_id);
    if (id) {
      addEntity(id, "extension", "extensions.registry", readOptionalString(record?.name) ?? id, typeof record?.required === "boolean" ? (record.required ? "required" : "optional") : null, `$.extensions.registry[${index}]`);
    }
  });

  const projectTracking = asRecord(prd?.project_tracking);
  const pendingWork = asArray(projectTracking?.pending_work);
  pendingWork.forEach((item, index) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.work_item_id);
    if (id) {
      addEntity(id, "work_item", "project_tracking.pending_work", readOptionalString(record?.title) ?? id, readOptionalString(record?.status), `$.project_tracking.pending_work[${index}]`);
    }
  });

  const issuesFound = asArray(projectTracking?.issues_found);
  issuesFound.forEach((item, index) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.issue_id);
    if (id) {
      addEntity(id, "issue", "project_tracking.issues_found", readOptionalString(record?.title) ?? id, readOptionalString(record?.status), `$.project_tracking.issues_found[${index}]`);
    }
  });

  const blockers = asArray(projectTracking?.blockers);
  blockers.forEach((item, index) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.blocker_id);
    if (id) {
      addEntity(id, "blocker", "project_tracking.blockers", readOptionalString(record?.title) ?? id, readOptionalString(record?.status), `$.project_tracking.blockers[${index}]`);
    }
  });

  const notes = asArray(projectTracking?.notes);
  notes.forEach((item, index) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.note_id);
    if (id) {
      addEntity(id, "note", "project_tracking.notes", readOptionalString(record?.note) ?? id, null, `$.project_tracking.notes[${index}]`);
    }
  });

  functionalRequirements.forEach((item) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.req_id);
    if (!id) return;

    asStringArray(record?.persona_ids).forEach((personaId) => {
      addLink(id, personaId, "requirement_persona", "persona");
    });

    asStringArray(record?.dependencies).forEach((dependencyId) => {
      const kind = dependencyId.startsWith("FR-") || dependencyId.startsWith("NFR-") ? "requirement_requirement" : "requirement_dependency";
      addLink(id, dependencyId, kind, kind === "requirement_requirement" ? "requires" : "depends on");
    });
  });

  stories.forEach((item) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.story_id);
    if (!id) return;

    const personaId = readOptionalString(record?.persona_id);
    if (personaId) {
      addLink(id, personaId, "story_persona", "persona");
    }

    asStringArray(record?.linked_req_ids).forEach((requirementId) => {
      addLink(id, requirementId, "story_requirement", "covers");
    });
  });

  decisions.forEach((item) => {
    const record = asRecord(item);
    const id = readOptionalString(record?.decision_id);
    if (!id) return;

    asStringArray(record?.linked_req_ids).forEach((requirementId) => {
      addLink(id, requirementId, "decision_requirement", "decides");
    });
  });

  pendingWork.forEach((item) => addProjectTrackingLinks(asRecord(item), readOptionalString(asRecord(item)?.work_item_id), addLink));
  issuesFound.forEach((item) => addProjectTrackingLinks(asRecord(item), readOptionalString(asRecord(item)?.issue_id), addLink));
  blockers.forEach((item) => addProjectTrackingLinks(asRecord(item), readOptionalString(asRecord(item)?.blocker_id), addLink));
  notes.forEach((item) => addProjectTrackingLinks(asRecord(item), readOptionalString(asRecord(item)?.note_id), addLink));

  const brokenLinks = links.filter((link) => !link.valid);

  sections.sort((left, right) => left.key.localeCompare(right.key));
  entities.sort((left, right) => left.id.localeCompare(right.id));
  links.sort((left, right) => left.id.localeCompare(right.id));

  return {
    sections,
    entities,
    entityById,
    links,
    outboundById,
    inboundById,
    brokenLinks
  };
}

function addProjectTrackingLinks(
  record: Record<string, unknown> | null,
  sourceId: string | null,
  addLink: (source: string, target: string, kind: IndexLinkKind, label: string) => void
) {
  if (!record || !sourceId) {
    return;
  }

  asStringArray(record.linked_entity_ids).forEach((targetId) => {
    addLink(sourceId, targetId, "project_tracking_link", "tracks");
  });
}

function appendToMap(map: Map<string, IndexedLink[]>, key: string, link: IndexedLink) {
  const bucket = map.get(key);

  if (bucket) {
    bucket.push(link);
    return;
  }

  map.set(key, [link]);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === "string" && item.length > 0);
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
