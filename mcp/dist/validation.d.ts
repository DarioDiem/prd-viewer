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
export declare function createValidationFailureResult(message: string, checkedAt?: string, pathValue?: string, keyword?: string): ValidationResult;
export declare function validatePrdDocument(document: unknown, repoRoot: string, checkedAt?: string): Promise<ValidationResult>;
