import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import seedPrd from "../PRD_web_ui.json";
import { MetricTile } from "./components/MetricTile";
import { SectionRail } from "./components/SectionRail";
import { StatusPill } from "./components/StatusPill";
import { StructuredSectionEditor } from "./components/StructuredSectionEditor";
import { TraceabilityGraphPanel } from "./components/TraceabilityGraphPanel";
import { buildApprovalReadiness, type ApprovalReadinessSignal } from "./lib/approvalReadiness";
import { buildChangePreview } from "./lib/changePreview";
import {
  buildDiagnosticSnapshot,
  createDiagnosticEvent,
  type DiagnosticAction,
  type DiagnosticEvent,
  type DiagnosticOutcome
} from "./lib/diagnostics";
import { initialFileSession } from "./lib/fileSession";
import { buildPrdSummary } from "./lib/prdSummary";
import {
  checkSchemaCompatibility,
  formatCompatibilityStatus
} from "./lib/schemaCompatibility";
import { buildSectionItems } from "./lib/sectionItems";
import {
  createValidationFailureResult,
  validatePrdDocument,
  type ValidationResult
} from "./lib/schemaValidation";
import { buildReviewSnapshot, buildReviewSnapshotFilename } from "./lib/reviewSnapshot";
import {
  buildProjectStatusReportFilename,
  buildProjectStatusReportHtml
} from "./lib/projectStatusReport";
import { buildAgentTraceBundle, buildFocusedTraceGraph, buildTraceability } from "./lib/traceability";
import type { PrdDocument, SectionKey } from "./types/prd";

const seedDocument = seedPrd as PrdDocument;
const jsonFilePickerOptions = {
  types: [
    {
      description: "PRD JSON files",
      accept: {
        "application/json": [".json"]
      }
    }
  ],
  excludeAcceptAllOption: false,
  multiple: false
};

type EditorMessage = {
  tone: "neutral" | "success" | "warning" | "danger";
  text: string;
};

type DashboardTarget = {
  section?: SectionKey;
  panelId: string;
};

type WorkspaceView = "review" | "editor";

type WritableFileHandle = {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableFileStream>;
};

type WritableFileStream = {
  write(data: string): Promise<void> | void;
  close(): Promise<void> | void;
  abort?(): Promise<void> | void;
};

type FilePickerWindow = Window & {
  showOpenFilePicker?: (options: typeof jsonFilePickerOptions) => Promise<WritableFileHandle[]>;
};

