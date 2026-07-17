import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import seedPrd from "../PRD_web_ui.json";
import App from "./App";
import {
  brokenTraceLinksPrdFixture,
  malformedPrdJsonFixture,
  requiredExtensionPrdFixture,
  schemaInvalidPrdFixture,
  serializePrdFixture,
  unsupportedSchemaVersionPrdFixture,
  validPrdFixture
} from "./test/prdFixtures";

describe("App", () => {
  beforeEach(() => {
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true
    });
    vi.mocked(URL.createObjectURL).mockClear();
    vi.mocked(URL.revokeObjectURL).mockClear();
  });

  it("renders the PRD review workspace from the seed document", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "PRD Viewer" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PRD Reviewer Local/Web UI" })).toBeInTheDocument();
    expect(screen.getAllByText("Functional requirements").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Schema validation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Schema compatibility" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Traceability matrix" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Traceability graph" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Project tracking" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Section editor" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit section" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Focused node" })).toHaveValue("FR-005");
    expect(screen.getByText("Loaded PRD matches schema.strict.json.")).toBeInTheDocument();
    expect(screen.getByText("Loaded PRD is compatible with the current schema manifest.")).toBeInTheDocument();
    expect(screen.getByText("All derived story, decision, dependency, and persona links resolve to known PRD IDs.")).toBeInTheDocument();
    expect(screen.getAllByText("FR-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("NFR-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("US-003").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DEC-007").length).toBeGreaterThan(0);
    expect(screen.getByText("Focused node: FR-005")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export trace" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Open canonical PRD in browser" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export PRD" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Open writable" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export snapshot" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export diagnostics" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Diagnostics" })).toBeInTheDocument();
  });

  it("updates the traceability graph focus from the node selector", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Focused node" }), "US-003");

    const details = screen.getByLabelText("Focused trace details");

    expect(screen.getByText("Focused node: US-003")).toBeInTheDocument();
    expect(within(details).getByText("Inbound links")).toBeInTheDocument();
    expect(within(details).getByText("Outbound links")).toBeInTheDocument();
    expect(within(details).getByText("0")).toBeInTheDocument();
    expect(within(details).getByText("3")).toBeInTheDocument();
    expect(within(details).getByText("FR-005")).toBeInTheDocument();
    expect(within(details).getByText("FR-007")).toBeInTheDocument();
    expect(within(details).getByText("P-003")).toBeInTheDocument();
  });

  it("exports an agent-ready trace summary for the focused node", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Export trace" }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    const bundle = JSON.parse(await readBlobText(blob)) as {
      schema: string;
      selected_node_id: string;
      selected_node: { id: string; status: string };
      nodes: Array<{ id: string }>;
    };

    expect(bundle.schema).toBe("prd.trace-summary.v1");
    expect(bundle.selected_node_id).toBe("FR-005");
    expect(bundle.selected_node).toEqual(expect.objectContaining({ id: "FR-005", status: "proposed" }));
    expect(bundle.nodes).toContainEqual(expect.objectContaining({ id: "US-003" }));
    expect(bundle.nodes).toContainEqual(expect.objectContaining({ id: "DEC-007" }));
  });

  it("exports a read-only review snapshot from the workspace action", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Export snapshot" }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    const snapshot = JSON.parse(await readBlobText(blob)) as {
      schema: string;
      source: { title: string };
      validation: { status: string };
      readiness: {
        status: string;
        blocker_count: number;
        signals: Array<{ category: string; severity: string; sourceId: string | null; jsonPath: string | null }>;
      };
      project_tracking: { status: string; active_blocker_count: number };
      counts: { project_tracking_pending_work: number };
      traceability: { counts: { requirements: number } };
    };

    expect(snapshot.schema).toBe("prd.review-snapshot.v2");
    expect(snapshot.source.title).toBe("PRD Reviewer Local/Web UI");
    expect(snapshot.validation.status).toBe("valid");
    expect(snapshot.readiness.status).toBe("blocked");
    expect(snapshot.readiness.blocker_count).toBeGreaterThan(0);
    expect(snapshot.readiness.signals).toContainEqual(
      expect.objectContaining({
        category: "project_tracking",
        severity: "blocker",
        sourceId: "PTB-002"
      })
    );
    expect(snapshot.readiness.signals).toContainEqual(
      expect.objectContaining({
        category: "open_questions",
        severity: "blocker",
        sourceId: "Q-001",
        jsonPath: "$[\"open_questions\"][0]"
      })
    );
    expect(snapshot.project_tracking.status).toBe("in_progress");
    expect(snapshot.project_tracking.active_blocker_count).toBeGreaterThan(0);
    expect(snapshot.counts.project_tracking_pending_work).toBeGreaterThan(0);
    expect(snapshot.traceability.counts.requirements).toBeGreaterThan(0);
  });

  it("exports a standalone html project status report with a custom project name", async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Acme Delivery Status");
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Generate report" }));

    expect(promptSpy).toHaveBeenCalledWith(
      "Project name for the standalone status report",
      "PRD Viewer"
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    const html = await readBlobText(blob);

    expect(blob.type).toBe("text/html");
    expect(html).toContain("Acme Delivery Status");
    expect(html).toContain('class="report-sidebar"');
    expect(html).toContain('aria-label="Report sections"');
    expect(html).toContain("Approval readiness");
    expect(html).toContain("Project tracking");
    expect(html).toContain("Open questions");
    expect(html).toContain("Proposed decisions");
    expect(html).not.toContain("<h3>Section editor</h3>");
    expect(html).not.toContain("<h2>Schema validation</h2>");
    expect(html).not.toContain("<h2>Schema compatibility</h2>");
    expect(html).not.toContain("<h3>Diagnostics</h3>");
    promptSpy.mockRestore();
  });

  it("applies a valid section JSON edit locally and exports the changed PRD", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSectionEditor(user);
    const editedRequirements = structuredClone(seedPrd.requirements);
    editedRequirements.functional[0].title = "Open canonical PRD with safe local editing";

    fireEvent.change(screen.getByRole("textbox", { name: "Section JSON editor" }), {
      target: {
        value: JSON.stringify(editedRequirements, null, 2)
      }
    });
    await user.click(screen.getByRole("button", { name: "Apply section" }));

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByLabelText("Pending changed sections")).toHaveTextContent("requirements");
    expect(screen.getByLabelText("Pending changed sections")).toHaveTextContent("1 changed");
    expect(screen.getByLabelText("Pending changed sections")).toHaveTextContent("requirements.functional[FR-001].title");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await openReviewDashboard(user);
    expect(screen.getByRole("heading", { name: "Open canonical PRD with safe local editing" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Export PRD" }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    const exportedPrd = JSON.parse(await readBlobText(blob)) as typeof seedPrd;

    expect(exportedPrd.requirements.functional[0].title).toBe("Open canonical PRD with safe local editing");
  });

  it("blocks invalid section JSON edits before replacing the active document", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSectionEditor(user);

    fireEvent.change(screen.getByRole("textbox", { name: "Section JSON editor" }), {
      target: {
        value: "{}"
      }
    });
    await user.click(screen.getByRole("button", { name: "Apply section" }));

    expect(screen.getByText("Section change would make PRD invalid. No changes applied.")).toBeInTheDocument();
    await openReviewDashboard(user);
    expect(screen.getByRole("heading", { name: "Open canonical PRD in browser" })).toBeInTheDocument();
    await openSectionEditor(user);
    expect(screen.getByLabelText("Pending changed sections")).toHaveTextContent("No pending section changes.");
  });

  it("applies structured requirement edits only after full PRD validation", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSectionEditor(user);

    expect(screen.getAllByRole("heading", { name: "Requirements" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("combobox", { name: "FR-001 Priority" })).toHaveValue("must");
    expect(screen.getByRole("textbox", { name: "FR-001 Rationale" })).toBeInTheDocument();

    await user.clear(screen.getByRole("textbox", { name: "FR-001 Title" }));
    await user.click(screen.getByRole("button", { name: "Apply structured edits" }));

    expect(screen.getByText("Structured section change would make PRD invalid. No changes applied.")).toBeInTheDocument();
    await openReviewDashboard(user);
    expect(screen.getByRole("heading", { name: "Open canonical PRD in browser" })).toBeInTheDocument();
    await openSectionEditor(user);

    await user.clear(screen.getByRole("textbox", { name: "FR-001 Title" }));
    await user.type(screen.getByRole("textbox", { name: "FR-001 Title" }), "Open canonical PRD through structured editing");
    await user.click(screen.getByRole("button", { name: "Apply structured edits" }));

    expect(screen.getByText("Requirements structured changes applied locally.")).toBeInTheDocument();
    expect(screen.getByLabelText("Pending changed sections")).toHaveTextContent("requirements");
    expect(screen.getByLabelText("Pending changed sections")).toHaveTextContent("requirements.functional[FR-001].title");
    await openReviewDashboard(user);
    expect(screen.getByRole("heading", { name: "Open canonical PRD through structured editing" })).toBeInTheDocument();
  });

  it("supports structured add, duplicate, reorder, and remove for schema-backed arrays", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSectionEditor(user);
    const sectionNav = screen.getByRole("navigation", { name: "PRD section navigation" });

    await user.click(within(sectionNav).getByRole("button", { name: /Questions/i }));
    await user.click(screen.getByRole("button", { name: "Add open question" }));

    expect(screen.getByText("Q-009")).toBeInTheDocument();

    await user.click(within(getStructuredItem("Q-001")).getByRole("button", { name: "Duplicate" }));

    expect(screen.getByText("Q-010")).toBeInTheDocument();

    await user.click(within(getStructuredItem("Q-010")).getByRole("button", { name: "Up" }));
    await user.click(within(getStructuredItem("Q-010")).getByRole("button", { name: "Remove" }));

    expect(screen.queryByText("Q-010")).not.toBeInTheDocument();

    await user.clear(screen.getByRole("textbox", { name: "Q-009 Question" }));
    await user.type(screen.getByRole("textbox", { name: "Q-009 Question" }), "Which structured editor controls are required before pilot?");
    await user.selectOptions(screen.getByRole("combobox", { name: "Q-009 Status" }), "deferred");
    await user.click(screen.getByRole("button", { name: "Apply structured edits" }));

    expect(screen.getByText("Open questions structured changes applied locally.")).toBeInTheDocument();
    expect(screen.getByLabelText("Pending changed sections")).toHaveTextContent("open_questions");
    expect(screen.getByDisplayValue("Which structured editor controls are required before pilot?")).toBeInTheDocument();
  });

  it("renders nested story acceptance criteria and applies them without raw JSON edits", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSectionEditor(user);
    const sectionNav = screen.getByRole("navigation", { name: "PRD section navigation" });

    await user.click(within(sectionNav).getByRole("button", { name: /Stories/i }));
    await user.clear(screen.getByRole("textbox", { name: "US-001 Acceptance criteria 1 given" }));
    await user.type(screen.getByRole("textbox", { name: "US-001 Acceptance criteria 1 given" }), "a reviewer opens the structured editor");
    await user.click(screen.getByRole("button", { name: "Apply structured edits" }));

    expect(screen.getByText("User stories structured changes applied locally.")).toBeInTheDocument();
    expect(screen.getByLabelText("Pending changed sections")).toHaveTextContent("user_stories");
    expect(screen.getByDisplayValue("a reviewer opens the structured editor")).toBeInTheDocument();
  });

  it("renders structured editors for each requested MVP section", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSectionEditor(user);
    const sectionNav = screen.getByRole("navigation", { name: "PRD section navigation" });

    expect(screen.getByRole("button", { name: "Add functional requirement" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add non-functional requirement" })).toBeInTheDocument();

    await user.click(within(sectionNav).getByRole("button", { name: /Stories/i }));
    expect(screen.getByRole("button", { name: "Add user story" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "US-001 Acceptance criteria 1 given" })).toBeInTheDocument();

    await user.click(within(sectionNav).getByRole("button", { name: /Project tracking/i }));
    expect(screen.getByRole("combobox", { name: "Project tracking Status" })).toHaveValue("in_progress");
    expect(screen.getByRole("button", { name: "Add work item" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add issue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add blocker" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add tracking note" })).toBeInTheDocument();

    await user.click(within(sectionNav).getByRole("button", { name: /Risks/i }));
    expect(screen.getByRole("button", { name: "Add risk" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "R-001 Category" })).toBeInTheDocument();

    await user.click(within(sectionNav).getByRole("button", { name: /Questions/i }));
    expect(screen.getByRole("button", { name: "Add open question" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Q-001 Status" })).toBeInTheDocument();

    await user.click(within(sectionNav).getByRole("button", { name: /Decisions/i }));
    expect(screen.getByRole("button", { name: "Add decision" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "DEC-001 Status" })).toBeInTheDocument();

    await user.click(within(sectionNav).getByRole("button", { name: /Delivery/i }));
    expect(screen.getByRole("button", { name: "Add readiness item" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Schema-driven MVP section editing Status" })).toHaveValue("ready");
  });

  it("applies structured project-tracking edits and preserves them through export", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSectionEditor(user);
    const sectionNav = screen.getByRole("navigation", { name: "PRD section navigation" });

    await user.click(within(sectionNav).getByRole("button", { name: /Project tracking/i }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Project tracking Status" }), "at_risk");
    await user.clear(screen.getByRole("textbox", { name: "PTW-001 Title" }));
    await user.type(screen.getByRole("textbox", { name: "PTW-001 Title" }), "Implement project-tracking structured editing");
    const workItemEditor = screen.getByText("PTW-001").closest("article");
    expect(workItemEditor).not.toBeNull();
    await user.click(within(workItemEditor!).getByRole("button", { name: "Add external refs" }));
    await user.type(
      within(workItemEditor!).getByRole("textbox", { name: "PTW-001 External refs 1" }),
      "https://github.com/example/project/issues/123"
    );
    await user.click(screen.getByRole("button", { name: "Add issue" }));
    await user.clear(screen.getByRole("textbox", { name: "PTI-005 Title" }));
    await user.type(screen.getByRole("textbox", { name: "PTI-005 Title" }), "Project tracking regression gap");
    await user.click(screen.getByRole("button", { name: "Apply structured edits" }));

    expect(screen.getByText("Project tracking structured changes applied locally.")).toBeInTheDocument();
    await openReviewDashboard(user);
    expect(screen.getByText("Overall status: at risk")).toBeInTheDocument();
    expect(screen.getAllByText("Implement project-tracking structured editing").length).toBeGreaterThan(0);
    await openSectionEditor(user);
    expect(screen.getByLabelText("Pending changed sections")).toHaveTextContent("project_tracking");
    expect(screen.getByLabelText("Pending changed sections")).toHaveTextContent("project_tracking.pending_work[PTW-001].title");

    await user.click(screen.getByRole("button", { name: "Export PRD" }));

    const blob = vi.mocked(URL.createObjectURL).mock.calls.at(-1)?.[0] as Blob;
    const exportedPrd = JSON.parse(await readBlobText(blob)) as typeof seedPrd;

    expect(exportedPrd.project_tracking.status).toBe("at_risk");
    expect(exportedPrd.project_tracking.pending_work[0].title).toBe("Implement project-tracking structured editing");
    expect(exportedPrd.project_tracking.pending_work[0].external_refs).toEqual([
      "https://github.com/example/project/issues/123"
    ]);
    expect(exportedPrd.project_tracking.issues_found.at(-1)?.title).toBe("Project tracking regression gap");
  }, 20_000);

  it("blocks invalid structured project-tracking edits without replacing the active document", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openSectionEditor(user);
    const sectionNav = screen.getByRole("navigation", { name: "PRD section navigation" });

    await user.click(within(sectionNav).getByRole("button", { name: /Project tracking/i }));
    await user.clear(screen.getByRole("textbox", { name: "PTB-001 Title" }));
    await user.click(screen.getByRole("button", { name: "Apply structured edits" }));

    expect(screen.getByText("Structured section change would make PRD invalid. No changes applied.")).toBeInTheDocument();
    expect(screen.getByLabelText("Pending changed sections")).toHaveTextContent("No pending section changes.");
    await openReviewDashboard(user);
    expect(screen.getAllByText("Viewer implementation needed structured project_tracking editing").length).toBeGreaterThan(0);
  });

  it("opens a writable local PRD and saves validated changes back to the handle", async () => {
    const user = userEvent.setup();
    const writeMock = vi.fn(async (_data: string) => {});
    const writableStream = {
      write: writeMock,
      close: vi.fn(async () => {}),
      abort: vi.fn(async () => {})
    };
    const fileHandle = {
      name: "writable-prd.json",
      getFile: vi.fn(async () => new File([JSON.stringify(seedPrd)], "writable-prd.json", { type: "application/json" })),
      createWritable: vi.fn(async () => writableStream)
    };

    Object.defineProperty(window, "showOpenFilePicker", {
      value: vi.fn(async () => [fileHandle]),
      configurable: true
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open writable" }));
    expect(await screen.findByText("Writable file handle ready. Valid changes can be saved back to this PRD.")).toBeInTheDocument();
    await openSectionEditor(user);

    const editedRequirements = structuredClone(seedPrd.requirements);
    editedRequirements.functional[0].title = "Open writable canonical PRD";

    fireEvent.change(screen.getByRole("textbox", { name: "Section JSON editor" }), {
      target: {
        value: JSON.stringify(editedRequirements, null, 2)
      }
    });
    await user.click(screen.getByRole("button", { name: "Apply section" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(writableStream.write).toHaveBeenCalledTimes(1));
    const savedPrd = JSON.parse(writeMock.mock.calls[0][0]) as typeof seedPrd;

    expect(savedPrd.requirements.functional[0].title).toBe("Open writable canonical PRD");
    expect(writableStream.close).toHaveBeenCalledTimes(1);
    expect((await screen.findAllByText("Validated PRD saved back to the writable file.")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("keeps pending changes local when writable save fails", async () => {
    const user = userEvent.setup();
    const writableStream = {
      write: vi.fn(async (_data: string) => {
        throw new Error("disk full");
      }),
      close: vi.fn(async () => {}),
      abort: vi.fn(async () => {})
    };
    const fileHandle = {
      name: "writable-prd.json",
      getFile: vi.fn(async () => new File([JSON.stringify(seedPrd)], "writable-prd.json", { type: "application/json" })),
      createWritable: vi.fn(async () => writableStream)
    };

    Object.defineProperty(window, "showOpenFilePicker", {
      value: vi.fn(async () => [fileHandle]),
      configurable: true
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open writable" }));
    expect(await screen.findByText("Writable file handle ready. Valid changes can be saved back to this PRD.")).toBeInTheDocument();
    await openSectionEditor(user);

    const editedRequirements = structuredClone(seedPrd.requirements);
    editedRequirements.functional[0].title = "Open writable canonical PRD after failed save";

    fireEvent.change(screen.getByRole("textbox", { name: "Section JSON editor" }), {
      target: {
        value: JSON.stringify(editedRequirements, null, 2)
      }
    });
    await user.click(screen.getByRole("button", { name: "Apply section" }));

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect((await screen.findAllByText("Save failed: disk full")).length).toBeGreaterThan(0);
    expect(writableStream.abort).toHaveBeenCalledTimes(1);
    expect(writableStream.close).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Pending changed sections")).toHaveTextContent("requirements");
    expect(screen.getByLabelText("Pending changed sections")).toHaveTextContent("1 changed");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Export diagnostics" }));

    const blob = vi.mocked(URL.createObjectURL).mock.calls.at(-1)?.[0] as Blob;
    const snapshot = JSON.parse(await readBlobText(blob)) as {
      events: Array<{ action: string; outcome: string; details: Record<string, unknown> }>;
    };

    expect(snapshot.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "save",
          outcome: "failure",
          details: expect.objectContaining({
            reason: "write_failed",
            error_type: "Error"
          })
        })
      ])
    );
    expect(JSON.stringify(snapshot)).not.toContain("Open writable canonical PRD after failed save");
  });

  it("switches the active PRD section from the rail", async () => {
    const user = userEvent.setup();
    render(<App />);
    const sectionNav = screen.getByRole("navigation", { name: "PRD section navigation" });

    await user.click(within(sectionNav).getByRole("button", { name: /Questions/i }));

    expect(screen.getByRole("heading", { name: "Questions" })).toBeInTheDocument();
    expect(screen.getByText(/Unresolved product, engineering, compliance/)).toBeInTheDocument();
    expect(screen.getAllByText("Q-001").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /target launch date and pilot cohort/i })).toBeInTheDocument();
  });

  it("switches to the project-tracking section from the rail", async () => {
    const user = userEvent.setup();
    render(<App />);
    const sectionNav = screen.getByRole("navigation", { name: "PRD section navigation" });

    await user.click(within(sectionNav).getByRole("button", { name: /Project tracking/i }));

    expect(screen.getAllByRole("heading", { name: "Project tracking" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Overall status: in progress")).toBeInTheDocument();
    expect(screen.getAllByText("PTW-001").length).toBeGreaterThan(0);
  });

  it("navigates from dashboard metric tiles to the relevant PRD section", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "View Open questions" }));

    const sectionNav = screen.getByRole("navigation", { name: "PRD section navigation" });

    expect(screen.getByRole("heading", { name: "Questions" })).toBeInTheDocument();
    expect(screen.getByText(/Unresolved product, engineering, compliance/)).toBeInTheDocument();
    expect(within(sectionNav).getByRole("button", { name: /Questions/i })).toHaveClass("is-active");
    await waitFor(() => expect(document.getElementById("selected-section-panel")).toHaveFocus());
  });

  it("navigates from readiness blocker signals to the relevant PRD section", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Q-001 is open/i }));

    const sectionNav = screen.getByRole("navigation", { name: "PRD section navigation" });

    expect(screen.getByRole("heading", { name: "Questions" })).toBeInTheDocument();
    expect(screen.getAllByText("Q-001").length).toBeGreaterThan(0);
    expect(within(sectionNav).getByRole("button", { name: /Questions/i })).toHaveClass("is-active");
  });

  it("reruns schema validation from the Validate action", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Validate" }));

    expect(screen.getByText("Loaded PRD matches schema.strict.json.")).toBeInTheDocument();
    expect(screen.getByLabelText("Local diagnostic events")).toHaveTextContent("validate");
    expect(screen.getByLabelText("Local diagnostic events")).toHaveTextContent("success");
  });

  it("records content-free diagnostic events for load, validate, edit, and export failures", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(screen.getByLabelText("Open PRD"), jsonFile("broken-prd.json", malformedPrdJsonFixture));
    await user.click(screen.getByRole("button", { name: "Validate" }));
    await openSectionEditor(user);
    fireEvent.change(screen.getByRole("textbox", { name: "Section JSON editor" }), {
      target: {
        value: "{}"
      }
    });
    await user.click(screen.getByRole("button", { name: "Apply section" }));
    await user.click(screen.getByRole("button", { name: "Export diagnostics" }));

    const blob = vi.mocked(URL.createObjectURL).mock.calls.at(-1)?.[0] as Blob;
    const snapshot = JSON.parse(await readBlobText(blob)) as {
      schema: string;
      events: Array<{ action: string; outcome: string; details: Record<string, unknown> }>;
      redaction: { content_fields_removed: boolean };
    };

    expect(snapshot.schema).toBe("prd.viewer.diagnostic-snapshot.v1");
    expect(snapshot.redaction.content_fields_removed).toBe(true);
    expect(snapshot.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "load", outcome: "failure" }),
        expect.objectContaining({ action: "validate", outcome: "success" }),
        expect.objectContaining({ action: "edit", outcome: "blocked" })
      ])
    );
    expect(JSON.stringify(snapshot)).not.toContain("PRD Reviewer Local/Web UI");
    expect(JSON.stringify(snapshot)).not.toContain("Open canonical PRD in browser");
  });

  it("opens a valid local PRD JSON file and updates the active source", async () => {
    const user = userEvent.setup();
    render(<App />);
    const uploadedPrd = validPrdFixture();
    uploadedPrd.meta.title = "Uploaded PRD";
    uploadedPrd.meta.summary = "Uploaded file summary.";
    const file = prdFile("uploaded-prd.json", uploadedPrd);

    await user.upload(screen.getByLabelText("Open PRD"), file);

    expect(await screen.findByRole("heading", { name: "Uploaded PRD" })).toBeInTheDocument();
    expect(screen.getAllByText("uploaded-prd.json").length).toBeGreaterThan(0);
    expect(screen.getByText("Loaded PRD matches schema.strict.json.")).toBeInTheDocument();
    expect(screen.getByText("Loaded PRD is compatible with the current schema manifest.")).toBeInTheDocument();
  });

  it("rejects schema-invalid local PRDs without replacing the last valid document", async () => {
    const user = userEvent.setup();
    render(<App />);
    const uploadedPrd = validPrdFixture();
    uploadedPrd.meta.title = "Last valid uploaded PRD";

    await user.upload(screen.getByLabelText("Open PRD"), prdFile("last-valid-prd.json", uploadedPrd));
    expect(await screen.findByRole("heading", { name: "Last valid uploaded PRD" })).toBeInTheDocument();

    await user.upload(screen.getByLabelText("Open PRD"), prdFile("schema-invalid-prd.json", schemaInvalidPrdFixture()));

    expect(screen.getByRole("heading", { name: "Last valid uploaded PRD" })).toBeInTheDocument();
    expect((await screen.findAllByText("schema-invalid-prd.json")).length).toBeGreaterThan(0);
    expect(await screen.findByText('$["meta"]["title"]')).toBeInTheDocument();
    await openSectionEditor(user);
    expect(screen.getByLabelText("Pending changed sections")).toHaveTextContent("No pending section changes.");
  });

  it("keeps unsupported schema version fixtures reviewable but warns on compatibility", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(screen.getByLabelText("Open PRD"), prdFile("unsupported-schema-prd.json", unsupportedSchemaVersionPrdFixture()));

    expect((await screen.findAllByText("Declared schema version 9.9.9 is not listed in schema.versions.json.")).length).toBeGreaterThan(0);
    expect(screen.getByText("Loaded PRD matches schema.strict.json.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export snapshot" })).toBeEnabled();
  });

  it("surfaces broken trace-link fixtures while keeping schema validation valid", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(screen.getByLabelText("Open PRD"), prdFile("broken-trace-prd.json", brokenTraceLinksPrdFixture()));

    expect((await screen.findAllByText("US-001 references missing requirement FR-999.")).length).toBeGreaterThan(0);
    expect(screen.getByText("Loaded PRD matches schema.strict.json.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /US-001 references missing requirement FR-999/i })).toBeInTheDocument();
  });

  it("blocks writable save for PRDs with required extensions", async () => {
    const user = userEvent.setup();
    const writeMock = vi.fn(async (_data: string) => {});
    const writableStream = {
      write: writeMock,
      close: vi.fn(async () => {}),
      abort: vi.fn(async () => {})
    };
    const fileHandle = {
      name: "required-extension-prd.json",
      getFile: vi.fn(async () => prdFile("required-extension-prd.json", requiredExtensionPrdFixture())),
      createWritable: vi.fn(async () => writableStream)
    };

    Object.defineProperty(window, "showOpenFilePicker", {
      value: vi.fn(async () => [fileHandle]),
      configurable: true
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open writable" }));
    expect(await screen.findByText("Writable file handle ready. Valid changes can be saved back to this PRD.")).toBeInTheDocument();
    expect(await screen.findByText("Required extension fixture.required must be supported before approval or writeback.")).toBeInTheDocument();
    await openSectionEditor(user);

    const editedRequirements = structuredClone(seedPrd.requirements);
    editedRequirements.functional[0].title = "Required extension save should stay blocked";

    fireEvent.change(screen.getByRole("textbox", { name: "Section JSON editor" }), {
      target: {
        value: JSON.stringify(editedRequirements, null, 2)
      }
    });
    await user.click(screen.getByRole("button", { name: "Apply section" }));

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("shows a parse error without replacing the active PRD when a local file is malformed", async () => {
    const user = userEvent.setup();
    render(<App />);
    const uploadedPrd = validPrdFixture();
    uploadedPrd.meta.title = "Last valid before malformed PRD";

    await user.upload(screen.getByLabelText("Open PRD"), prdFile("last-valid-before-malformed.json", uploadedPrd));
    expect(await screen.findByRole("heading", { name: "Last valid before malformed PRD" })).toBeInTheDocument();

    await user.upload(screen.getByLabelText("Open PRD"), jsonFile("broken-prd.json", malformedPrdJsonFixture));

    expect(screen.getByRole("heading", { name: "Last valid before malformed PRD" })).toBeInTheDocument();
    expect(screen.getAllByText("broken-prd.json").length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Unable to parse JSON/)).length).toBeGreaterThan(0);
  });
});

function prdFile(name: string, prd: ReturnType<typeof validPrdFixture>): File {
  return jsonFile(name, serializePrdFixture(prd));
}

function jsonFile(name: string, text: string): File {
  return new File([text], name, {
    type: "application/json"
  });
}

async function openSectionEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Edit section" }));
  expect(screen.getByRole("heading", { name: "Section editor" })).toBeInTheDocument();
}

async function openReviewDashboard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Review dashboard" }));
  expect(screen.queryByRole("heading", { name: "Section editor" })).not.toBeInTheDocument();
}

function getStructuredItem(text: string): HTMLElement {
  const item = screen
    .getAllByText(text)
    .map((element) => element.closest(".structured-item"))
    .find((element): element is HTMLElement => element instanceof HTMLElement);

  if (!item) {
    throw new Error(`Unable to find structured item for ${text}.`);
  }

  return item;
}

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Unable to read blob.")));
    reader.readAsText(blob);
  });
}
