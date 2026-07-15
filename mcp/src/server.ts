import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";

import type { PrdMcpConfig } from "./config.js";
import { getServerInfoSnapshot } from "./config.js";
import { MetricsRecorder } from "./metrics.js";
import { PrdIndexStore } from "./prd-index.js";
import type { PrdIndexResult } from "./prd-index.js";
import { PrdLoader } from "./prd-loader.js";
import type { PrdLoadResult } from "./prd-loader.js";
import { normalizeResponseMode, wrapResponse, type ResponseEnvelope } from "./response-modes.js";
import {
  buildCompatibilityPayload,
  buildEntityPayload,
  buildProjectTrackingPayload,
  buildReadinessPayload,
  buildSectionPayload,
  buildSummaryPayload,
  buildTracePayload,
  listAvailableSectionNames,
  listEntityResourceDefinitions,
  listSectionResourceDefinitions,
  listTraceResourceDefinitions
} from "./resources.js";
import {
  agentPacketPresets,
  buildAgentPacketResult,
  getEntityResult,
  getLinkedEntitiesResult,
  listBlockersResult,
  listOpenQuestionsResult,
  listProposedDecisionsResult,
  searchPrd
} from "./tools.js";

export type PrdMcpServerServices = {
  config: PrdMcpConfig;
  loader: PrdLoader;
  indexStore: PrdIndexStore;
  metrics: MetricsRecorder;
};

export type PrdMcpServerServicesResolver = () => Promise<PrdMcpServerServices>;

export function createServerServices(config: PrdMcpConfig): PrdMcpServerServices {
  const loader = new PrdLoader(config);
  return {
    config,
    loader,
    indexStore: new PrdIndexStore(loader),
    metrics: new MetricsRecorder(config)
  };
}

