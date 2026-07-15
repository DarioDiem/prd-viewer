export const responseModes = ["compact", "standard", "full"] as const;

export type ResponseMode = (typeof responseModes)[number];

export type PayloadEstimate = {
  json_bytes: number;
  json_chars: number;
  approx_tokens: number;
};

export type ResponseEnvelope = {
  kind: string;
  mode: ResponseMode;
  estimates: PayloadEstimate & {
    baseline_document_bytes: number | null;
    baseline_document_approx_tokens: number | null;
    savings_vs_document_bytes: number | null;
    savings_vs_document_tokens: number | null;
  };
  payload: unknown;
};

export function normalizeResponseMode(input: string | null | undefined): ResponseMode {
  if (input === "standard" || input === "full") {
    return input;
  }

  return "compact";
}

export function wrapResponse(
  kind: string,
  mode: ResponseMode,
  rawPayload: unknown,
  baselineDocumentBytes: number | null
): ResponseEnvelope {
  const payload = shapePayload(kind, mode, rawPayload);
  const estimate = estimateJsonPayload(payload);
  const baselineTokens = baselineDocumentBytes === null ? null : approximateTokensFromBytes(baselineDocumentBytes);

  return {
    kind,
    mode,
    estimates: {
      ...estimate,
      baseline_document_bytes: baselineDocumentBytes,
      baseline_document_approx_tokens: baselineTokens,
      savings_vs_document_bytes: baselineDocumentBytes === null ? null : baselineDocumentBytes - estimate.json_bytes,
      savings_vs_document_tokens: baselineTokens === null ? null : baselineTokens - estimate.approx_tokens
    },
    payload
  };
}

export function estimateJsonPayload(payload: unknown): PayloadEstimate {
  const text = JSON.stringify(payload);
  const jsonBytes = Buffer.byteLength(text, "utf8");

  return {
    json_bytes: jsonBytes,
    json_chars: text.length,
    approx_tokens: approximateTokensFromBytes(jsonBytes)
  };
}

function shapePayload(kind: string, mode: ResponseMode, payload: unknown): unknown {
  if (mode === "full") {
    return payload;
  }

  if (kind === "server_info") {
    return shapeServerInfo(mode, payload);
  }

  if (kind === "summary") {
    return shapeSummary(mode, payload);
  }

  if (kind === "compatibility") {
    return shapeCompatibility(mode, payload);
  }

  if (kind === "readiness") {
    return shapeReadiness(mode, payload);
  }

  if (kind === "project_tracking") {
    return shapeProjectTracking(mode, payload);
  }

  if (kind === "section") {
    return shapeSection(mode, payload);
  }

  if (kind === "entity") {
    return shapeEntity(mode, payload);
  }

  if (kind === "trace") {
    return shapeTrace(mode, payload);
  }

  if (kind === "search_prd") {
    return shapeSearch(mode, payload);
  }

  if (kind === "get_linked_entities") {
    return shapeLinkedEntities(mode, payload);
  }

  if (kind === "list_blockers" || kind === "list_open_questions" || kind === "list_proposed_decisions") {
    return shapeList(mode, payload);
  }

  if (kind === "build_agent_packet") {
    return shapeAgentPacket(mode, payload);
  }

  return payload;
}

function shapeServerInfo(mode: ResponseMode, payload: unknown) {
  const record = asRecord(payload);
  const activePrd = asRecord(record?.activePrd);
  const activeIndex = asRecord(record?.activeIndex);

  if (mode === "compact") {
    return {
      transport: record?.transport ?? null,
      mode: record?.mode ?? null,
      prdPath: record?.prdPath ?? null,
      activePrd: {
        status: activePrd?.status ?? null,
        summary: activePrd?.summary ?? null,
        failureReasons: activePrd?.failureReasons ?? []
      },
      activeIndex: {
        status: activeIndex?.status ?? null,
        entityCount: activeIndex?.entityCount ?? 0,
        linkCount: activeIndex?.linkCount ?? 0,
        brokenLinkCount: activeIndex?.brokenLinkCount ?? 0
      }
    };
  }

  return payload;
}

function shapeSummary(mode: ResponseMode, payload: unknown) {
  const record = asRecord(payload);

  if (mode === "compact") {
    return {
      status: record?.status ?? null,
      summary: record?.summary ?? null,
      counts: record?.counts ?? null
    };
  }

  return payload;
}

