export class PrdIndexStore {
    loader;
    cachedIndex = null;
    constructor(loader) {
        this.loader = loader;
    }
    async load() {
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
        const result = {
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
export function buildPrdIndex(document) {
    const prd = asRecord(document);
    const sections = [];
    const sectionMap = new Map();
    const entities = [];
    const entityById = new Map();
    const links = [];
    const outboundById = new Map();
    const inboundById = new Map();
    function ensureSection(key) {
        const existing = sectionMap.get(key);
        if (existing) {
            return existing;
        }
        const section = {
            key,
            count: 0,
            entityIds: []
        };
        sectionMap.set(key, section);
        sections.push(section);
        return section;
    }
    function addEntity(id, kind, sectionKey, label, status, sourcePath) {
        if (entityById.has(id)) {
            return;
        }
        const entity = {
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
    function addCountOnlySection(key, count) {
        const section = ensureSection(key);
        section.count = count;
    }
    function addLink(source, target, kind, label) {
        const link = {
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
        if (!id)
            return;
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
        if (!id)
            return;
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
        if (!id)
            return;
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
function addProjectTrackingLinks(record, sourceId, addLink) {
    if (!record || !sourceId) {
        return;
    }
    asStringArray(record.linked_entity_ids).forEach((targetId) => {
        addLink(sourceId, targetId, "project_tracking_link", "tracks");
    });
}
function appendToMap(map, key, link) {
    const bucket = map.get(key);
    if (bucket) {
        bucket.push(link);
        return;
    }
    map.set(key, [link]);
}
function asRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : null;
}
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function asStringArray(value) {
    return asArray(value).filter((item) => typeof item === "string" && item.length > 0);
}
function readOptionalString(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
}