export function createServer(
  config: PrdMcpConfig,
  services: PrdMcpServerServices = createServerServices(config),
  resolveServices: PrdMcpServerServicesResolver = async () => services
): McpServer {
  const loader = {
    load: async () => (await resolveServices()).loader.load()
  } as unknown as PrdLoader;
  const indexStore = {
    load: async () => (await resolveServices()).indexStore.load()
  } as unknown as PrdIndexStore;
  const metrics = {
    record: async (...args: Parameters<MetricsRecorder["record"]>) =>
      (await resolveServices()).metrics.record(...args)
  } as unknown as MetricsRecorder;
  const server = new McpServer(
    {
      name: "prd-viewer-mcp",
      version: "0.1.0"
    },
    {
      instructions:
        "This server is local-only and read-only. Treat the PRD JSON on disk as canonical. Prefer focused discovery followed by a budgeted build_agent_packet request. Avoid full-document payloads unless the task requires whole-document validation or migration."
    }
  );

  server.registerResource(
    "prd-summary",
    "prd://summary",
    {
      title: "PRD summary",
      description: "Compact summary of the active PRD load and index state.",
      mimeType: "application/json"
    },
    async (uri) => {
      return handleResourceRequest(metrics, "prd-summary", uri, { mode: uri.searchParams.get("mode") }, async () => {
        const [load, index] = await Promise.all([loader.load(), indexStore.load()]);
        return {
          load,
          index,
          response: wrapResponse("summary", readResourceMode(uri), buildSummaryPayload(load, index), load.snapshot.file.size)
        };
      });
    }
  );

  server.registerResource(
    "prd-summary-mode",
    new ResourceTemplate("prd://summary{?mode}", { list: undefined }),
    {
      title: "PRD summary",
      description: "Compact summary of the active PRD load and index state.",
      mimeType: "application/json"
    },
    async (uri) => {
      return handleResourceRequest(metrics, "prd-summary", uri, { mode: uri.searchParams.get("mode") }, async () => {
        const [load, index] = await Promise.all([loader.load(), indexStore.load()]);
        return {
          load,
          index,
          response: wrapResponse("summary", readResourceMode(uri), buildSummaryPayload(load, index), load.snapshot.file.size)
        };
      });
    }
  );

  server.registerResource(
    "prd-compatibility",
    "prd://compatibility",
    {
      title: "PRD compatibility",
      description: "Schema compatibility status for the active PRD.",
      mimeType: "application/json"
    },
    async (uri) => {
      return handleResourceRequest(metrics, "prd-compatibility", uri, { mode: uri.searchParams.get("mode") }, async () => {
        const load = await loader.load();
        return {
          load,
          response: wrapResponse("compatibility", readResourceMode(uri), buildCompatibilityPayload(load), load.snapshot.file.size)
        };
      });
    }
  );

  server.registerResource(
    "prd-compatibility-mode",
    new ResourceTemplate("prd://compatibility{?mode}", { list: undefined }),
    {
      title: "PRD compatibility",
      description: "Schema compatibility status for the active PRD.",
      mimeType: "application/json"
    },
    async (uri) => {
      return handleResourceRequest(metrics, "prd-compatibility", uri, { mode: uri.searchParams.get("mode") }, async () => {
        const load = await loader.load();
        return {
          load,
          response: wrapResponse("compatibility", readResourceMode(uri), buildCompatibilityPayload(load), load.snapshot.file.size)
        };
      });
    }
  );

  server.registerResource(
    "prd-readiness",
    "prd://readiness",
    {
      title: "PRD readiness",
      description: "Derived approval and review readiness status for the active PRD.",
      mimeType: "application/json"
    },
    async (uri) => {
      return handleResourceRequest(metrics, "prd-readiness", uri, { mode: uri.searchParams.get("mode") }, async () => {
        const [load, index] = await Promise.all([loader.load(), indexStore.load()]);
        return {
          load,
          index,
          response: wrapResponse("readiness", readResourceMode(uri), buildReadinessPayload(load, index), load.snapshot.file.size)
        };
      });
    }
  );

  server.registerResource(
    "prd-readiness-mode",
    new ResourceTemplate("prd://readiness{?mode}", { list: undefined }),
    {
      title: "PRD readiness",
      description: "Derived approval and review readiness status for the active PRD.",
      mimeType: "application/json"
    },
    async (uri) => {
      return handleResourceRequest(metrics, "prd-readiness", uri, { mode: uri.searchParams.get("mode") }, async () => {
        const [load, index] = await Promise.all([loader.load(), indexStore.load()]);
        return {
          load,
          index,
          response: wrapResponse("readiness", readResourceMode(uri), buildReadinessPayload(load, index), load.snapshot.file.size)
        };
      });
    }
  );

  server.registerResource(
    "prd-project-tracking",
    "prd://project-tracking",
    {
      title: "PRD project tracking",
      description: "Project-tracking section and derived counts for the active PRD.",
      mimeType: "application/json"
    },
    async (uri) => {
      return handleResourceRequest(metrics, "prd-project-tracking", uri, { mode: uri.searchParams.get("mode") }, async () => {
        const [load, index] = await Promise.all([loader.load(), indexStore.load()]);
        return {
          load,
          index,
          response: wrapResponse(
            "project_tracking",
            readResourceMode(uri),
            buildProjectTrackingPayload(load, index),
            load.snapshot.file.size
          )
        };
      });
    }
  );

  server.registerResource(
    "prd-project-tracking-mode",
    new ResourceTemplate("prd://project-tracking{?mode}", { list: undefined }),
    {
      title: "PRD project tracking",
      description: "Project-tracking section and derived counts for the active PRD.",
      mimeType: "application/json"
    },
    async (uri) => {
      return handleResourceRequest(metrics, "prd-project-tracking", uri, { mode: uri.searchParams.get("mode") }, async () => {
        const [load, index] = await Promise.all([loader.load(), indexStore.load()]);
        return {
          load,
          index,
          response: wrapResponse(
            "project_tracking",
            readResourceMode(uri),
            buildProjectTrackingPayload(load, index),
            load.snapshot.file.size
          )
        };
      });
    }
  );

  server.registerResource(
    "server-info",
    "prd://server/info",
    {
      title: "PRD MCP server info",
      description: "Reports the local MCP contract, active PRD path, and planned capability surface.",
      mimeType: "application/json"
    },
    async (uri) => {
      return handleResourceRequest(metrics, "server-info-resource", uri, { mode: uri.searchParams.get("mode") }, async () => {
        const snapshot = await getServerInfoSnapshot((await resolveServices()).config);
        const activePrd = await loader.load();
        const activeIndex = await indexStore.load();

        return {
          load: activePrd,
          index: activeIndex,
          response: wrapResponse(
            "server_info",
            readResourceMode(uri),
            {
              ...snapshot,
              activePrd: activePrd.snapshot,
              activeIndex: activeIndex.snapshot
            },
            activePrd.snapshot.file.size
          )
        };
      });
    }
  );

  server.registerResource(
    "server-info-mode",
    new ResourceTemplate("prd://server/info{?mode}", { list: undefined }),
    {
      title: "PRD MCP server info",
      description: "Reports the local MCP contract, active PRD path, and planned capability surface.",
      mimeType: "application/json"
    },
    async (uri) => {
      return handleResourceRequest(metrics, "server-info-resource", uri, { mode: uri.searchParams.get("mode") }, async () => {
        const snapshot = await getServerInfoSnapshot((await resolveServices()).config);
        const activePrd = await loader.load();
        const activeIndex = await indexStore.load();

        return {
          load: activePrd,
          index: activeIndex,
          response: wrapResponse(
            "server_info",
            readResourceMode(uri),
            {
              ...snapshot,
              activePrd: activePrd.snapshot,
              activeIndex: activeIndex.snapshot
            },
            activePrd.snapshot.file.size
          )
        };
      });
    }
  );

  server.registerResource(
    "prd-section",
    new ResourceTemplate("prd://section/{name}{?mode}", {
      list: async () => {
        const index = await indexStore.load();
        return {
          resources: listSectionResourceDefinitions(index)
        };
      },
      complete: {
        name: async (value) =>
          listAvailableSectionNames().filter((name) => name.startsWith(value))
      }
    }),
    {
      title: "PRD section",
      description: "Focused section read for the active PRD.",
      mimeType: "application/json"
    },
    async (uri, variables) => {
      const name = readTemplateVariable(variables.name);
      return handleResourceRequest(
        metrics,
        "prd-section",
        uri,
        { mode: uri.searchParams.get("mode"), sections: [name] },
        async () => {
          const [load, index] = await Promise.all([loader.load(), indexStore.load()]);
          const payload = buildSectionPayload(name, load, index);

          if (!payload) {
            throw new McpError(ErrorCode.InvalidParams, `Section ${name} not found`);
          }

          return {
            load,
            index,
            response: wrapResponse("section", readResourceMode(uri), payload, load.snapshot.file.size)
          };
        }
      );
    }
  );

  server.registerResource(
    "prd-entity",
    new ResourceTemplate("prd://entity/{id}{?mode}", {
      list: async () => {
        const index = await indexStore.load();
        return {
          resources: listEntityResourceDefinitions(index)
        };
      }
    }),
    {
      title: "PRD entity",
      description: "Focused entity lookup for the active PRD.",
      mimeType: "application/json"
    },
    async (uri, variables) => {
      const id = readTemplateVariable(variables.id);
      return handleResourceRequest(metrics, "prd-entity", uri, { mode: uri.searchParams.get("mode"), id }, async () => {
        const [load, index] = await Promise.all([loader.load(), indexStore.load()]);
        const payload = buildEntityPayload(id, load, index);

        if (!payload) {
          throw new McpError(ErrorCode.InvalidParams, `Entity ${id} not found`);
        }

        return {
          load,
          index,
          response: wrapResponse("entity", readResourceMode(uri), payload, load.snapshot.file.size)
        };
      });
    }
  );

  server.registerResource(
    "prd-trace",
    new ResourceTemplate("prd://trace/{id}{?mode}", {
      list: async () => {
        const index = await indexStore.load();
        return {
          resources: listTraceResourceDefinitions(index)
        };
      }
    }),
    {
      title: "PRD trace",
      description: "Focused trace graph for one PRD entity.",
      mimeType: "application/json"
    },
    async (uri, variables) => {
      const id = readTemplateVariable(variables.id);
      return handleResourceRequest(metrics, "prd-trace", uri, { mode: uri.searchParams.get("mode"), id }, async () => {
        const [load, index] = await Promise.all([loader.load(), indexStore.load()]);
        const payload = buildTracePayload(id, index);

        if (!payload) {
          throw new McpError(ErrorCode.InvalidParams, `Trace node ${id} not found`);
        }

        return {
          load,
          index,
          response: wrapResponse("trace", readResourceMode(uri), payload, load.snapshot.file.size)
        };
      });
    }
  );

  server.registerTool(
    "server_info",
    {
      title: "Server info",
      description: "Return the local MCP server configuration and current scaffold status.",
      inputSchema: {
        mode: z.enum(["compact", "standard", "full"]).optional().describe("Response shaping mode")
      }
    },
    async ({ mode }) => {
      return handleToolRequest(metrics, "server_info", { mode }, async () => {
        const snapshot = await getServerInfoSnapshot((await resolveServices()).config);
        const activePrd = await loader.load();
        const activeIndex = await indexStore.load();

        return {
          load: activePrd,
          index: activeIndex,
          response: wrapResponse(
            "server_info",
            normalizeResponseMode(mode),
            {
              ...snapshot,
              activePrd: activePrd.snapshot,
              activeIndex: activeIndex.snapshot
            },
            activePrd.snapshot.file.size
          )
        };
      });
    }
  );

  server.registerTool(
    "search_prd",
    {
      title: "Search PRD",
      description: "Search indexed PRD entities and sections by ID, title, or section name.",
      inputSchema: {
        query: z.string().min(1).describe("Search text"),
        sections: z.array(z.string()).optional().describe("Optional section filters"),
        limit: z.number().int().min(1).max(25).optional().describe("Maximum number of results"),
        mode: z.enum(["compact", "standard", "full"]).optional().describe("Response shaping mode")
      }
    },
    async ({ query, sections, limit, mode }) => {
      return handleToolRequest(metrics, "search_prd", { query, sections, limit, mode }, async () => {
        const [load, index] = await Promise.all([loader.load(), indexStore.load()]);
        const results = searchPrd(query, index, sections ?? [], limit ?? 10);

        return {
          load,
          index,
          response: wrapResponse(
            "search_prd",
            normalizeResponseMode(mode),
            {
              query,
              count: results.length,
              results
            },
            load.snapshot.file.size
          )
        };
      });
    }
  );

  server.registerTool(
    "get_entity",
    {
      title: "Get entity",
      description: "Return one indexed PRD entity with its raw payload and direct links.",
      inputSchema: {
        id: z.string().min(1).describe("Stable PRD entity ID"),
        mode: z.enum(["compact", "standard", "full"]).optional().describe("Response shaping mode")
      }
    },
    async ({ id, mode }) => {
      return handleToolRequest(metrics, "get_entity", { id, mode }, async () => {
        const [load, index] = await Promise.all([loader.load(), indexStore.load()]);
        const entity = getEntityResult(id, load, index);

        if (!entity) {
          throw new McpError(ErrorCode.InvalidParams, `Entity ${id} not found`);
        }

        return {
          load,
          index,
          response: wrapResponse("entity", normalizeResponseMode(mode), entity, load.snapshot.file.size)
        };
      });
    }
  );

  server.registerTool(
    "get_linked_entities",
    {
      title: "Get linked entities",
      description: "Return inbound and outbound links plus directly connected entities for one PRD entity.",
      inputSchema: {
        id: z.string().min(1).describe("Stable PRD entity ID"),
        mode: z.enum(["compact", "standard", "full"]).optional().describe("Response shaping mode")
      }
    },
    async ({ id, mode }) => {
      return handleToolRequest(metrics, "get_linked_entities", { id, mode }, async () => {
        const [load, index] = await Promise.all([loader.load(), indexStore.load()]);
        const linked = getLinkedEntitiesResult(id, load, index);

        if (!linked) {
          throw new McpError(ErrorCode.InvalidParams, `Entity ${id} not found`);
        }

        return {
          load,
          index,
          response: wrapResponse("get_linked_entities", normalizeResponseMode(mode), linked, load.snapshot.file.size)
        };
      });
    }
  );

  server.registerTool(
    "list_blockers",
    {
      title: "List blockers",
      description: "Return project-tracking blockers from the active PRD.",
      inputSchema: {
        mode: z.enum(["compact", "standard", "full"]).optional().describe("Response shaping mode")
      }
    },
    async ({ mode }) => {
      return handleToolRequest(metrics, "list_blockers", { mode }, async () => {
        const [load, index] = await Promise.all([loader.load(), indexStore.load()]);
        return {
          load,
          index,
          response: wrapResponse(
            "list_blockers",
            normalizeResponseMode(mode),
            listBlockersResult(load, index),
            load.snapshot.file.size
          )
        };
      });
    }
  );

  server.registerTool(
    "list_open_questions",
    {
      title: "List open questions",
      description: "Return unresolved open questions from the active PRD.",
      inputSchema: {
        mode: z.enum(["compact", "standard", "full"]).optional().describe("Response shaping mode")
      }
    },
    async ({ mode }) => {
      return handleToolRequest(metrics, "list_open_questions", { mode }, async () => {
        const load = await loader.load();
        return {
          load,
          response: wrapResponse(
            "list_open_questions",
            normalizeResponseMode(mode),
            listOpenQuestionsResult(load),
            load.snapshot.file.size
          )
        };
      });
    }
  );

  server.registerTool(
    "list_proposed_decisions",
    {
      title: "List proposed decisions",
      description: "Return decisions that still remain in proposed state.",
      inputSchema: {
        mode: z.enum(["compact", "standard", "full"]).optional().describe("Response shaping mode")
      }
    },
    async ({ mode }) => {
      return handleToolRequest(metrics, "list_proposed_decisions", { mode }, async () => {
        const load = await loader.load();
        return {
          load,
          response: wrapResponse(
            "list_proposed_decisions",
            normalizeResponseMode(mode),
            listProposedDecisionsResult(load),
            load.snapshot.file.size
          )
        };
      });
    }
  );

  server.registerTool(
    "build_agent_packet",
    {
      title: "Build agent packet",
      description: "Build a token-budgeted packet for agent work from selected IDs and sections.",
      inputSchema: {
        ids: z.array(z.string()).optional().describe("Stable entity IDs to include"),
        sections: z.array(z.string()).optional().describe("Section names to include"),
        goal: z.string().max(1000).optional().describe("Optional task goal for the packet"),
        preset: z.enum(agentPacketPresets).optional().describe("Task preset; review and triage include unresolved work by default"),
        max_tokens: z.number().int().min(256).max(32000).optional().describe("Maximum estimated tokens in the raw packet; defaults to 6000"),
        include_unresolved: z.boolean().optional().describe("Override whether blockers, questions, and proposed decisions are included"),
        mode: z.enum(["compact", "standard", "full"]).optional().describe("Response shaping mode")
      }
    },
    async ({ ids, sections, goal, preset, max_tokens, include_unresolved, mode }) => {
      return handleToolRequest(metrics, "build_agent_packet", { ids, sections, goal, preset, max_tokens, include_unresolved, mode }, async () => {
        const [load, index] = await Promise.all([loader.load(), indexStore.load()]);
        const packet = buildAgentPacketResult(load, index, ids ?? [], sections ?? [], goal ?? null, {
          preset,
          maxTokens: max_tokens,
          includeUnresolved: include_unresolved
        });

        return {
          load,
          index,
          response: wrapResponse("build_agent_packet", normalizeResponseMode(mode), packet, load.snapshot.file.size)
        };
      });
    }
  );

  return server;
}

