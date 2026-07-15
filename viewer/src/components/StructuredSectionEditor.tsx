import { useEffect, useMemo, useState } from "react";
import type { SectionKey } from "../types/prd";

type EditableRecord = Record<string, unknown>;
type EditableArray = EditableRecord[];
type Path = Array<string | number>;

type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "nullable-text"
  | "nullable-textarea"
  | "nullable-number"
  | "string-list"
  | "gwt-list";

type FieldConfig = {
  path: Path;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: string[];
};

type CollectionConfig = {
  path: string[];
  title: string;
  addLabel: string;
  idField: string;
  fields: FieldConfig[];
  createItem: () => EditableRecord;
};

type SectionEditorConfig = {
  heading: string;
  description: string;
  rootFields?: FieldConfig[];
  collections: CollectionConfig[];
};

type StructuredSectionEditorProps = {
  sectionKey: SectionKey;
  value: unknown;
  onApply: (nextValue: unknown, label: string) => void;
};

const priorityOptions = ["must", "should", "could", "wont"];
const releasePhaseOptions = ["mvp", "ga", "post_ga", "future"];
const requirementStatusOptions = ["proposed", "approved", "deferred", "removed"];
const questionStatusOptions = ["open", "deferred", "resolved"];
const decisionStatusOptions = ["proposed", "accepted", "superseded", "rejected"];
const readinessStatusOptions = ["not_started", "in_progress", "ready", "blocked"];
const projectTrackingStatusOptions = ["not_started", "in_progress", "at_risk", "blocked", "completed", "on_hold", "cancelled"];
const trackingWorkStatusOptions = ["not_started", "in_progress", "blocked", "done", "deferred"];
const trackingIssueStatusOptions = ["open", "investigating", "resolved", "deferred"];
const trackingBlockerStatusOptions = ["active", "mitigated", "cleared"];
const trackingSeverityOptions = ["low", "medium", "high", "critical"];

