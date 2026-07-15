import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const repoRoot = path.resolve(import.meta.dirname, "../..");
const seedPrdPath = path.resolve(repoRoot, "viewer/PRD_web_ui.json");
export async function loadSeedPrd() {
    return JSON.parse(await fs.readFile(seedPrdPath, "utf8"));
}
export async function createFixture(variant, prefix = "prd-mcp-fixture-") {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    const prdPath = path.join(tempDir, "prd.json");
    const metricsPath = path.join(tempDir, "metrics", "prd-viewer-mcp.jsonl");
    if (variant === "malformed_json") {
        await fs.writeFile(prdPath, "{");
        return {
            repoRoot,
            tempDir,
            prdPath,
            metricsPath
        };
    }
    const seed = await loadSeedPrd();
    const fixture = applyVariant(seed, variant);
    await fs.writeFile(prdPath, JSON.stringify(fixture, null, 2));
    return {
        repoRoot,
        tempDir,
        prdPath,
        metricsPath
    };
}
function applyVariant(seed, variant) {
    const fixture = structuredClone(seed);
    const meta = fixture.meta;
    const schemaContract = (meta.schema_contract ?? {});
    if (variant === "schema_invalid") {
        meta.title = "";
        return fixture;
    }
    if (variant === "unsupported_schema_version") {
        meta.schema_contract = {
            ...schemaContract,
            schema_version: "9.9.9",
            compatibility_mode: "unknown"
        };
        return fixture;
    }
    if (variant === "required_extension") {
        const extension = {
            extension_id: "fixture.required",
            name: "Fixture required extension",
            version: "1.0.0",
            required: true
        };
        meta.schema_contract = {
            ...schemaContract,
            extension_policy: "registered_extensions",
            extensions: [extension]
        };
        fixture.extensions = {
            registry: [extension],
            data: {
                [extension.extension_id]: {
                    enabled: true
                }
            }
        };
        return fixture;
    }
    if (variant === "broken_trace_links") {
        const projectTracking = fixture.project_tracking;
        const pendingWork = Array.isArray(projectTracking.pending_work)
            ? projectTracking.pending_work
            : [];
        const firstWorkItem = pendingWork.find((item) => item.work_item_id === "PTW-008") ??
            pendingWork[0];
        if (firstWorkItem) {
            const linkedEntityIds = Array.isArray(firstWorkItem.linked_entity_ids)
                ? [...firstWorkItem.linked_entity_ids]
                : [];
            if (!linkedEntityIds.includes("FR-999")) {
                linkedEntityIds.push("FR-999");
            }
            firstWorkItem.linked_entity_ids = linkedEntityIds;
        }
        return fixture;
    }
    return fixture;
}
