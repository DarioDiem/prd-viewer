const highRiskScoreThreshold = 6;
const topLevelSections = [
    "meta",
    "problem",
    "goals",
    "assumptions",
    "personas",
    "requirements",
    "user_stories",
    "constraints",
    "delivery",
    "project_tracking",
    "risks",
    "open_questions",
    "decisions",
    "extensions"
];
const indexedSectionNames = [
    "meta",
    "problem",
    "goals",
    "assumptions",
    "personas",
    "requirements.functional",
    "requirements.non_functional",
    "user_stories",
    "constraints.technical",
    "constraints.dependencies",
    "delivery.milestones",
    "delivery.operational_readiness",
    "project_tracking.pending_work",
    "project_tracking.issues_found",
    "project_tracking.blockers",
    "project_tracking.notes",
    "risks",
    "open_questions",
    "decisions",
    "extensions.registry"
];
export function listSectionResourceDefinitions(indexResult) {
    const names = listAvailableSectionNames();
    return names.map((name) => {
        const sectionValue = resolveSectionValue(indexResult.load.document, name);
        const count = Array.isArray(sectionValue)
            ? sectionValue.length
            : typeof sectionValue === "object" && sectionValue !== null
                ? 1
                : 0;
        return {
            uri: `prd://section/${name}`,
            name: `section:${name}`,
            title: `PRD section ${name}`,
            description: count > 0 ? `Focused read for section ${name}.` : `Focused read for section ${name}.`,
            mimeType: "application/json"
        };
    });
}
export function listEntityResourceDefinitions(indexResult) {
    if (!indexResult.index) {
        return [];
    }
    return indexResult.index.entities.map((entity) => ({
        uri: `prd://entity/${entity.id}`,
        name: `entity:${entity.id}`,
        title: entity.label,
        description: `${entity.kind} from ${entity.section}`,
        mimeType: "application/json"
    }));
}
export function listTraceResourceDefinitions(indexResult) {
    if (!indexResult.index) {
        return [];
    }
    return indexResult.index.entities.map((entity) => ({
        uri: `prd://trace/${entity.id}`,
        name: `trace:${entity.id}`,
        title: `Trace for ${entity.id}`,
        description: `Focused trace view for ${entity.label}`,
        mimeType: "application/json"
    }));
}
export function buildSummaryPayload(load, indexResult) {
    return {
        status: load.snapshot.status,
        summary: load.snapshot.summary,
        load: load.snapshot,
        index: indexResult.snapshot,
        counts: {
            sections: indexResult.snapshot.sectionCount,
            entities: indexResult.snapshot.entityCount,
            links: indexResult.snapshot.linkCount,
            broken_links: indexResult.snapshot.brokenLinkCount
        }
    };
}
export function buildCompatibilityPayload(load) {
    return {
        status: load.snapshot.compatibility ? "available" : "blocked",
        compatibility: load.snapshot.compatibility,
        load: load.snapshot
    };
}
export function buildProjectTrackingPayload(load, indexResult) {
    const projectTracking = asRecord(resolveSectionValue(load.document, "project_tracking"));
    const pendingWork = asArray(projectTracking?.pending_work);
    const issuesFound = asArray(projectTracking?.issues_found);
    const blockers = asArray(projectTracking?.blockers);
    const notes = asArray(projectTracking?.notes);
    return {
        status: load.snapshot.status === "valid" ? "available" : "blocked",
        summary: {
            status: readOptionalString(projectTracking?.status),
            owner: readOptionalString(projectTracking?.owner),
            updated_at: readOptionalString(projectTracking?.updated_at)
        },
        counts: {
            pending_work: pendingWork.length,
            issues_found: issuesFound.length,
            blockers: blockers.length,
            notes: notes.length
        },
        project_tracking: projectTracking,
        related_index_sections: indexResult.snapshot.sections.filter((section) => section.key.startsWith("project_tracking"))
    };
}
export function buildReadinessPayload(load, indexResult) {
    const blockers = [];
    const warnings = [];
    const document = asRecord(load.document);
    const openQuestions = asArray(document?.open_questions);
    const decisions = asArray(document?.decisions);
    const risks = asArray(document?.risks);
    if (load.snapshot.status !== "valid") {
        blockers.push(...load.snapshot.failureReasons.map((reason) => `load:${reason}`));
    }
    if (load.snapshot.validation.status === "invalid") {
        blockers.push(...load.snapshot.validation.issues.map((issue) => `schema:${issue.path}:${issue.message}`));
    }
    if (load.snapshot.compatibility?.migrationRequired) {
        blockers.push("compatibility:migration_required");
    }
    load.snapshot.compatibility?.requiredExtensions.forEach((extension) => {
        blockers.push(`compatibility:required_extension:${extension.extension_id}`);
    });
    openQuestions.forEach((item) => {
        const question = asRecord(item);
        const status = readOptionalString(question?.status);
        const id = readOptionalString(question?.question_id);
        if (status && status !== "resolved") {
            blockers.push(`open_question:${id ?? "unknown"}`);
        }
    });
    decisions.forEach((item) => {
        const decision = asRecord(item);
        const status = readOptionalString(decision?.status);
        const id = readOptionalString(decision?.decision_id);
        if (status === "proposed") {
            blockers.push(`decision:${id ?? "unknown"}`);
        }
    });
    risks.forEach((item) => {
        const risk = asRecord(item);
        const score = typeof risk?.score === "number" ? risk.score : null;
        const id = readOptionalString(risk?.risk_id);
        if (score !== null && score >= highRiskScoreThreshold) {
            blockers.push(`risk:${id ?? "unknown"}`);
        }
    });
    if (indexResult.snapshot.brokenLinkCount > 0) {
        blockers.push(`traceability:${indexResult.snapshot.brokenLinkCount}_broken_links`);
    }
    load.snapshot.compatibility?.warnings.forEach((warning, index) => {
        warnings.push(`compatibility_warning:${index}:${warning}`);
    });
    const status = blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warnings" : "ready";
    return {
        status,
        checked_at: load.snapshot.checkedAt,
        blocker_count: blockers.length,
        warning_count: warnings.length,
        blockers,
        warnings
    };
}
export function buildSectionPayload(name, load, indexResult) {
    const sectionValue = resolveSectionValue(load.document, name);
    if (typeof sectionValue === "undefined") {
        return null;
    }
    return {
        status: load.snapshot.status === "valid" ? "available" : "blocked",
        section: name,
        count: Array.isArray(sectionValue) ? sectionValue.length : sectionValue ? 1 : 0,
        entity_ids: indexResult.index
            ? indexResult.index.sections.find((section) => section.key === name)?.entityIds ?? []
            : [],
        data: sectionValue,
        load: load.snapshot.status === "valid" ? undefined : load.snapshot
    };
}
export function buildEntityPayload(id, load, indexResult) {
    if (!indexResult.index || !load.document) {
        return null;
    }
    const entity = indexResult.index.entityById.get(id);
    if (!entity) {
        return null;
    }
    return {
        entity,
        raw: resolveJsonPath(load.document, entity.sourcePath),
        outbound_links: indexResult.index.outboundById.get(id) ?? [],
        inbound_links: indexResult.index.inboundById.get(id) ?? []
    };
}
export function buildTracePayload(id, indexResult) {
    if (!indexResult.index) {
        return null;
    }
    const entity = indexResult.index.entityById.get(id);
    if (!entity) {
        return null;
    }
    const outbound = indexResult.index.outboundById.get(id) ?? [];
    const inbound = indexResult.index.inboundById.get(id) ?? [];
    const links = [...inbound, ...outbound];
    const relatedIds = new Set([id]);
    links.forEach((link) => {
        relatedIds.add(link.source);
        relatedIds.add(link.target);
    });
    const nodes = [...relatedIds].map((relatedId) => {
        const related = indexResult.index?.entityById.get(relatedId);
        return related
            ? related
            : {
                id: relatedId,
                kind: "missing",
                section: "meta",
                label: "Missing reference",
                status: "missing",
                sourcePath: ""
            };
    });
    return {
        selected_entity: entity,
        nodes,
        links,
        inbound_count: inbound.length,
        outbound_count: outbound.length,
        broken_links: links.filter((link) => !link.valid)
    };
}
export function listAvailableSectionNames() {
    return [...new Set([...topLevelSections, ...indexedSectionNames])].sort((left, right) => left.localeCompare(right));
}
export function resolveSectionValue(document, name) {
    const aliases = {
        "requirements.functional": "$.requirements.functional",
        "requirements.non_functional": "$.requirements.non_functional",
        "constraints.technical": "$.constraints.technical",
        "constraints.dependencies": "$.constraints.dependencies",
        "delivery.milestones": "$.delivery.milestones",
        "delivery.operational_readiness": "$.delivery.operational_readiness",
        "project_tracking.pending_work": "$.project_tracking.pending_work",
        "project_tracking.issues_found": "$.project_tracking.issues_found",
        "project_tracking.blockers": "$.project_tracking.blockers",
        "project_tracking.notes": "$.project_tracking.notes",
        "extensions.registry": "$.extensions.registry"
    };
    if (name in aliases) {
        return resolveJsonPath(document, aliases[name]);
    }
    const topLevel = asRecord(document);
    return topLevel?.[name];
}
export function resolveJsonPath(document, path) {
    if (path === "$") {
        return document;
    }
    let current = document;
    const tokens = [...path.matchAll(/\.([A-Za-z_][A-Za-z0-9_]*)|\[(\d+)\]/g)];
    for (const token of tokens) {
        const property = token[1];
        const index = token[2];
        if (property) {
            current = asRecord(current)?.[property];
            continue;
        }
        if (typeof index !== "undefined") {
            current = asArray(current)[Number(index)];
        }
    }
    return current;
}
function asRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : null;
}
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function readOptionalString(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
}
