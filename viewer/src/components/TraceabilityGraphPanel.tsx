import { type ReactNode, useMemo } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge as FlowEdge,
  type Node as FlowNode
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FocusedTraceGraph, Traceability, TraceNode, TraceNodeKind } from "../lib/traceability";
import { StatusPill } from "./StatusPill";

type TraceabilityGraphPanelProps = {
  traceability: Traceability;
  graph: FocusedTraceGraph;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  onExportTrace: () => void;
};

type TraceFlowData = {
  label: ReactNode;
};

const kindOrder: TraceNodeKind[] = [
  "requirement",
  "story",
  "decision",
  "dependency",
  "persona",
  "constraint",
  "risk",
  "question",
  "missing"
];

export function TraceabilityGraphPanel({
  traceability,
  graph,
  selectedNodeId,
  onSelectNode,
  onExportTrace
}: TraceabilityGraphPanelProps) {
  const options = useMemo(
    () =>
      [...traceability.nodes].sort((left, right) => {
        const kindDelta = kindOrder.indexOf(left.kind) - kindOrder.indexOf(right.kind);

        return kindDelta || left.id.localeCompare(right.id, undefined, { numeric: true });
      }),
    [traceability.nodes]
  );
  const flowNodes = useMemo(() => layoutNodes(graph), [graph]);
  const flowEdges = useMemo(() => layoutEdges(graph), [graph]);
  const selectedLabel = graph.selectedNode?.label ?? "Missing reference";

  return (
    <div className="review-panel traceability-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Selected-node view</span>
          <h3>Traceability graph</h3>
        </div>
        <StatusPill tone={graph.issues.length > 0 ? "danger" : "success"}>
          {graph.issues.length > 0 ? "Broken refs" : "Resolved"}
        </StatusPill>
      </div>

      <label className="trace-node-select">
        <span>Focused node</span>
        <span className="trace-node-select-row">
          <select
            aria-label="Focused node"
            value={selectedNodeId}
            onChange={(event) => onSelectNode(event.target.value)}
          >
            {options.map((node) => (
              <option key={node.id} value={node.id}>
                {node.id} / {node.kind}
              </option>
            ))}
          </select>
          <button type="button" onClick={onExportTrace}>
            Export trace
          </button>
        </span>
      </label>

      <div className="trace-graph-layout">
        <div className="trace-flow-canvas" role="group" aria-label="Traceability relationship graph" aria-describedby="trace-graph-help">
          <p className="sr-only" id="trace-graph-help">
            Use the Focused node selector to inspect traceability graph relationships with the keyboard.
          </p>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            fitView
            minZoom={0.45}
            maxZoom={1.3}
            nodesDraggable={false}
            nodesConnectable={false}
            onNodeClick={(_, node) => onSelectNode(node.id)}
          >
            <Background color="#d9cfbb" gap={24} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <aside className="trace-graph-details" aria-label="Focused trace details">
          <strong>Focused node: {selectedNodeId}</strong>
          <span>{graph.selectedNode?.kind ?? "missing"} / {selectedLabel}</span>
          <dl>
            <div>
              <dt>Inbound links</dt>
              <dd>{graph.inboundEdges.length}</dd>
            </div>
            <div>
              <dt>Outbound links</dt>
              <dd>{graph.outboundEdges.length}</dd>
            </div>
          </dl>
          <TraceEdgeList title="Inbound" ids={graph.inboundEdges.map((edge) => edge.source)} empty="No inbound links" />
          <TraceEdgeList title="Outbound" ids={graph.outboundEdges.map((edge) => edge.target)} empty="No outbound links" />
          {graph.issues.length > 0 ? (
            <ul className="issue-list" aria-label="Focused trace issues">
              {graph.issues.map((issue) => (
                <li key={issue.id}>
                  <strong>{issue.target}</strong>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function TraceEdgeList({ title, ids, empty }: { title: string; ids: string[]; empty: string }) {
  return (
    <div className="trace-graph-links">
      <h4>{title}</h4>
      <div>
        {ids.length > 0 ? ids.map((id) => <b key={id}>{id}</b>) : <em>{empty}</em>}
      </div>
    </div>
  );
}

function layoutNodes(graph: FocusedTraceGraph): Array<FlowNode<TraceFlowData>> {
  const inboundIds = graph.inboundEdges.map((edge) => edge.source);
  const outboundIds = graph.outboundEdges.map((edge) => edge.target);
  const centerY = Math.max(inboundIds.length, outboundIds.length, 1) * 44;
  const overflowIds = graph.nodes
    .map((node) => node.id)
    .filter((id) => id !== graph.selectedNode?.id && !inboundIds.includes(id) && !outboundIds.includes(id));

  return graph.nodes.map((node) => {
    const inboundIndex = inboundIds.indexOf(node.id);
    const outboundIndex = outboundIds.indexOf(node.id);
    const overflowIndex = overflowIds.indexOf(node.id);
    const isSelected = node.id === graph.selectedNode?.id;

    return {
      id: node.id,
      type: "default",
      position: isSelected
        ? { x: 360, y: centerY }
        : inboundIndex >= 0
          ? { x: 16, y: inboundIndex * 88 }
          : outboundIndex >= 0
            ? { x: 704, y: outboundIndex * 88 }
            : { x: 360, y: centerY + 120 + overflowIndex * 78 },
      className: `trace-flow-node trace-flow-node--${node.kind}${isSelected ? " trace-flow-node--selected" : ""}`,
      data: {
        label: <TraceNodeLabel node={node} />
      }
    };
  });
}

function layoutEdges(graph: FocusedTraceGraph): FlowEdge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: !edge.valid,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: edge.valid ? "#8b6a28" : "#b95b4a"
    },
    style: {
      stroke: edge.valid ? "#8b6a28" : "#b95b4a",
      strokeWidth: edge.valid ? 1.6 : 2.2
    }
  }));
}

function TraceNodeLabel({ node }: { node: TraceNode }) {
  return (
    <span className="trace-flow-label">
      <strong>{node.id}</strong>
      <em>{node.kind}</em>
    </span>
  );
}
