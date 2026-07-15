import type { PrdDocument, SectionKey } from "../types/prd";

export type SectionChangePreview = {
  section: SectionKey;
  added: number;
  removed: number;
  changed: number;
  samplePaths: string[];
};

export const PRD_SECTION_KEYS: SectionKey[] = [
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
  "decisions"
];

const stableIdKeys = [
  "req_id",
  "story_id",
  "persona_id",
  "assumption_id",
  "constraint_id",
  "dependency_id",
  "risk_id",
  "question_id",
  "decision_id",
  "work_item_id",
  "issue_id",
  "blocker_id",
  "note_id"
];

type DiffAccumulator = {
  added: number;
  removed: number;
  changed: number;
  samplePaths: string[];
};

export function buildChangePreview(before: PrdDocument, after: PrdDocument): SectionChangePreview[] {
  return PRD_SECTION_KEYS.flatMap((section) => {
    const diff = diffValues(before[section], after[section], section);

    if (diff.added === 0 && diff.removed === 0 && diff.changed === 0) {
      return [];
    }

    return {
      section,
      added: diff.added,
      removed: diff.removed,
      changed: diff.changed,
      samplePaths: diff.samplePaths
    };
  });
}

function diffValues(left: unknown, right: unknown, path: string): DiffAccumulator {
  const diff = createEmptyDiff();

  collectDiff(left, right, path, diff);

  return diff;
}

function collectDiff(left: unknown, right: unknown, path: string, diff: DiffAccumulator) {
  if (valuesEqual(left, right)) {
    return;
  }

  if (left === undefined) {
    diff.added += 1;
    addSamplePath(diff, path);
    return;
  }

  if (right === undefined) {
    diff.removed += 1;
    addSamplePath(diff, path);
    return;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    collectArrayDiff(left, right, path, diff);
    return;
  }

  if (isRecord(left) && isRecord(right)) {
    collectObjectDiff(left, right, path, diff);
    return;
  }

  diff.changed += 1;
  addSamplePath(diff, path);
}

function collectArrayDiff(left: unknown[], right: unknown[], path: string, diff: DiffAccumulator) {
  const leftIdMap = buildStableIdMap(left);
  const rightIdMap = buildStableIdMap(right);

  if (leftIdMap && rightIdMap) {
    const ids = [...new Set([...leftIdMap.keys(), ...rightIdMap.keys()])].sort();

    for (const id of ids) {
      collectDiff(leftIdMap.get(id), rightIdMap.get(id), `${path}[${id}]`, diff);
    }

    return;
  }

  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    collectDiff(left[index], right[index], `${path}[${index}]`, diff);
  }
}

function collectObjectDiff(left: Record<string, unknown>, right: Record<string, unknown>, path: string, diff: DiffAccumulator) {
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();

  for (const key of keys) {
    collectDiff(left[key], right[key], `${path}.${key}`, diff);
  }
}

function buildStableIdMap(items: unknown[]): Map<string, unknown> | null {
  if (items.length === 0) {
    return null;
  }

  const entries = items.map((item) => {
    if (!isRecord(item)) {
      return null;
    }

    const idKey = stableIdKeys.find((key) => typeof item[key] === "string");

    return idKey ? [String(item[idKey]), item] as const : null;
  });

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  return new Map(entries as Array<readonly [string, unknown]>);
}

function addSamplePath(diff: DiffAccumulator, path: string) {
  if (diff.samplePaths.length < 4) {
    diff.samplePaths.push(path);
  }
}

function createEmptyDiff(): DiffAccumulator {
  return {
    added: 0,
    removed: 0,
    changed: 0,
    samplePaths: []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