function shapeCompatibility(mode: ResponseMode, payload: unknown) {
  const record = asRecord(payload);
  const compatibility = asRecord(record?.compatibility);

  if (mode === "compact") {
    return {
      status: compatibility?.status ?? record?.status ?? null,
      current_schema_version: compatibility?.currentSchemaVersion ?? null,
      declared_schema_version: compatibility?.declaredSchemaVersion ?? null,
      migration_required: compatibility?.migrationRequired ?? false,
      required_extensions: asArray(compatibility?.requiredExtensions).map((item) =>
        asRecord(item)?.extension_id ?? item
      ),
      warnings: compatibility?.warnings ?? []
    };
  }

  return payload;
}

function shapeReadiness(mode: ResponseMode, payload: unknown) {
  const record = asRecord(payload);

  if (mode === "compact") {
    return {
      status: record?.status ?? null,
      blocker_count: record?.blocker_count ?? 0,
      warning_count: record?.warning_count ?? 0,
      blockers: asArray(record?.blockers).slice(0, 8),
      warnings: asArray(record?.warnings).slice(0, 8)
    };
  }

  return payload;
}

function shapeProjectTracking(mode: ResponseMode, payload: unknown) {
  const record = asRecord(payload);
  const projectTracking = asRecord(record?.project_tracking);

  if (mode === "compact") {
    return {
      status: record?.status ?? null,
      summary: record?.summary ?? null,
      counts: record?.counts ?? null,
      pending_work_ids: collectIds(projectTracking?.pending_work, "work_item_id"),
      issue_ids: collectIds(projectTracking?.issues_found, "issue_id"),
      blocker_ids: collectIds(projectTracking?.blockers, "blocker_id")
    };
  }

  return payload;
}

function shapeSection(mode: ResponseMode, payload: unknown) {
  const record = asRecord(payload);

  if (mode === "compact") {
    return {
      status: record?.status ?? null,
      section: record?.section ?? null,
      count: record?.count ?? 0,
      entity_ids: record?.entity_ids ?? [],
      sample: summarizeValue(record?.data, 3)
    };
  }

  if (mode === "standard") {
    return {
      status: record?.status ?? null,
      section: record?.section ?? null,
      count: record?.count ?? 0,
      entity_ids: record?.entity_ids ?? [],
      data: summarizeValue(record?.data, 10)
    };
  }

  return payload;
}

function shapeEntity(mode: ResponseMode, payload: unknown) {
  const record = asRecord(payload);
  const entity = record?.entity ?? null;
  const inbound = asArray(record?.inbound_links);
  const outbound = asArray(record?.outbound_links);

  if (mode === "compact") {
    return {
      entity,
      inbound_link_ids: inbound.map((item) => asRecord(item)?.id ?? item),
      outbound_link_ids: outbound.map((item) => asRecord(item)?.id ?? item)
    };
  }

  if (mode === "standard") {
    return {
      entity,
      inbound_links: inbound,
      outbound_links: outbound
    };
  }

  return payload;
}

function shapeTrace(mode: ResponseMode, payload: unknown) {
  const record = asRecord(payload);
  const nodes = asArray(record?.nodes);
  const links = asArray(record?.links);

  if (mode === "compact") {
    return {
      selected_entity: record?.selected_entity ?? null,
      inbound_count: record?.inbound_count ?? 0,
      outbound_count: record?.outbound_count ?? 0,
      broken_link_count: asArray(record?.broken_links).length,
      related_node_ids: nodes.map((item) => asRecord(item)?.id ?? item)
    };
  }

  if (mode === "standard") {
    return {
      selected_entity: record?.selected_entity ?? null,
      nodes,
      links,
      inbound_count: record?.inbound_count ?? 0,
      outbound_count: record?.outbound_count ?? 0,
      broken_links: record?.broken_links ?? []
    };
  }

  return payload;
}

function shapeSearch(mode: ResponseMode, payload: unknown) {
  const record = asRecord(payload);

  if (mode === "compact") {
    return {
      query: record?.query ?? null,
      count: record?.count ?? 0,
      results: asArray(record?.results).map((item) => {
        const result = asRecord(item);
        return {
          type: result?.type ?? null,
          id: result?.id ?? null,
          title: result?.title ?? null,
          score: result?.score ?? null
        };
      })
    };
  }

  return payload;
}

