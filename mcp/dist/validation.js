import fs from "node:fs/promises";
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsImport from "ajv-formats";
const addFormats = addFormatsImport;
const validatorCache = new Map();
export function createValidationFailureResult(message, checkedAt = new Date().toISOString(), pathValue = "$", keyword = "parse") {
    return {
        status: "invalid",
        checkedAt,
        issues: [
            {
                path: pathValue,
                keyword,
                message,
                severity: "error"
            }
        ]
    };
}
export async function validatePrdDocument(document, repoRoot, checkedAt = new Date().toISOString()) {
    const validate = await getValidateFunction(repoRoot);
    const isValid = validate(document);
    if (isValid) {
        return {
            status: "valid",
            checkedAt,
            issues: []
        };
    }
    return {
        status: "invalid",
        checkedAt,
        issues: validate.errors?.map((error) => ({
            path: formatErrorPath(error.instancePath, error.params),
            keyword: error.keyword,
            message: error.message ?? "Schema validation failed.",
            severity: "error"
        })) ?? []
    };
}
async function getValidateFunction(repoRoot) {
    const schemaPath = path.resolve(repoRoot, "schema.strict.json");
    const cached = validatorCache.get(schemaPath);
    if (cached) {
        return cached;
    }
    const pending = fs.readFile(schemaPath, "utf8").then((text) => {
        const schema = JSON.parse(text);
        const ajv = new Ajv2020({
            allErrors: true,
            strict: false
        });
        addFormats(ajv);
        return ajv.compile(schema);
    });
    validatorCache.set(schemaPath, pending);
    return pending;
}
function formatErrorPath(instancePath, params) {
    const pathSegments = instancePath.split("/").filter(Boolean).map(unescapeJsonPointerSegment);
    if (typeof params.additionalProperty === "string") {
        pathSegments.push(params.additionalProperty);
    }
    if (pathSegments.length === 0) {
        return "$";
    }
    return `$${pathSegments.map((segment) => `[${JSON.stringify(segment)}]`).join("")}`;
}
function unescapeJsonPointerSegment(segment) {
    return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}
