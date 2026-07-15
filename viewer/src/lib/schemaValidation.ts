import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import strictPrdSchema from "../../../schema.strict.json";

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

const ajv = new Ajv2020({
  allErrors: true,
  strict: false
});

addFormats(ajv);

const validateStrictPrd = ajv.compile(strictPrdSchema);

export function createValidationNotRunResult(): ValidationResult {
  return {
    status: "not_run",
    checkedAt: null,
    issues: []
  };
}

export function createValidationFailureResult(
  message: string,
  checkedAt = new Date().toISOString(),
  path = "$",
  keyword = "parse"
): ValidationResult {
  return {
    status: "invalid",
    checkedAt,
    issues: [
      {
        path,
        keyword,
        message,
        severity: "error"
      }
    ]
  };
}

export function validatePrdDocument(document: unknown, checkedAt = new Date().toISOString()): ValidationResult {
  const isValid = validateStrictPrd(document);

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
      validateStrictPrd.errors?.map((error) => ({
        path: formatErrorPath(error.instancePath, error.params),
        keyword: error.keyword,
        message: error.message ?? "Schema validation failed.",
        severity: "error"
      })) ?? []
  };
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