function jsonResource(uri: URL, payload: unknown) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

function readTemplateVariable(value: unknown): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? "");
  }

  return String(value ?? "");
}

function readResourceMode(uri: URL) {
  return normalizeResponseMode(uri.searchParams.get("mode"));
}

function toolJson(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

type HandlerSuccess = {
  response: ResponseEnvelope;
  load?: PrdLoadResult | null;
  index?: PrdIndexResult | null;
  scope?: "focused" | "full_document";
};

async function handleResourceRequest(
  metrics: MetricsRecorder,
  name: string,
  uri: URL,
  input: Record<string, unknown>,
  execute: () => Promise<HandlerSuccess>
) {
  const startedAt = performance.now();
  let load: PrdLoadResult | null = null;
  let index: PrdIndexResult | null = null;

  try {
    const result = await execute();
    load = result.load ?? null;
    index = result.index ?? null;
    await metrics.record({
      channel: "resource",
      name,
      target: uri.href,
      requestedMode: uri.searchParams.get("mode"),
      input,
      load,
      index,
      response: result.response,
      scope: result.scope,
      durationMs: performance.now() - startedAt
    });
    return jsonResource(uri, result.response);
  } catch (error) {
    await metrics.record({
      channel: "resource",
      name,
      target: uri.href,
      requestedMode: uri.searchParams.get("mode"),
      input,
      load,
      index,
      scope: "focused",
      durationMs: performance.now() - startedAt,
      error
    });
    throw error;
  }
}

async function handleToolRequest(
  metrics: MetricsRecorder,
  name: string,
  input: Record<string, unknown>,
  execute: () => Promise<HandlerSuccess>
) {
  const startedAt = performance.now();
  let load: PrdLoadResult | null = null;
  let index: PrdIndexResult | null = null;

  try {
    const result = await execute();
    load = result.load ?? null;
    index = result.index ?? null;
    await metrics.record({
      channel: "tool",
      name,
      target: name,
      requestedMode: typeof input.mode === "string" ? input.mode : null,
      input,
      load,
      index,
      response: result.response,
      scope: result.scope,
      durationMs: performance.now() - startedAt
    });
    return toolJson(result.response);
  } catch (error) {
    await metrics.record({
      channel: "tool",
      name,
      target: name,
      requestedMode: typeof input.mode === "string" ? input.mode : null,
      input,
      load,
      index,
      scope: "focused",
      durationMs: performance.now() - startedAt,
      error
    });
    throw error;
  }
}