function shapeLinkedEntities(mode: ResponseMode, payload: unknown) {
  const record = asRecord(payload);
  const inbound = asArray(record?.inbound_links);
  const outbound = asArray(record?.outbound_links);
  const linkedEntities = asArray(record?.linked_entities);

  if (mode === "compact") {
    return {
      entity: record?.entity ?? null,
      inbound_count: inbound.length,
      outbound_count: outbound.length,
      linked_entity_ids: linkedEntities.map((item) => asRecord(asRecord(item)?.entity)?.id ?? null).filter(Boolean)
    };
  }

  if (mode === "standard") {
    return {
      entity: record?.entity ?? null,
      inbound_links: inbound,
      outbound_links: outbound,
      linked_entities: linkedEntities.map((item) => {
        const linked = asRecord(item);
        return {
          entity: linked?.entity ?? null,
          inbound_links: summarizeValue(linked?.inbound_links, 5),
          outbound_links: summarizeValue(linked?.outbound_links, 5)
        };
      })
    };
  }

  return payload;
}

function shapeList(mode: ResponseMode, payload: unknown) {
  const record = asRecord(payload);
  const collectionKey = Object.keys(record ?? {}).find((key) => key !== "count");
  const items = collectionKey ? asArray(record?.[collectionKey]) : [];

  if (mode === "compact") {
    return {
      count: record?.count ?? items.length,
      items: items.map((item) => {
        const row = asRecord(item);
        return row?.work_item_id ??
          row?.issue_id ??
          row?.blocker_id ??
          row?.question_id ??
          row?.decision_id ??
          null;
      }).filter(Boolean)
    };
  }

  return payload;
}

function shapeAgentPacket(mode: ResponseMode, payload: unknown) {
  const record = asRecord(payload);

  if (mode === "compact") {
    return {
      schema: record?.schema ?? null,
      goal: record?.goal ?? null,
      preset: record?.preset ?? null,
      max_tokens: record?.max_tokens ?? null,
      estimated_tokens: record?.estimated_tokens ?? null,
      include_unresolved: record?.include_unresolved ?? false,
      truncated: record?.truncated ?? false,
      omitted: record?.omitted ?? null,
      selected_ids: record?.selected_ids ?? [],
      selected_sections: record?.selected_sections ?? [],
      summary: record?.summary ?? null,
      counts: {
        sections: asArray(record?.sections).length,
        entities: asArray(record?.entities).length,
        traces: asArray(record?.traces).length,
        blockers: asArray(asRecord(record?.unresolved)?.blockers).length,
        open_questions: asArray(asRecord(record?.unresolved)?.open_questions).length,
        proposed_decisions: asArray(asRecord(record?.unresolved)?.proposed_decisions).length
      }
    };
  }

  if (mode === "standard") {
    return {
      schema: record?.schema ?? null,
      goal: record?.goal ?? null,
      preset: record?.preset ?? null,
      max_tokens: record?.max_tokens ?? null,
      estimated_tokens: record?.estimated_tokens ?? null,
      include_unresolved: record?.include_unresolved ?? false,
      truncated: record?.truncated ?? false,
      omitted: record?.omitted ?? null,
      selected_ids: record?.selected_ids ?? [],
      selected_sections: record?.selected_sections ?? [],
      summary: record?.summary ?? null,
      sections: summarizeValue(record?.sections, 10),
      entities: summarizeValue(record?.entities, 10),
      traces: summarizeValue(record?.traces, 10),
      unresolved: record?.unresolved ?? null
    };
  }

  return payload;
}

function collectIds(value: unknown, key: string): string[] {
  return asArray(value)
    .map((item) => asRecord(item)?.[key])
    .filter((item): item is string => typeof item === "string" && item.length > 0);
}

function summarizeValue(value: unknown, arrayLimit: number): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, arrayLimit).map((item) => summarizeValue(item, arrayLimit));
  }

  if (typeof value === "string") {
    return value.length > 280 ? `${value.slice(0, 277)}...` : value;
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const summary: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(record)) {
    if (key === "raw" || key === "data") {
      summary[key] = summarizeValue(item, Math.min(arrayLimit, 5));
      continue;
    }

    summary[key] = Array.isArray(item)
      ? summarizeValue(item, Math.min(arrayLimit, 5))
      : typeof item === "object" && item !== null
        ? summarizeObject(item as Record<string, unknown>)
        : summarizeValue(item, arrayLimit);
  }

  return summary;
}

function summarizeObject(record: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") {
      summary[key] = value.length > 180 ? `${value.slice(0, 177)}...` : value;
    } else if (Array.isArray(value)) {
      summary[key] = value.slice(0, 5);
    } else if (typeof value === "object" && value !== null) {
      summary[key] = Object.fromEntries(Object.entries(value).slice(0, 5));
    } else {
      summary[key] = value;
    }
  }

  return summary;
}

function approximateTokensFromBytes(bytes: number): number {
  return Math.ceil(bytes / 4);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