export function StructuredSectionEditor({ sectionKey, value, onApply }: StructuredSectionEditorProps) {
  const config = useMemo(() => getSectionEditorConfig(sectionKey), [sectionKey]);
  const [draft, setDraft] = useState<unknown>(() => structuredClone(value));

  useEffect(() => {
    setDraft(structuredClone(value));
  }, [sectionKey, value]);

  if (!config) {
    return (
      <div className="structured-editor-empty">
        <p className="panel-copy">Structured editing is available for requirements, stories, project tracking, risks, questions, decisions, and delivery readiness.</p>
      </div>
    );
  }

  function updateCollection(config: CollectionConfig, updater: (items: EditableArray) => EditableArray) {
    setDraft((current: unknown) => {
      const next = structuredClone(current) as EditableRecord | EditableArray;

      if (config.path.length === 0) {
        return updater(next as EditableArray);
      }

      const items = getAtPath(next, config.path) as EditableArray;

      setAtPath(next, config.path, updater(items));
      return next;
    });
  }

  function updateItem(config: CollectionConfig, index: number, updater: (item: EditableRecord) => EditableRecord) {
    updateCollection(config, (items) => items.map((item, itemIndex) => (itemIndex === index ? updater(item) : item)));
  }

  function addItem(config: CollectionConfig) {
    updateCollection(config, (items) => [...items, assignNextId(config, config.createItem(), items)]);
  }

  function duplicateItem(config: CollectionConfig, index: number) {
    updateCollection(config, (items) => {
      const duplicate = assignNextId(config, structuredClone(items[index]), items);

      return [...items.slice(0, index + 1), duplicate, ...items.slice(index + 1)];
    });
  }

  function removeItem(config: CollectionConfig, index: number) {
    updateCollection(config, (items) => items.filter((_item, itemIndex) => itemIndex !== index));
  }

  function moveItem(config: CollectionConfig, index: number, direction: -1 | 1) {
    updateCollection(config, (items) => {
      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= items.length) {
        return items;
      }

      const next = [...items];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  return (
    <section className="structured-editor" aria-label={`Structured ${config.heading.toLowerCase()} editor`}>
      <div>
        <span className="eyebrow">Structured section editor</span>
        <h4>{config.heading}</h4>
        <p className="panel-copy">{config.description}</p>
      </div>

      {config.rootFields && config.rootFields.length > 0 ? (
        <div className="structured-collection">
          <div className="structured-collection-heading">
            <div>
              <h5>{config.heading} overview</h5>
              <span>{config.rootFields.length} fields</span>
            </div>
          </div>
          <div className="structured-fields">
            {config.rootFields.map((field) => (
              <RootFieldEditor
                draft={draft}
                field={field}
                itemLabel={config.heading}
                key={field.path.join(".")}
                onChange={setDraft}
              />
            ))}
          </div>
        </div>
      ) : null}

      {config.collections.map((collection) => {
        const items = getAtPath(draft, collection.path) as EditableArray;

        return (
          <div className="structured-collection" key={collection.title}>
            <div className="structured-collection-heading">
              <div>
                <h5>{collection.title}</h5>
                <span>{items.length} items</span>
              </div>
              <button type="button" onClick={() => addItem(collection)}>
                {collection.addLabel}
              </button>
            </div>

            <div className="structured-items">
              {items.map((item, index) => {
                const itemId = String(item[collection.idField] ?? `${collection.title} ${index + 1}`);

                return (
                  <article className="structured-item" key={`${itemId}-${index}`}>
                    <div className="structured-item-heading">
                      <div>
                        <strong>{itemId}</strong>
                        <span>{collection.title.slice(0, -1) || collection.title}</span>
                      </div>
                      <div className="structured-item-actions">
                        <button type="button" onClick={() => moveItem(collection, index, -1)} disabled={index === 0}>
                          Up
                        </button>
                        <button type="button" onClick={() => moveItem(collection, index, 1)} disabled={index === items.length - 1}>
                          Down
                        </button>
                        <button type="button" onClick={() => duplicateItem(collection, index)}>
                          Duplicate
                        </button>
                        <button type="button" onClick={() => removeItem(collection, index)} disabled={items.length <= 1}>
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="structured-fields">
                      {collection.fields.map((field) => (
                        <FieldEditor
                          field={field}
                          item={item}
                          itemLabel={itemId}
                          key={field.path.join(".")}
                          onChange={(nextItem) => updateItem(collection, index, () => nextItem)}
                        />
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="editor-actions">
        <button type="button" onClick={() => onApply(draft, config.heading)}>
          Apply structured edits
        </button>
        <button type="button" onClick={() => setDraft(structuredClone(value))}>
          Reset structured edits
        </button>
      </div>
    </section>
  );
}

function RootFieldEditor({
  draft,
  field,
  itemLabel,
  onChange
}: {
  draft: unknown;
  field: FieldConfig;
  itemLabel: string;
  onChange: (nextValue: unknown) => void;
}) {
  const record = draft as EditableRecord;
  const value = getAtPath(record, field.path);
  const label = `${itemLabel} ${field.label}`;

  function updateValue(nextValue: unknown) {
    const nextRecord = structuredClone(record);
    setAtPath(nextRecord, field.path, nextValue);
    onChange(nextRecord);
  }

  return renderFieldControl({ field, itemLabel, label, value, updateValue, record, onChange });
}

function FieldEditor({
  field,
  item,
  itemLabel,
  onChange
}: {
  field: FieldConfig;
  item: EditableRecord;
  itemLabel: string;
  onChange: (nextItem: EditableRecord) => void;
}) {
  const value = getAtPath(item, field.path);
  const label = `${itemLabel} ${field.label}`;

  function updateValue(nextValue: unknown) {
    const nextItem = structuredClone(item);
    setAtPath(nextItem, field.path, nextValue);
    onChange(nextItem);
  }

  return renderFieldControl({ field, itemLabel, label, value, updateValue, record: item, onChange });
}

function renderFieldControl({
  field,
  itemLabel,
  label,
  value,
  updateValue,
  record,
  onChange
}: {
  field: FieldConfig;
  itemLabel: string;
  label: string;
  value: unknown;
  updateValue: (nextValue: unknown) => void;
  record: EditableRecord;
  onChange: (nextItem: EditableRecord) => void;
}) {

  if (field.kind === "select") {
    return (
      <label className="structured-field">
        <span>{field.label}{field.required ? " *" : ""}</span>
        <select aria-label={label} value={String(value ?? "")} onChange={(event) => updateValue(event.target.value)}>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {formatOption(option)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.kind === "number") {
    return (
      <label className="structured-field">
        <span>{field.label}{field.required ? " *" : ""}</span>
        <input aria-label={label} type="number" min={1} max={9} value={String(value ?? "")} onChange={(event) => updateValue(Number(event.target.value))} />
      </label>
    );
  }

  if (field.kind === "nullable-text" || field.kind === "nullable-textarea" || field.kind === "nullable-number") {
    const isNull = value === null;
    const inputValue = isNull ? "" : String(value ?? "");

    return (
      <div className="structured-field structured-field--nullable">
        <label>
          <span>{field.label}{field.required ? " *" : ""}</span>
          {field.kind === "nullable-textarea" ? (
            <textarea aria-label={label} value={inputValue} disabled={isNull} onChange={(event) => updateValue(event.target.value)} />
          ) : field.kind === "nullable-number" ? (
            <input aria-label={label} type="number" min={1} value={inputValue} disabled={isNull} onChange={(event) => updateValue(event.target.value === "" ? null : Number(event.target.value))} />
          ) : (
            <input aria-label={label} value={inputValue} disabled={isNull} onChange={(event) => updateValue(event.target.value)} />
          )}
        </label>
        <label className="structured-null-toggle">
          <input type="checkbox" checked={isNull} onChange={(event) => updateValue(event.target.checked ? null : "")} />
          <span>Null</span>
        </label>
      </div>
    );
  }

  if (field.kind === "string-list") {
    return <StringListEditor field={field} item={record} itemLabel={itemLabel} onChange={onChange} />;
  }

  if (field.kind === "gwt-list") {
    return <GwtListEditor field={field} item={record} itemLabel={itemLabel} onChange={onChange} />;
  }

  return (
    <label className="structured-field">
      <span>{field.label}{field.required ? " *" : ""}</span>
      {field.kind === "textarea" ? (
        <textarea aria-label={label} value={String(value ?? "")} onChange={(event) => updateValue(event.target.value)} />
      ) : (
        <input aria-label={label} value={String(value ?? "")} onChange={(event) => updateValue(event.target.value)} />
      )}
    </label>
  );
}

function StringListEditor({
  field,
  item,
  itemLabel,
  onChange
}: {
  field: FieldConfig;
  item: EditableRecord;
  itemLabel: string;
  onChange: (nextItem: EditableRecord) => void;
}) {
  const values = (getAtPath(item, field.path) as string[] | undefined) ?? [];

  function updateValues(nextValues: string[]) {
    const nextItem = structuredClone(item);
    setAtPath(nextItem, field.path, nextValues);
    onChange(nextItem);
  }

  return (
    <div className="structured-field structured-list-field">
      <span>{field.label}{field.required ? " *" : ""}</span>
      {values.map((value, index) => (
        <div className="structured-list-row" key={index}>
          <input
            aria-label={`${itemLabel} ${field.label} ${index + 1}`}
            value={value}
            onChange={(event) => updateValues(values.map((itemValue, itemIndex) => (itemIndex === index ? event.target.value : itemValue)))}
          />
          <button type="button" onClick={() => updateValues(moveArrayItem(values, index, -1))} disabled={index === 0}>
            Up
          </button>
          <button type="button" onClick={() => updateValues(moveArrayItem(values, index, 1))} disabled={index === values.length - 1}>
            Down
          </button>
          <button type="button" onClick={() => updateValues(values.filter((_itemValue, itemIndex) => itemIndex !== index))}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => updateValues([...values, ""])}>
        Add {field.label.toLowerCase()}
      </button>
    </div>
  );
}

function GwtListEditor({
  field,
  item,
  itemLabel,
  onChange
}: {
  field: FieldConfig;
  item: EditableRecord;
  itemLabel: string;
  onChange: (nextItem: EditableRecord) => void;
}) {
  const values = (getAtPath(item, field.path) as EditableArray | undefined) ?? [];

  function updateValues(nextValues: EditableArray) {
    const nextItem = structuredClone(item);
    setAtPath(nextItem, field.path, nextValues);
    onChange(nextItem);
  }

  return (
    <div className="structured-field structured-list-field structured-list-field--wide">
      <span>{field.label}{field.required ? " *" : ""}</span>
      {values.map((value, index) => (
        <fieldset className="gwt-editor" key={index}>
          <legend>{field.label} {index + 1}</legend>
          {(["given", "when", "then"] as const).map((key) => (
            <label key={key}>
              <span>{formatOption(key)} *</span>
              <textarea
                aria-label={`${itemLabel} ${field.label} ${index + 1} ${key}`}
                value={String(value[key] ?? "")}
                onChange={(event) =>
                  updateValues(values.map((itemValue, itemIndex) => (itemIndex === index ? { ...itemValue, [key]: event.target.value } : itemValue)))
                }
              />
            </label>
          ))}
          <div className="structured-item-actions">
            <button type="button" onClick={() => updateValues(moveArrayItem(values, index, -1))} disabled={index === 0}>
              Up
            </button>
            <button type="button" onClick={() => updateValues(moveArrayItem(values, index, 1))} disabled={index === values.length - 1}>
              Down
            </button>
            <button type="button" onClick={() => updateValues(values.filter((_itemValue, itemIndex) => itemIndex !== index))} disabled={values.length <= 1}>
              Remove
            </button>
          </div>
        </fieldset>
      ))}
      <button type="button" onClick={() => updateValues([...values, { given: "", when: "", then: "" }])}>
        Add {field.label.toLowerCase()}
      </button>
    </div>
  );
}

function getSectionEditorConfig(sectionKey: SectionKey): SectionEditorConfig | null {
  switch (sectionKey) {
    case "requirements":
      return {
        heading: "Requirements",
        description: "Edit functional and non-functional requirement arrays with schema-backed required fields, enums, and acceptance criteria.",
        collections: [functionalRequirementsConfig, nonFunctionalRequirementsConfig]
      };
    case "user_stories":
      return {
        heading: "User stories",
        description: "Edit stories, nested Given-When-Then criteria, linked requirements, and edge cases.",
        collections: [userStoriesConfig]
      };
    case "risks":
      return {
        heading: "Risks",
        description: "Edit risk details, enum fields, score, owners, and triggers.",
        collections: [risksConfig]
      };
    case "open_questions":
      return {
        heading: "Open questions",
        description: "Edit question status, nullable resolution, ownership, and timestamps.",
        collections: [openQuestionsConfig]
      };
    case "decisions":
      return {
        heading: "Decisions",
        description: "Edit decisions, nullable rationale and decided-at values, statuses, and linked requirements.",
        collections: [decisionsConfig]
      };
    case "delivery":
      return {
        heading: "Delivery readiness",
        description: "Edit delivery.operational_readiness without changing the rest of the delivery plan.",
        collections: [operationalReadinessConfig]
      };
    case "project_tracking":
      return {
        heading: "Project tracking",
        description: "Edit top-level tracking status plus pending work, issues, blockers, and notes with schema-backed fields and stable IDs.",
        rootFields: [
          selectField("status", "Status", projectTrackingStatusOptions, true),
          nullableTextField("owner", "Owner", true),
          nullableTextareaField("summary", "Summary", true),
          nullableTextField("updated_at", "Updated at", true),
          stringListField("linked_prd_ids", "Linked PRD IDs", true)
        ],
        collections: [pendingWorkConfig, issuesFoundConfig, blockersConfig, trackingNotesConfig]
      };
    default:
      return null;
  }
}

const functionalRequirementsConfig: CollectionConfig = {
  path: ["functional"],
  title: "Functional requirements",
  addLabel: "Add functional requirement",
  idField: "req_id",
  createItem: () => ({
    req_id: "FR-000",
    title: "New functional requirement",
    description: "Describe the required behavior.",
    rationale: null,
    priority: "should",
    persona_ids: [],
    dependencies: [],
    acceptance_criteria: ["Define acceptance criteria."],
    status: "proposed",
    release_phase: "mvp"
  }),
  fields: [
    textField("req_id", "Requirement ID", true),
    textField("title", "Title", true),
    textareaField("description", "Description", true),
    nullableTextareaField("rationale", "Rationale", true),
    selectField("priority", "Priority", priorityOptions, true),
    stringListField("persona_ids", "Persona IDs"),
    stringListField("dependencies", "Dependencies"),
    stringListField("acceptance_criteria", "Acceptance criteria", true),
    selectField("status", "Status", requirementStatusOptions, true),
    selectField("release_phase", "Release phase", releasePhaseOptions, true)
  ]
};

const nonFunctionalRequirementsConfig: CollectionConfig = {
  path: ["non_functional"],
  title: "Non-functional requirements",
  addLabel: "Add non-functional requirement",
  idField: "req_id",
  createItem: () => ({
    req_id: "NFR-000",
    category: "usability",
    description: "Describe the non-functional requirement.",
    target: "Define the target.",
    priority: "should",
    acceptance_criteria: ["Define acceptance criteria."]
  }),
  fields: [
    textField("req_id", "Requirement ID", true),
    selectField("category", "Category", ["performance", "security", "scalability", "accessibility", "reliability", "compliance", "usability", "observability", "privacy"], true),
    textareaField("description", "Description", true),
    textField("target", "Target", true),
    selectField("priority", "Priority", priorityOptions, true),
    stringListField("acceptance_criteria", "Acceptance criteria", true)
  ]
};

const userStoriesConfig: CollectionConfig = {
  path: [],
  title: "User stories",
  addLabel: "Add user story",
  idField: "story_id",
  createItem: () => ({
    story_id: "US-000",
    epic: "New epic",
    persona_id: "P-001",
    priority: "should",
    release_phase: "mvp",
    statement: {
      as_a: "reviewer",
      i_want: "to describe the user need",
      so_that: "the outcome is clear"
    },
    acceptance_criteria: [{ given: "a valid context", when: "the action happens", then: "the expected outcome is visible" }],
    linked_req_ids: [],
    story_points: null,
    edge_cases: []
  }),
  fields: [
    textField("story_id", "Story ID", true),
    textField("epic", "Epic", true),
    textField("persona_id", "Persona ID", true),
    selectField("priority", "Priority", ["must", "should", "could"], true),
    selectField("release_phase", "Release phase", releasePhaseOptions, true),
    textField(["statement", "as_a"], "As a", true),
    textareaField(["statement", "i_want"], "I want", true),
    textareaField(["statement", "so_that"], "So that", true),
    gwtListField("acceptance_criteria", "Acceptance criteria", true),
    stringListField("linked_req_ids", "Linked requirement IDs", true),
    nullableNumberField("story_points", "Story points"),
    stringListField("edge_cases", "Edge cases")
  ]
};

const risksConfig: CollectionConfig = {
  path: [],
  title: "Risks",
  addLabel: "Add risk",
  idField: "risk_id",
  createItem: () => ({
    risk_id: "R-000",
    description: "Describe the risk.",
    category: "operational",
    probability: "medium",
    impact: "medium",
    score: 4,
    mitigation: "Define the mitigation.",
    owner: null,
    trigger: null
  }),
  fields: [
    textField("risk_id", "Risk ID", true),
    textareaField("description", "Description", true),
    selectField("category", "Category", ["technical", "market", "legal", "resource", "schedule", "operational"], true),
    selectField("probability", "Probability", ["low", "medium", "high"], true),
    selectField("impact", "Impact", ["low", "medium", "high"], true),
    numberField("score", "Score", true),
    textareaField("mitigation", "Mitigation", true),
    nullableTextField("owner", "Owner", true),
    nullableTextareaField("trigger", "Trigger", true)
  ]
};

const openQuestionsConfig: CollectionConfig = {
  path: [],
  title: "Open questions",
  addLabel: "Add open question",
  idField: "question_id",
  createItem: () => ({
    question_id: "Q-000",
    question: "Write the open question.",
    raised_by: "Reviewer",
    raised_at: new Date().toISOString(),
    status: "open",
    resolution: null
  }),
  fields: [
    textField("question_id", "Question ID", true),
    textareaField("question", "Question", true),
    textField("raised_by", "Raised by", true),
    textField("raised_at", "Raised at", true),
    selectField("status", "Status", questionStatusOptions, true),
    nullableTextareaField("resolution", "Resolution", true)
  ]
};

const decisionsConfig: CollectionConfig = {
  path: [],
  title: "Decisions",
  addLabel: "Add decision",
  idField: "decision_id",
  createItem: () => ({
    decision_id: "DEC-000",
    title: "New decision",
    statement: "State the decision.",
    rationale: null,
    owner: null,
    decided_at: null,
    status: "proposed",
    linked_req_ids: []
  }),
  fields: [
    textField("decision_id", "Decision ID", true),
    textField("title", "Title", true),
    textareaField("statement", "Statement", true),
    nullableTextareaField("rationale", "Rationale", true),
    nullableTextField("owner", "Owner", true),
    nullableTextField("decided_at", "Decided at", true),
    selectField("status", "Status", decisionStatusOptions, true),
    stringListField("linked_req_ids", "Linked requirement IDs")
  ]
};

const operationalReadinessConfig: CollectionConfig = {
  path: ["operational_readiness"],
  title: "Operational readiness",
  addLabel: "Add readiness item",
  idField: "area",
  createItem: () => ({
    area: "New readiness item",
    owner: "Engineering",
    status: "not_started",
    notes: null
  }),
  fields: [
    textField("area", "Area", true),
    nullableTextField("owner", "Owner", true),
    selectField("status", "Status", readinessStatusOptions, true),
    nullableTextareaField("notes", "Notes", true)
  ]
};

const pendingWorkConfig: CollectionConfig = {
  path: ["pending_work"],
  title: "Pending work",
  addLabel: "Add work item",
  idField: "work_item_id",
  createItem: () => ({
    work_item_id: "PTW-000",
    title: "New work item",
    description: "Describe the work item.",
    status: "not_started",
    priority: "medium",
    owner: null,
    linked_prd_ids: [],
    linked_entity_ids: [],
    external_refs: [],
    notes: null
  }),
  fields: [
    textField("work_item_id", "Work item ID", true),
    textField("title", "Title", true),
    textareaField("description", "Description", true),
    selectField("status", "Status", trackingWorkStatusOptions, true),
    selectField("priority", "Priority", trackingSeverityOptions, true),
    nullableTextField("owner", "Owner", true),
    stringListField("linked_prd_ids", "Linked PRD IDs", true),
    stringListField("linked_entity_ids", "Linked entity IDs", true),
    stringListField("external_refs", "External refs"),
    nullableTextareaField("notes", "Notes", true)
  ]
};

const issuesFoundConfig: CollectionConfig = {
  path: ["issues_found"],
  title: "Issues found",
  addLabel: "Add issue",
  idField: "issue_id",
  createItem: () => ({
    issue_id: "PTI-000",
    title: "New issue",
    description: "Describe the issue.",
    status: "open",
    severity: "medium",
    owner: null,
    linked_prd_ids: [],
    linked_entity_ids: [],
    external_refs: [],
    notes: null
  }),
  fields: [
    textField("issue_id", "Issue ID", true),
    textField("title", "Title", true),
    textareaField("description", "Description", true),
    selectField("status", "Status", trackingIssueStatusOptions, true),
    selectField("severity", "Severity", trackingSeverityOptions, true),
    nullableTextField("owner", "Owner", true),
    stringListField("linked_prd_ids", "Linked PRD IDs", true),
    stringListField("linked_entity_ids", "Linked entity IDs", true),
    stringListField("external_refs", "External refs"),
    nullableTextareaField("notes", "Notes", true)
  ]
};

const blockersConfig: CollectionConfig = {
  path: ["blockers"],
  title: "Blockers",
  addLabel: "Add blocker",
  idField: "blocker_id",
  createItem: () => ({
    blocker_id: "PTB-000",
    title: "New blocker",
    description: "Describe the blocker.",
    status: "active",
    severity: "high",
    owner: null,
    linked_prd_ids: [],
    linked_entity_ids: [],
    external_refs: [],
    unblock_criteria: "Describe the unblock criteria.",
    notes: null
  }),
  fields: [
    textField("blocker_id", "Blocker ID", true),
    textField("title", "Title", true),
    textareaField("description", "Description", true),
    selectField("status", "Status", trackingBlockerStatusOptions, true),
    selectField("severity", "Severity", trackingSeverityOptions, true),
    nullableTextField("owner", "Owner", true),
    stringListField("linked_prd_ids", "Linked PRD IDs", true),
    stringListField("linked_entity_ids", "Linked entity IDs", true),
    stringListField("external_refs", "External refs"),
    textareaField("unblock_criteria", "Unblock criteria", true),
    nullableTextareaField("notes", "Notes", true)
  ]
};

const trackingNotesConfig: CollectionConfig = {
  path: ["notes"],
  title: "Tracking notes",
  addLabel: "Add tracking note",
  idField: "note_id",
  createItem: () => ({
    note_id: "PTN-000",
    note: "New project-tracking note.",
    owner: null,
    noted_at: new Date().toISOString(),
    linked_prd_ids: [],
    linked_entity_ids: [],
    external_refs: []
  }),
  fields: [
    textField("note_id", "Note ID", true),
    textareaField("note", "Note", true),
    nullableTextField("owner", "Owner", true),
    textField("noted_at", "Noted at", true),
    stringListField("linked_prd_ids", "Linked PRD IDs", true),
    stringListField("linked_entity_ids", "Linked entity IDs", true),
    stringListField("external_refs", "External refs")
  ]
};

function textField(path: string | Path, label: string, required = false): FieldConfig {
  return { path: normalizePath(path), label, kind: "text", required };
}

function textareaField(path: string | Path, label: string, required = false): FieldConfig {
  return { path: normalizePath(path), label, kind: "textarea", required };
}

function nullableTextField(path: string | Path, label: string, required = false): FieldConfig {
  return { path: normalizePath(path), label, kind: "nullable-text", required };
}

function nullableTextareaField(path: string | Path, label: string, required = false): FieldConfig {
  return { path: normalizePath(path), label, kind: "nullable-textarea", required };
}

function numberField(path: string | Path, label: string, required = false): FieldConfig {
  return { path: normalizePath(path), label, kind: "number", required };
}

function nullableNumberField(path: string | Path, label: string): FieldConfig {
  return { path: normalizePath(path), label, kind: "nullable-number" };
}

function selectField(path: string | Path, label: string, options: string[], required = false): FieldConfig {
  return { path: normalizePath(path), label, kind: "select", options, required };
}

function stringListField(path: string | Path, label: string, required = false): FieldConfig {
  return { path: normalizePath(path), label, kind: "string-list", required };
}

function gwtListField(path: string | Path, label: string, required = false): FieldConfig {
  return { path: normalizePath(path), label, kind: "gwt-list", required };
}

function normalizePath(path: string | Path): Path {
  return Array.isArray(path) ? path : [path];
}

function getAtPath(value: unknown, path: Path): unknown {
  return path.reduce((current, segment) => (current as Record<string, unknown> | unknown[])[segment as never], value);
}

function setAtPath(value: unknown, path: Path, nextValue: unknown) {
  if (path.length === 0) {
    return;
  }

  const parent = getAtPath(value, path.slice(0, -1)) as Record<string, unknown> | unknown[];
  parent[path[path.length - 1] as never] = nextValue as never;
}

function assignNextId(config: CollectionConfig, item: EditableRecord, existingItems: EditableArray): EditableRecord {
  const currentId = String(item[config.idField] ?? "");
  const match = currentId.match(/^([A-Z]+)-[0-9]{3}$/);

  if (!match) {
    return item;
  }

  const prefix = match[1];
  const nextNumber =
    Math.max(
      0,
      ...existingItems
        .map((existingItem) => String(existingItem[config.idField] ?? ""))
        .map((id) => id.match(new RegExp(`^${prefix}-([0-9]{3})$`))?.[1])
        .filter((id): id is string => Boolean(id))
        .map((id) => Number(id))
    ) + 1;

  return {
    ...item,
    [config.idField]: `${prefix}-${String(nextNumber).padStart(3, "0")}`
  };
}

function moveArrayItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function formatOption(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