export default function App() {
  const [prd, setPrd] = useState<PrdDocument>(seedDocument);
  const [persistedPrd, setPersistedPrd] = useState<PrdDocument>(seedDocument);
  const [documentRevision, setDocumentRevision] = useState(0);
  const [fileSession, setFileSession] = useState(initialFileSession);
  const [writableFileHandle, setWritableFileHandle] = useState<WritableFileHandle | null>(null);
  const [sectionDraft, setSectionDraft] = useState(() => formatJson(seedDocument.requirements));
  const [editorMessage, setEditorMessage] = useState<EditorMessage>({
    tone: "neutral",
    text: "Edit the selected section as JSON, then apply it locally."
  });
  const [saveMessage, setSaveMessage] = useState<EditorMessage>({
    tone: "neutral",
    text: "Open with writable access to save changes back to the canonical file."
  });
  const [diagnosticEvents, setDiagnosticEvents] = useState<DiagnosticEvent[]>([]);
  const summary = useMemo(() => buildPrdSummary(prd, fileSession.sourceLabel), [prd, fileSession.sourceLabel]);
  const compatibility = useMemo(() => checkSchemaCompatibility(prd), [prd]);
  const [validation, setValidation] = useState(() => validatePrdDocument(seedDocument));
  const [activeSection, setActiveSection] = useState<SectionKey>("requirements");
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("review");
  const [activeTraceNodeId, setActiveTraceNodeId] = useState("FR-005");
  const selectedSection = summary.sections.find((section) => section.key === activeSection);
  const sectionItems = useMemo(() => buildSectionItems(prd, activeSection), [activeSection, prd]);
  const visibleSectionItems = activeSection === "requirements" ? sectionItems : sectionItems.slice(0, 8);
  const traceability = useMemo(() => buildTraceability(prd), [prd]);
  const selectedTraceNodeId = traceability.nodes.some((node) => node.id === activeTraceNodeId)
    ? activeTraceNodeId
    : traceability.matrixRows[0]?.requirementId ?? traceability.nodes[0]?.id ?? "";
  const focusedTraceGraph = useMemo(
    () => buildFocusedTraceGraph(traceability, selectedTraceNodeId),
    [selectedTraceNodeId, traceability]
  );
  const changePreview = useMemo(() => buildChangePreview(persistedPrd, prd), [persistedPrd, prd]);
  const supportsWritableOpen = typeof (window as FilePickerWindow).showOpenFilePicker === "function";
  const validationTone = validation.status === "valid" ? "success" : validation.status === "invalid" ? "danger" : "neutral";
  const compatibilityTone = compatibility.migrationRequired || compatibility.requiredExtensions.length > 0
    ? "danger"
    : compatibility.status === "exact" || compatibility.status === "fully_compatible"
      ? "success"
      : "warning";
  const readiness = useMemo(
    () => buildApprovalReadiness({ prd, validation, traceability, compatibility }),
    [compatibility, prd, traceability, validation]
  );
  useEffect(() => {
    setSectionDraft(formatJson(prd[activeSection]));
    setEditorMessage({
      tone: "neutral",
      text: "Edit the selected section as JSON, then apply it locally."
    });
  }, [activeSection, documentRevision]);

  function appendDiagnosticEvent(
    action: DiagnosticAction,
    outcome: DiagnosticOutcome,
    details: Record<string, unknown> = {},
    options: { section?: SectionKey | null; documentRevision?: number } = {}
  ) {
    const event = createDiagnosticEvent({
      action,
      outcome,
      documentRevision: options.documentRevision ?? documentRevision,
      section: options.section === undefined ? activeSection : options.section,
      details
    });

    setDiagnosticEvents((current) => [event, ...current].slice(0, 80));
  }

  async function handleFileOpen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const text = await readFileAsText(file);
      const parsedDocument = JSON.parse(text) as unknown;
      const nextValidation = validatePrdDocument(parsedDocument);
      const loadDetails = {
        mode: "read_only",
        file_size_bytes: file.size,
        file_extension: fileExtension(file.name),
        ...validationDiagnosticDetails(nextValidation)
      };

      setValidation(nextValidation);
      setFileSession({
        sourceLabel: file.name,
        canWriteBack: false,
        hasUnsavedChanges: false
      });
      setWritableFileHandle(null);

      if (nextValidation.status === "valid") {
        const loadedPrd = parsedDocument as PrdDocument;
        const nextRevision = documentRevision + 1;

        setPrd(loadedPrd);
        setPersistedPrd(loadedPrd);
        setDocumentRevision(nextRevision);
        setSaveMessage({
          tone: "neutral",
          text: "This file was opened read-only. Export PRD to download a validated copy."
        });
        appendDiagnosticEvent("load", "success", loadDetails, { section: null, documentRevision: nextRevision });
      } else {
        appendDiagnosticEvent("load", "failure", loadDetails, { section: null });
      }
    } catch (error) {
      appendDiagnosticEvent(
        "load",
        "failure",
        {
          mode: "read_only",
          file_size_bytes: file.size,
          file_extension: fileExtension(file.name),
          reason: "parse_failed",
          error_type: error instanceof Error ? error.name : "UnknownError"
        },
        { section: null }
      );
      setFileSession({
        sourceLabel: file.name,
        canWriteBack: false,
        hasUnsavedChanges: false
      });
      setWritableFileHandle(null);
      setValidation(
        createValidationFailureResult(
          error instanceof Error ? `Unable to parse JSON: ${error.message}` : "Unable to parse JSON."
        )
      );
    }
  }

  async function handleWritableFileOpen() {
    const openPicker = (window as FilePickerWindow).showOpenFilePicker;

    if (!openPicker) {
      setSaveMessage({
        tone: "warning",
        text: "Writable open is not supported by this browser."
      });
      appendDiagnosticEvent("load", "blocked", { mode: "writable", reason: "unsupported_browser" }, { section: null });
      return;
    }

    try {
      const [handle] = await openPicker(jsonFilePickerOptions);

      if (!handle) {
        return;
      }

      const file = await handle.getFile();
      const text = await readFileAsText(file);
      const parsedDocument = JSON.parse(text) as unknown;
      const nextValidation = validatePrdDocument(parsedDocument);
      const loadDetails = {
        mode: "writable",
        file_size_bytes: file.size,
        file_extension: fileExtension(handle.name),
        ...validationDiagnosticDetails(nextValidation)
      };

      setValidation(nextValidation);
      setFileSession({
        sourceLabel: handle.name,
        canWriteBack: nextValidation.status === "valid",
        hasUnsavedChanges: false
      });

      if (nextValidation.status === "valid") {
        const loadedPrd = parsedDocument as PrdDocument;
        const nextRevision = documentRevision + 1;

        setPrd(loadedPrd);
        setPersistedPrd(loadedPrd);
        setDocumentRevision(nextRevision);
        setWritableFileHandle(handle);
        setSaveMessage({
          tone: "success",
          text: "Writable file handle ready. Valid changes can be saved back to this PRD."
        });
        appendDiagnosticEvent("load", "success", loadDetails, { section: null, documentRevision: nextRevision });
      } else {
        setWritableFileHandle(null);
        setSaveMessage({
          tone: "danger",
          text: "Writable file was invalid, so writeback is disabled."
        });
        appendDiagnosticEvent("load", "failure", loadDetails, { section: null });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setWritableFileHandle(null);
      setFileSession((current) => ({
        ...current,
        canWriteBack: false
      }));
      setSaveMessage({
        tone: "danger",
        text: error instanceof Error ? error.message : "Unable to open writable PRD."
      });
      appendDiagnosticEvent(
        "load",
        "failure",
        {
          mode: "writable",
          reason: "open_failed",
          error_type: error instanceof Error ? error.name : "UnknownError"
        },
        { section: null }
      );
    }
  }

  function handleApplySectionEdit() {
    let parsedSection: unknown;

    try {
      parsedSection = JSON.parse(sectionDraft) as unknown;
    } catch (error) {
      setEditorMessage({
        tone: "danger",
        text: error instanceof Error ? `Section JSON is invalid: ${error.message}` : "Section JSON is invalid."
      });
      appendDiagnosticEvent("edit", "failure", {
        mode: "raw_json",
        reason: "parse_failed",
        error_type: error instanceof Error ? error.name : "UnknownError"
      });
      return;
    }

    const nextPrd = {
      ...prd,
      [activeSection]: parsedSection
    } as PrdDocument;
    const nextValidation = validatePrdDocument(nextPrd);

    setValidation(nextValidation);

    if (nextValidation.status !== "valid") {
      setEditorMessage({
        tone: "danger",
        text: "Section change would make PRD invalid. No changes applied."
      });
      appendDiagnosticEvent("edit", "blocked", {
        mode: "raw_json",
        ...validationDiagnosticDetails(nextValidation)
      });
      return;
    }

    setPrd(nextPrd);
    setFileSession((current) => ({
      ...current,
      hasUnsavedChanges: !documentsEqual(persistedPrd, nextPrd)
    }));
    setEditorMessage({
      tone: "success",
      text: `${selectedSection?.label ?? activeSection} changes applied locally.`
    });
    setSaveMessage({
      tone: "warning",
      text: writableFileHandle
        ? "Unsaved changes are pending writeback."
        : "Unsaved changes are local only until exported."
    });
    appendDiagnosticEvent("edit", "success", {
      mode: "raw_json",
      changed_sections: changePreview.length + 1,
      ...validationDiagnosticDetails(nextValidation)
    });
  }

  function handleApplyStructuredEdit(nextSectionValue: unknown, label: string) {
    const nextPrd = {
      ...prd,
      [activeSection]: nextSectionValue
    } as PrdDocument;
    const nextValidation = validatePrdDocument(nextPrd);

    setValidation(nextValidation);

    if (nextValidation.status !== "valid") {
      setEditorMessage({
        tone: "danger",
        text: "Structured section change would make PRD invalid. No changes applied."
      });
      appendDiagnosticEvent("edit", "blocked", {
        mode: "structured",
        ...validationDiagnosticDetails(nextValidation)
      });
      return;
    }

    setPrd(nextPrd);
    setSectionDraft(formatJson(nextPrd[activeSection]));
    setFileSession((current) => ({
      ...current,
      hasUnsavedChanges: !documentsEqual(persistedPrd, nextPrd)
    }));
    setEditorMessage({
      tone: "success",
      text: `${label} structured changes applied locally.`
    });
    setSaveMessage({
      tone: "warning",
      text: writableFileHandle
        ? "Unsaved changes are pending writeback."
        : "Unsaved changes are local only until exported."
    });
    appendDiagnosticEvent("edit", "success", {
      mode: "structured",
      ...validationDiagnosticDetails(nextValidation)
    });
  }

  function handleResetSectionEdit() {
    setSectionDraft(formatJson(prd[activeSection]));
    setEditorMessage({
      tone: "neutral",
      text: "Section editor reset to the active PRD state."
    });
  }

  function handleValidate() {
    const nextValidation = validatePrdDocument(prd);

    setValidation(nextValidation);
    appendDiagnosticEvent(
      "validate",
      nextValidation.status === "valid" ? "success" : "failure",
      validationDiagnosticDetails(nextValidation),
      { section: null }
    );
  }

  function handlePrdExport() {
    const nextValidation = validatePrdDocument(prd);

    setValidation(nextValidation);

    if (nextValidation.status !== "valid") {
      setSaveMessage({
        tone: "danger",
        text: "Export blocked because the active PRD is invalid."
      });
      appendDiagnosticEvent("export", "blocked", {
        kind: "prd",
        ...validationDiagnosticDetails(nextValidation)
      }, { section: null });
      return;
    }

    downloadJson(buildPrdFilename(prd), prd);
    appendDiagnosticEvent("export", "success", {
      kind: "prd",
      ...validationDiagnosticDetails(nextValidation)
    }, { section: null });
  }

  async function handleSaveWriteback() {
    const nextValidation = validatePrdDocument(prd);

    setValidation(nextValidation);

    if (nextValidation.status !== "valid") {
      setSaveMessage({
        tone: "danger",
        text: "Save blocked because the active PRD is invalid."
      });
      appendDiagnosticEvent("save", "blocked", {
        reason: "invalid_prd",
        ...validationDiagnosticDetails(nextValidation)
      }, { section: null });
      return;
    }

    if (compatibility.migrationRequired || compatibility.requiredExtensions.length > 0) {
      setSaveMessage({
        tone: "danger",
        text: "Save blocked until schema compatibility warnings are resolved."
      });
      appendDiagnosticEvent("save", "blocked", {
        reason: "schema_compatibility",
        required_extension_count: compatibility.requiredExtensions.length,
        migration_required: compatibility.migrationRequired
      }, { section: null });
      return;
    }

    if (!writableFileHandle) {
      setSaveMessage({
        tone: "warning",
        text: "Save needs a writable file handle. Use Export PRD for read-only browser sessions."
      });
      appendDiagnosticEvent("save", "blocked", { reason: "missing_writable_handle" }, { section: null });
      return;
    }

    let writableStream: WritableFileStream | null = null;

    try {
      writableStream = await writableFileHandle.createWritable();
      await writableStream.write(serializePrd(prd));
      await writableStream.close();
      setPersistedPrd(prd);
      setFileSession((current) => ({
        ...current,
        hasUnsavedChanges: false
      }));
      setSaveMessage({
        tone: "success",
        text: "Validated PRD saved back to the writable file."
      });
      appendDiagnosticEvent("save", "success", {
        mode: "writable",
        ...validationDiagnosticDetails(nextValidation)
      }, { section: null });
    } catch (error) {
      if (writableStream?.abort) {
        await writableStream.abort();
      }

      setSaveMessage({
        tone: "danger",
        text: error instanceof Error ? `Save failed: ${error.message}` : "Save failed."
      });
      appendDiagnosticEvent("save", "failure", {
        mode: "writable",
        reason: "write_failed",
        error_type: error instanceof Error ? error.name : "UnknownError"
      }, { section: null });
    }
  }

  function handleTraceExport() {
    const bundle = buildAgentTraceBundle(traceability, selectedTraceNodeId, new Date().toISOString());

    downloadJson(`trace-summary-${selectedTraceNodeId || "prd"}.json`, bundle);
    appendDiagnosticEvent("export", "success", {
      kind: "trace",
      selected_node_kind: traceability.nodes.find((node) => node.id === selectedTraceNodeId)?.kind ?? "missing",
      node_count: bundle.counts.nodes,
      edge_count: bundle.counts.edges,
      issue_count: bundle.counts.issues
    }, { section: null });
  }

  function handleReviewSnapshotExport() {
    const nextValidation = validatePrdDocument(prd);

    setValidation(nextValidation);

    if (nextValidation.status !== "valid") {
      appendDiagnosticEvent("export", "blocked", {
        kind: "review_snapshot",
        ...validationDiagnosticDetails(nextValidation)
      }, { section: null });
      return;
    }

    const exportedAt = new Date().toISOString();
    const nextReadiness = buildApprovalReadiness({
      prd,
      validation: nextValidation,
      compatibility,
      traceability
    });
    const snapshot = buildReviewSnapshot({
      prd,
      sourceLabel: fileSession.sourceLabel,
      exportedAt,
      validation: nextValidation,
      compatibility,
      readinessSignals: nextReadiness.signals,
      traceability
    });

    downloadJson(buildReviewSnapshotFilename(prd, exportedAt), snapshot);
    appendDiagnosticEvent("export", "success", {
      kind: "review_snapshot",
      readiness_status: nextReadiness.status,
      readiness_blockers: nextReadiness.blockerCount,
      trace_issue_count: traceability.issues.length,
      ...validationDiagnosticDetails(nextValidation)
    }, { section: null });
  }

  function handleDiagnosticSnapshotExport() {
    const snapshot = buildDiagnosticSnapshot(diagnosticEvents);

    downloadJson(`prd-viewer-diagnostics-${snapshot.exported_at.slice(0, 10)}.json`, snapshot);
    appendDiagnosticEvent("export", "success", {
      kind: "diagnostics",
      event_count: diagnosticEvents.length
    }, { section: null });
  }

  function handleProjectStatusReportExport() {
    const nextValidation = validatePrdDocument(prd);

    setValidation(nextValidation);

    if (nextValidation.status !== "valid") {
      appendDiagnosticEvent("export", "blocked", {
        kind: "project_status_report",
        ...validationDiagnosticDetails(nextValidation)
      }, { section: null });
      return;
    }

    const defaultReportName = prd.meta.product_name || prd.meta.title || "Project status";
    const enteredReportName = window.prompt("Project name for the standalone status report", defaultReportName);

    if (enteredReportName === null) {
      appendDiagnosticEvent("export", "blocked", {
        kind: "project_status_report",
        reason: "cancelled"
      }, { section: null });
      return;
    }

    const reportTitle = enteredReportName.trim() || defaultReportName;
    const exportedAt = new Date().toISOString();
    const nextReadiness = buildApprovalReadiness({
      prd,
      validation: nextValidation,
      compatibility,
      traceability
    });
    const html = buildProjectStatusReportHtml({
      prd,
      sourceLabel: fileSession.sourceLabel,
      reportTitle,
      exportedAt,
      readiness: nextReadiness
    });

    downloadText(buildProjectStatusReportFilename(reportTitle, exportedAt), html, "text/html");
    appendDiagnosticEvent("export", "success", {
      kind: "project_status_report",
      report_title_length: reportTitle.length,
      readiness_status: nextReadiness.status,
      readiness_blockers: nextReadiness.blockerCount
    }, { section: null });
  }

  function navigateToDashboardTarget(target: DashboardTarget) {
    setWorkspaceView("review");

    if (target.section) {
      setActiveSection(target.section);
    }

    requestAnimationFrame(() => {
      const panel = document.getElementById(target.panelId);

      if (typeof panel?.scrollIntoView === "function") {
        panel.scrollIntoView({ block: "start", behavior: "smooth" });
      }

      panel?.focus({ preventScroll: true });
    });
  }

  function navigateToEditor() {
    setWorkspaceView("editor");

    requestAnimationFrame(() => {
      const panel = document.getElementById("editor-panel");

      if (typeof panel?.scrollIntoView === "function") {
        panel.scrollIntoView({ block: "start", behavior: "smooth" });
      }

      panel?.focus({ preventScroll: true });
    });
  }

  return (
    <main className="app-shell">
      <aside className="workspace-rail" aria-label="PRD sections">
        <div className="brand-block">
          <span className="eyebrow">PACS</span>
          <h1>PRD Viewer</h1>
          <p>{summary.sourceLabel}</p>
        </div>
        <SectionRail
          sections={summary.sections}
          activeSection={activeSection}
          onSelect={setActiveSection}
        />
        <nav className="workspace-view-rail" aria-label="Workspace views">
          <button
            type="button"
            className={workspaceView === "review" ? "is-active" : ""}
            aria-current={workspaceView === "review" ? "page" : undefined}
            onClick={() => setWorkspaceView("review")}
          >
            Review dashboard
          </button>
          <button
            type="button"
            className={workspaceView === "editor" ? "is-active" : ""}
            aria-current={workspaceView === "editor" ? "page" : undefined}
            onClick={navigateToEditor}
          >
            Section editor
          </button>
        </nav>
      </aside>

      <section className="workspace-main" aria-label="PRD review workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{summary.lifecycle}</span>
            <h2>{summary.title}</h2>
            <p>{summary.subtitle}</p>
          </div>
          <div className="action-row" aria-label="Workspace actions">
            <label className="file-action">
              Open PRD
              <input type="file" accept="application/json,.json" aria-label="Open PRD" onChange={handleFileOpen} />
            </label>
            <button type="button" onClick={handleWritableFileOpen} disabled={!supportsWritableOpen}>
              Open writable
            </button>
            <button type="button" onClick={handleValidate}>
              Validate
            </button>
            <button type="button" onClick={handlePrdExport}>
              Export PRD
            </button>
            <button
              type="button"
              onClick={handleSaveWriteback}
              disabled={
                !fileSession.canWriteBack ||
                !fileSession.hasUnsavedChanges ||
                validation.status !== "valid" ||
                compatibility.migrationRequired ||
                compatibility.requiredExtensions.length > 0
              }
            >
              Save changes
            </button>
            <button type="button" onClick={handleReviewSnapshotExport}>
              Export snapshot
            </button>
            <button type="button" onClick={handleProjectStatusReportExport}>
              Generate report
            </button>
            <button type="button" onClick={navigateToEditor}>
              Edit section
            </button>
            <button type="button" onClick={handleDiagnosticSnapshotExport}>
              Export diagnostics
            </button>
          </div>
          <p
            className={`workspace-feedback editor-message editor-message--${saveMessage.tone}`}
            role={saveMessage.tone === "danger" ? "alert" : "status"}
            aria-live={saveMessage.tone === "danger" ? "assertive" : "polite"}
          >
            {saveMessage.text}
          </p>
        </header>

        {workspaceView === "review" ? (
          <>
        <section className="status-strip" aria-label="Review status">
          <MetricTile label="Functional requirements" value={summary.metrics.functionalRequirements} onActivate={() => navigateToDashboardTarget({ section: "requirements", panelId: "selected-section-panel" })} />
          <MetricTile label="User stories" value={summary.metrics.userStories} onActivate={() => navigateToDashboardTarget({ section: "user_stories", panelId: "selected-section-panel" })} />
          <MetricTile label="Tracking work" value={summary.metrics.projectTrackingPendingWork} onActivate={() => navigateToDashboardTarget({ section: "project_tracking", panelId: "project-tracking-panel" })} />
          <MetricTile label="Tracking issues" value={summary.metrics.projectTrackingIssues} tone={summary.metrics.projectTrackingIssues > 0 ? "warning" : "neutral"} onActivate={() => navigateToDashboardTarget({ section: "project_tracking", panelId: "project-tracking-panel" })} />
          <MetricTile label="Tracking blockers" value={summary.metrics.projectTrackingBlockers} tone={summary.metrics.projectTrackingBlockers > 0 ? "danger" : "neutral"} onActivate={() => navigateToDashboardTarget({ section: "project_tracking", panelId: "project-tracking-panel" })} />
          <MetricTile label="Open questions" value={summary.metrics.openQuestions} tone="warning" onActivate={() => navigateToDashboardTarget({ section: "open_questions", panelId: "selected-section-panel" })} />
          <MetricTile label="Decisions" value={summary.metrics.decisions} onActivate={() => navigateToDashboardTarget({ section: "decisions", panelId: "selected-section-panel" })} />
          <MetricTile label="Risks" value={summary.metrics.risks} tone="danger" onActivate={() => navigateToDashboardTarget({ section: "risks", panelId: "selected-section-panel" })} />
          <MetricTile label="Schema" value={validation.status === "valid" ? "Valid" : "Invalid"} tone={validationTone === "danger" ? "danger" : "neutral"} onActivate={() => navigateToDashboardTarget({ panelId: "validation-panel" })} />
          <MetricTile label="Compatibility" value={formatCompatibilityStatus(compatibility.status)} tone={compatibilityTone === "danger" ? "danger" : "neutral"} onActivate={() => navigateToDashboardTarget({ panelId: "compatibility-panel" })} />
          <MetricTile label="Trace links" value={traceability.counts.relationships} tone={traceability.counts.brokenReferences > 0 ? "danger" : "neutral"} onActivate={() => navigateToDashboardTarget({ panelId: "traceability-panel" })} />
          <MetricTile label="Diagnostics" value={diagnosticEvents.length} onActivate={() => navigateToDashboardTarget({ panelId: "diagnostics-panel" })} />
        </section>

        <section className="content-grid">
          <div className="review-panel primary-panel" id="selected-section-panel" tabIndex={-1}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Selected section</span>
                <h3>{selectedSection?.label ?? "Requirements"}</h3>
              </div>
              <StatusPill tone={selectedSection?.tone ?? "neutral"}>
                {selectedSection?.status ?? "Ready"}
              </StatusPill>
            </div>
            <dl className="section-facts">
              <div>
                <dt>Items</dt>
                <dd>{selectedSection?.count ?? 0}</dd>
              </div>
              <div>
                <dt>PRD key</dt>
                <dd>{selectedSection?.key ?? activeSection}</dd>
              </div>
              <div>
                <dt>Validation</dt>
                <dd>{validation.status === "valid" ? "Valid" : "Invalid"}</dd>
              </div>
            </dl>
            <p className="panel-copy">
              {selectedSection?.description ??
                "Select a PRD section to inspect the current document shape."}
            </p>
            <div className="section-item-browser" aria-label={`${selectedSection?.label ?? "Section"} items`}>
              {visibleSectionItems.map((sectionItem) => (
                <article className="section-item" key={sectionItem.id}>
                  <div>
                    <strong>{sectionItem.id}</strong>
                    <span>{sectionItem.meta}</span>
                  </div>
                  <h4>{sectionItem.title}</h4>
                  <p>{sectionItem.summary}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="review-panel" id="readiness-panel" tabIndex={-1}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Readiness</span>
                <h3>Approval readiness</h3>
              </div>
              <StatusPill tone={readiness.status === "blocked" ? "danger" : readiness.status === "warnings" ? "warning" : "success"}>
                {readiness.status === "blocked" ? "Blocked" : readiness.status === "warnings" ? "Warnings" : "Ready"}
              </StatusPill>
            </div>
            <dl className="section-facts readiness-facts">
              <div>
                <dt>Blockers</dt>
                <dd>{readiness.blockerCount}</dd>
              </div>
              <div>
                <dt>Warnings</dt>
                <dd>{readiness.warningCount}</dd>
              </div>
              <div>
                <dt>Checked</dt>
                <dd>{readiness.checkedAt ? new Date(readiness.checkedAt).toLocaleTimeString() : "Not run"}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{fileSession.sourceLabel}</dd>
              </div>
            </dl>
            {readiness.signals.length > 0 ? (
              <ul className="signal-list" aria-label="Approval readiness signals">
                {readiness.signals.map((signal) => (
                  <li key={signal.id}>
                    <button
                      type="button"
                      className="signal-button"
                      aria-label={`View readiness signal: ${signal.message}. ${formatReadinessSignalMeta(signal)}`}
                      onClick={() => navigateToDashboardTarget(targetForReadinessSignal(signal))}
                    >
                      <span className="signal-message">{signal.message}</span>
                      <span className="signal-meta">{formatReadinessSignalMeta(signal)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-copy">
                Ready for approval based on schema validation at {readiness.checkedAt ? new Date(readiness.checkedAt).toLocaleTimeString() : "the latest check"} from {fileSession.sourceLabel}.
              </p>
            )}
          </div>

          <div className="review-panel" id="project-tracking-panel" tabIndex={-1}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">First-class status</span>
                <h3>Project tracking</h3>
              </div>
              <StatusPill
                tone={
                  prd.project_tracking.blockers.some((blocker) => blocker.status === "active")
                    ? "danger"
                    : prd.project_tracking.status === "blocked" || prd.project_tracking.status === "at_risk"
                      ? "warning"
                      : prd.project_tracking.status === "completed"
                        ? "success"
                        : "neutral"
                }
              >
                {prd.project_tracking.status.replace(/_/g, " ")}
              </StatusPill>
            </div>
            <dl className="section-facts readiness-facts">
              <div>
                <dt>Pending work</dt>
                <dd>{prd.project_tracking.pending_work.length}</dd>
              </div>
              <div>
                <dt>Issues</dt>
                <dd>{prd.project_tracking.issues_found.length}</dd>
              </div>
              <div>
                <dt>Active blockers</dt>
                <dd>{prd.project_tracking.blockers.filter((blocker) => blocker.status === "active").length}</dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>{prd.project_tracking.notes.length}</dd>
              </div>
            </dl>
            <p className="panel-copy">
              {prd.project_tracking.summary ?? "No project tracking summary recorded."}
            </p>
            {prd.project_tracking.blockers.length > 0 ? (
              <ul className="issue-list" aria-label="Project-tracking blockers">
                {prd.project_tracking.blockers.slice(0, 4).map((blocker) => (
                  <li key={blocker.blocker_id}>
                    <strong>{blocker.blocker_id}</strong>
                    <span>{blocker.title}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="section-item-browser" aria-label="Project-tracking work and issues">
              {[
                ...prd.project_tracking.pending_work.slice(0, 2).map((item) => ({
                  id: item.work_item_id,
                  title: item.title,
                  summary: item.description,
                  meta: `${item.status} / ${item.priority}`
                })),
                ...prd.project_tracking.issues_found.slice(0, 2).map((issue) => ({
                  id: issue.issue_id,
                  title: issue.title,
                  summary: issue.description,
                  meta: `${issue.status} / ${issue.severity}`
                }))
              ].map((item) => (
                <article className="section-item" key={item.id}>
                  <div>
                    <strong>{item.id}</strong>
                    <span>{item.meta}</span>
                  </div>
                  <h4>{item.title}</h4>
                  <p>{item.summary}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="review-panel traceability-panel" id="traceability-panel" tabIndex={-1}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Derived links</span>
                <h3>Traceability matrix</h3>
              </div>
              <StatusPill tone={traceability.issues.length > 0 ? "danger" : "success"}>
                {traceability.issues.length > 0 ? "Broken refs" : "Linked"}
              </StatusPill>
            </div>
            <dl className="section-facts">
              <div>
                <dt>Requirements</dt>
                <dd>{traceability.counts.requirements}</dd>
              </div>
              <div>
                <dt>Stories</dt>
                <dd>{traceability.counts.stories}</dd>
              </div>
              <div>
                <dt>Relationships</dt>
                <dd>{traceability.counts.relationships}</dd>
              </div>
              <div>
                <dt>Broken refs</dt>
                <dd>{traceability.counts.brokenReferences}</dd>
              </div>
            </dl>
            <div className="trace-matrix" role="table" aria-label="Requirement traceability matrix">
              <div className="trace-row trace-row--head" role="row">
                <span role="columnheader">Requirement</span>
                <span role="columnheader">Stories</span>
                <span role="columnheader">Decisions</span>
                <span role="columnheader">Dependencies</span>
                <span role="columnheader">Personas</span>
              </div>
              {traceability.matrixRows.slice(0, 8).map((row) => (
                <div className={row.issueCount > 0 ? "trace-row trace-row--warning" : "trace-row"} role="row" key={row.requirementId}>
                  <span role="cell">
                    <strong>{row.requirementId}</strong>
                    <small>{row.title}</small>
                  </span>
                  <TraceIdList ids={row.stories} empty="No stories" />
                  <TraceIdList ids={row.decisions} empty="No decisions" />
                  <TraceIdList ids={[...row.prerequisites, ...row.dependencies]} empty="No dependencies" />
                  <TraceIdList ids={row.personas} empty="No personas" />
                </div>
              ))}
            </div>
            {traceability.issues.length > 0 ? (
              <ul className="issue-list" aria-label="Traceability issues">
                {traceability.issues.slice(0, 5).map((issue) => (
                  <li key={issue.id}>
                    <strong>{issue.target}</strong>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-copy">All derived story, decision, dependency, and persona links resolve to known PRD IDs.</p>
            )}
          </div>

          <TraceabilityGraphPanel
            traceability={traceability}
            graph={focusedTraceGraph}
            selectedNodeId={selectedTraceNodeId}
            onSelectNode={setActiveTraceNodeId}
            onExportTrace={handleTraceExport}
          />

          <div className="review-panel validation-panel" id="validation-panel" tabIndex={-1}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">schema.strict.json</span>
                <h3>Schema validation</h3>
              </div>
              <StatusPill tone={validationTone}>
                {validation.status === "valid" ? "Valid" : validation.status === "invalid" ? "Invalid" : "Not run"}
              </StatusPill>
            </div>
            <dl className="section-facts">
              <div>
                <dt>Status</dt>
                <dd>{validation.status}</dd>
              </div>
              <div>
                <dt>Issues</dt>
                <dd>{validation.issues.length}</dd>
              </div>
              <div>
                <dt>Checked</dt>
                <dd>{validation.checkedAt ? new Date(validation.checkedAt).toLocaleTimeString() : "Not run"}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{fileSession.sourceLabel}</dd>
              </div>
            </dl>
            {validation.issues.length > 0 ? (
              <ul className="issue-list" aria-label="Schema validation issues">
                {validation.issues.slice(0, 5).map((issue, index) => (
                  <li key={`${issue.path}-${issue.keyword ?? issue.message}-${index}`}>
                    <strong>{issue.path}</strong>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-copy">Loaded PRD matches schema.strict.json.</p>
            )}
          </div>

          <div className="review-panel compatibility-panel" id="compatibility-panel" tabIndex={-1}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">schema.versions.json</span>
                <h3>Schema compatibility</h3>
              </div>
              <StatusPill tone={compatibilityTone}>
                {formatCompatibilityStatus(compatibility.status)}
              </StatusPill>
            </div>
            <dl className="section-facts">
              <div>
                <dt>Document schema</dt>
                <dd>{compatibility.declaredSchemaVersion ?? "Legacy"}</dd>
              </div>
              <div>
                <dt>Current schema</dt>
                <dd>{compatibility.currentSchemaVersion}</dd>
              </div>
              <div>
                <dt>Extensions</dt>
                <dd>{compatibility.extensions.length}</dd>
              </div>
              <div>
                <dt>Required</dt>
                <dd>{compatibility.requiredExtensions.length}</dd>
              </div>
            </dl>
            {compatibility.warnings.length > 0 ? (
              <ul className="issue-list" aria-label="Schema compatibility warnings">
                {compatibility.warnings.map((warning) => (
                  <li key={warning}>
                    <strong>Compatibility warning</strong>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-copy">Loaded PRD is compatible with the current schema manifest.</p>
            )}
          </div>

          <div className="review-panel diagnostics-panel" id="diagnostics-panel" tabIndex={-1}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Local only</span>
                <h3>Diagnostics</h3>
              </div>
              <StatusPill tone={diagnosticEvents.some((event) => event.outcome === "failure") ? "warning" : "neutral"}>
                {diagnosticEvents.length} events
              </StatusPill>
            </div>
            <p className="panel-copy">
              Structured events stay in this browser session and exclude PRD content, secrets, and large field values. Export diagnostics creates a local JSON snapshot for support.
            </p>
            {diagnosticEvents.length > 0 ? (
              <ol className="diagnostic-event-list" aria-label="Local diagnostic events">
                {diagnosticEvents.slice(0, 8).map((event) => (
                  <li key={event.event_id}>
                    <div>
                      <strong>{event.action}</strong>
                      <span>{event.outcome}</span>
                      <time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleTimeString()}</time>
                    </div>
                    <small>{formatDiagnosticDetails(event.details)}</small>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="panel-copy">No local diagnostic events recorded yet.</p>
            )}
          </div>
        </section>
          </>
        ) : (
        <section className="content-grid editor-workspace" aria-label="Section editor workspace">
          <div className="review-panel editor-panel editor-panel--standalone" id="editor-panel" tabIndex={-1}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Structured editing and raw JSON maintainer mode</span>
                <h3>Section editor</h3>
              </div>
              <StatusPill tone={fileSession.hasUnsavedChanges ? "warning" : "success"}>
                {fileSession.hasUnsavedChanges ? "Unsaved changes" : "Clean"}
              </StatusPill>
            </div>
            <StructuredSectionEditor
              key={activeSection}
              sectionKey={activeSection}
              value={prd[activeSection]}
              onApply={handleApplyStructuredEdit}
            />
            <label className="section-editor">
              <span>{selectedSection?.label ?? activeSection} JSON</span>
              <textarea
                value={sectionDraft}
                onChange={(event) => setSectionDraft(event.target.value)}
                spellCheck={false}
                aria-label="Section JSON editor"
              />
            </label>
            <div className="editor-actions">
              <button type="button" onClick={handleApplySectionEdit}>
                Apply section
              </button>
              <button type="button" onClick={handleResetSectionEdit}>
                Reset section
              </button>
            </div>
            <p
              className={`editor-message editor-message--${editorMessage.tone}`}
              role={editorMessage.tone === "danger" ? "alert" : "status"}
              aria-live={editorMessage.tone === "danger" ? "assertive" : "polite"}
            >
              {editorMessage.text}
            </p>
            <div className="pending-diff" aria-label="Pending changed sections">
              <strong>Pending writeback preview</strong>
              {changePreview.length > 0 ? (
                <ol className="pending-diff-list">
                  {changePreview.map((change) => (
                    <li key={change.section}>
                      <span className="pending-diff-section">{change.section}</span>
                      <span>{formatChangeCount(change.added, "added")}</span>
                      <span>{formatChangeCount(change.removed, "removed")}</span>
                      <span>{formatChangeCount(change.changed, "changed")}</span>
                      {change.samplePaths.length > 0 ? (
                        <small>{change.samplePaths.join(", ")}</small>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No pending section changes.</p>
              )}
            </div>
            <p
              className={`editor-message editor-message--${saveMessage.tone}`}
              role={saveMessage.tone === "danger" ? "alert" : "status"}
              aria-live={saveMessage.tone === "danger" ? "assertive" : "polite"}
            >
              {saveMessage.text}
            </p>
          </div>
        </section>
        )}
      </section>
    </main>
  );
}

function targetForReadinessSignal(signal: ApprovalReadinessSignal): DashboardTarget {
  if (signal.sourceSection === "project_tracking") {
    return { section: "project_tracking", panelId: "project-tracking-panel" };
  }

  if (signal.sourceSection === "open_questions") {
    return { section: "open_questions", panelId: "selected-section-panel" };
  }

  if (signal.sourceSection === "decisions") {
    return { section: "decisions", panelId: "selected-section-panel" };
  }

  if (signal.sourceSection === "risks") {
    return { section: "risks", panelId: "selected-section-panel" };
  }

  if (signal.sourceSection === "requirements") {
    return { section: "requirements", panelId: signal.category === "traceability" ? "traceability-panel" : "selected-section-panel" };
  }

  if (signal.category === "traceability") {
    return { panelId: "traceability-panel" };
  }

  if (signal.sourceSection === "compatibility") {
    return { panelId: "compatibility-panel" };
  }

  return { panelId: "validation-panel" };
}

function formatReadinessSignalMeta(signal: ApprovalReadinessSignal): string {
  return [
    signal.severity,
    signal.category.replace(/_/g, " "),
    signal.sourceId ?? signal.jsonPath ?? signal.sourceSection
  ].join(" / ");
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: "application/json"
  });
  downloadBlob(filename, blob);
}

function downloadText(filename: string, value: string, type: string) {
  const blob = new Blob([value], {
    type
  });
  downloadBlob(filename, blob);
}

function downloadBlob(filename: string, blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      resolve(String(reader.result ?? ""));
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Unable to read file."));
    });
    reader.readAsText(file);
  });
}

function serializePrd(prd: PrdDocument): string {
  return `${JSON.stringify(prd, null, 2)}\n`;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function documentsEqual(left: PrdDocument, right: PrdDocument): boolean {
  return serializePrd(left) === serializePrd(right);
}

function buildPrdFilename(prd: PrdDocument): string {
  const slug = prd.meta.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "prd";

  return `${slug}.json`;
}

function formatChangeCount(count: number, label: "added" | "removed" | "changed"): string {
  return `${count} ${label}`;
}

function validationDiagnosticDetails(validation: ValidationResult): Record<string, unknown> {
  return {
    validation_status: validation.status,
    validation_issue_count: validation.issues.length,
    validation_issue_paths: validation.issues.slice(0, 5).map((issue) => issue.path),
    validation_issue_keywords: validation.issues.slice(0, 5).map((issue) => issue.keyword ?? "unknown")
  };
}

function fileExtension(filename: string): string {
  const match = filename.match(/\.([a-z0-9]+)$/i);

  return match ? `.${match[1].toLowerCase()}` : "none";
}

function formatDiagnosticDetails(details: Record<string, unknown>): string {
  const entries = Object.entries(details);

  if (entries.length === 0) {
    return "No additional details.";
  }

  return entries
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join("|") : String(value)}`)
    .join(" / ");
}

function TraceIdList({ ids, empty }: { ids: string[]; empty: string }) {
  return (
    <span className="trace-id-list" role="cell">
      {ids.length > 0 ? ids.map((id) => <b key={id}>{id}</b>) : <em>{empty}</em>}
    </span>
  );
}
