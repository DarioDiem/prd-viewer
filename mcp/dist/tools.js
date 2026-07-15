import { buildEntityPayload, buildSectionPayload, buildTracePayload, listAvailableSectionNames } from "./resources.js";
export const agentPacketPresets = ["implementation", "review", "triage", "schema_change"];
export function searchPrd(query, indexResult, sections = [], limit = 10) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery || !indexResult.index) {
        return [];
    }
    const normalizedSections = sections.map((section) => section.trim()).filter(Boolean);
    const entityResults = indexResult.index.entities
        .filter((entity) => matchesSectionFilter(entity.section, normalizedSections))
        .map((entity) => scoreEntity(normalizedQuery, entity))
        .filter((result) => result !== null);
    const sectionResults = listAvailableSectionNames()
        .filter((section) => matchesSectionFilter(section, normalizedSections))
        .map((section) => scoreSection(normalizedQuery, section))
        .filter((result) => result !== null);
    return [...entityResults, ...sectionResults]
        .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
        .slice(0, Math.max(1, limit));
}
export function getEntityResult(id, load, indexResult) {
    return buildEntityPayload(id, load, indexResult);
}
export function getLinkedEntitiesResult(id, load, indexResult) {
    if (!indexResult.index) {
        return null;
    }
    const entity = indexResult.index.entityById.get(id);
    if (!entity) {
        return null;
    }
    const outbound = indexResult.index.outboundById.get(id) ?? [];
    const inbound = indexResult.index.inboundById.get(id) ?? [];
    const linkedIds = new Set();
    [...outbound, ...inbound].forEach((link) => {
        if (link.source !== id) {
            linkedIds.add(link.source);
        }
        if (link.target !== id) {
            linkedIds.add(link.target);
        }
    });
    return {
        entity,
        outbound_links: outbound,
        inbound_links: inbound,
        linked_entities: [...linkedIds]
            .map((linkedId) => buildEntityPayload(linkedId, load, indexResult))
            .filter((item) => item !== null)
    };
}
export function listBlockersResult(load, indexResult) {
    const section = buildSectionPayload("project_tracking.blockers", load, indexResult);
    return {
        count: section?.count ?? 0,
        blockers: Array.isArray(section?.data) ? section.data : []
    };
}
export function listOpenQuestionsResult(load) {
    const document = asRecord(load.document);
    const openQuestions = asArray(document?.open_questions).filter((item) => {
        const record = asRecord(item);
        return readOptionalString(record?.status) !== "resolved";
    });
    return {
        count: openQuestions.length,
        open_questions: openQuestions
    };
}
export function listProposedDecisionsResult(load) {
    const document = asRecord(load.document);
    const proposedDecisions = asArray(document?.decisions).filter((item) => {
        const record = asRecord(item);
        return readOptionalString(record?.status) === "proposed";
    });
    return {
        count: proposedDecisions.length,
        proposed_decisions: proposedDecisions
    };
}
export function buildAgentPacketResult(load, indexResult, ids = [], sections = [], goal = null, options = {}) {
    const selectedIds = unique(ids.filter(Boolean));
    const selectedSections = unique(sections.filter(Boolean));
    const preset = options.preset ?? "implementation";
    const maxTokens = Math.min(32_000, Math.max(256, Math.round(options.maxTokens ?? 6_000)));
    const includeUnresolved = options.includeUnresolved ?? (preset === "review" || preset === "triage");
    const packet = {
        schema: "prd.agent-packet.v2",
        goal,
        preset,
        max_tokens: maxTokens,
        estimated_tokens: 0,
        include_unresolved: includeUnresolved,
        truncated: false,
        omitted: {
            sections: [],
            entity_ids: [],
            trace_ids: [],
            unresolved_items: 0
        },
        selected_ids: selectedIds,
        selected_sections: selectedSections,
        summary: load.snapshot.summary
            ? {
                prd_id: load.snapshot.summary.prdId,
                title: load.snapshot.summary.title,
                document_version: load.snapshot.summary.documentVersion,
                schema_version: load.snapshot.summary.schemaVersion,
                updated_at: load.snapshot.summary.updatedAt
            }
            : null,
        sections: [],
        entities: [],
        traces: [],
        unresolved: {
            blockers: [],
            open_questions: [],
            proposed_decisions: []
        }
    };
    selectedIds.forEach((id) => {
        const entity = buildEntityPayload(id, load, indexResult);
        if (entity && !appendWithinBudget(packet, packet.entities, entity, maxTokens)) {
            packet.omitted.entity_ids.push(id);
        }
    });
    selectedIds.forEach((id) => {
        const trace = buildTracePayload(id, indexResult);
        if (trace && !appendWithinBudget(packet, packet.traces, trace, maxTokens)) {
            packet.omitted.trace_ids.push(id);
        }
    });
    selectedSections.forEach((section) => {
        const payload = buildSectionPayload(section, load, indexResult);
        if (payload && !appendWithinBudget(packet, packet.sections, payload, maxTokens)) {
            packet.omitted.sections.push(section);
        }
    });
    if (includeUnresolved) {
        const blockers = listBlockersResult(load, indexResult);
        const unresolvedGroups = [
            [packet.unresolved.blockers, Array.isArray(blockers.blockers) ? blockers.blockers.slice(0, 10) : []],
            [packet.unresolved.open_questions, listOpenQuestionsResult(load).open_questions.slice(0, 10)],
            [packet.unresolved.proposed_decisions, listProposedDecisionsResult(load).proposed_decisions.slice(0, 10)]
        ];
        unresolvedGroups.forEach(([target, items]) => {
            items.forEach((item) => {
                if (!appendWithinBudget(packet, target, item, maxTokens)) {
                    packet.omitted.unresolved_items += 1;
                }
            });
        });
    }
    packet.truncated = packet.omitted.sections.length > 0 ||
        packet.omitted.entity_ids.length > 0 ||
        packet.omitted.trace_ids.length > 0 ||
        packet.omitted.unresolved_items > 0;
    packet.estimated_tokens = estimateTokens(packet);
    return packet;
}
function appendWithinBudget(packet, target, item, maxTokens) {
    target.push(item);
    if (estimateTokens(packet) <= maxTokens) {
        return true;
    }
    target.pop();
    return false;
}
function estimateTokens(value) {
    return Math.ceil(Buffer.byteLength(JSON.stringify(value), "utf8") / 4);
}
function scoreEntity(query, entity) {
    const id = entity.id.toLowerCase();
    const label = entity.label.toLowerCase();
    const section = String(entity.section).toLowerCase();
    const haystack = `${id} ${label} ${section}`;
    if (!haystack.includes(query)) {
        return null;
    }
    let score = 1;
    if (id === query) {
        score += 100;
    }
    else if (id.startsWith(query)) {
        score += 50;
    }
    if (label.includes(query)) {
        score += 25;
    }
    if (section.includes(query)) {
        score += 10;
    }
    return {
        type: "entity",
        id: entity.id,
        title: entity.label,
        section: String(entity.section),
        score,
        status: entity.status
    };
}
function scoreSection(query, section) {
    const normalizedSection = section.toLowerCase();
    if (!normalizedSection.includes(query)) {
        return null;
    }
    return {
        type: "section",
        id: section,
        title: section,
        section,
        score: normalizedSection === query ? 40 : normalizedSection.startsWith(query) ? 20 : 5,
        status: null
    };
}
function matchesSectionFilter(section, filters) {
    if (filters.length === 0) {
        return true;
    }
    return filters.some((filter) => section === filter || String(section).startsWith(`${filter}.`) || filter === String(section));
}
function unique(values) {
    return [...new Set(values)];
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
