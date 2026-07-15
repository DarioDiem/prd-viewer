import fs from "node:fs/promises";
import path from "node:path";

import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormatsImport from "ajv-formats";

export type ValidationIssue = {
  path: string;
  message: string;
  keyword?: string;
  severity: "error" | "warning";
};

export type ValidationResult = {
  status: "not_run" | "valid" | "invalid";
  checkedAt: string | null;
  issues: ValidationIssue[];
};

const addFormats = addFormatsImport as unknown as (ajv: Ajv2020) => void;
const validatorCache = new Map<string, Promise<ValidateFunction>>();

export function createValidationFailureResult(
  message: string,
  checkedAt = new Date().toISOString(),
  pathValue = "$",
  keyword = "parse"
): ValidationResult {
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

export async function validatePrdDocument(
  document: unknown,
  repoRoot: string,
  checkedAt = new Date().toISOString()
): Promise<ValidationResult> {
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
    issues:
      validate.errors?.map((error: ErrorObject) => ({
        path: formatErrorPath(error.instancePath, error.params),
        keyword: error.keyword,
        message: error.message ?? "Schema validation failed.",
        severity: "error"
      })) ?? []
  };
}

async function getValidateFunction(repoRoot: string): Promise<ValidateFunction> {
  const schemaPath = path.resolve(repoRoot, "schema.strict.json");
  const cached = validatorCache.get(schemaPath);

  if (cached) {
    return cached;
  }

  const pending = fs.readFile(schemaPath, "utf8").then((text) => {
    const schema = JSON.parse(text) as object;
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

function formatErrorPath(instancePath: string, params: Record<string, unknown>): string {
  const pathSegments = instancePath.split("/").filter(Boolean).map(unescapeJsonPointerSegment);

  if (typeof params.additionalProperty === "string") {
    pathSegments.push(params.additionalProperty);
  }

  if (pathSegments.length === 0) {
    return "$";
  }

  return `$${pathSegments.map((segment) => `[${JSON.stringify(segment)}]`).join("")}`;
}

function unescapeJsonPointerSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}
