"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export type NodeState = "pending" | "running" | "ok" | "error";

export type GraphNode = {
  id: string;
  label: string;
  state: NodeState;
  detail?: string;
};

const STATE_STYLE: Record<NodeState, { dot: string; ring: string; text: string }> = {
  pending: { dot: "var(--color-state-pending)", ring: "rgba(255,255,255,0.10)", text: "Pendiente" },
  running: { dot: "var(--color-state-running)", ring: "var(--color-state-running)", text: "En curso…" },
  ok: { dot: "var(--color-state-ok)", ring: "var(--color-state-ok)", text: "Completado" },
  error: { dot: "var(--color-state-error)", ring: "var(--color-state-error)", text: "Error" },
};

const NODE_ICONS: Record<string, string> = {
  input: "/img/nodes/input.png",
  crawl: "/img/nodes/crawl.png",
  repo: "/img/nodes/repo.png",
  dossier: "/img/nodes/dossier.png",
  discover: "/img/nodes/discover.png",
  compare: "/img/nodes/compare.png",
  research: "/img/nodes/research.png",
  strategy: "/img/nodes/strategy.png",
  rank: "/img/nodes/rank.png",
  analyze: "/img/nodes/analyze.png",
  extract: "/img/nodes/extract.png",
  guion: "/img/nodes/guion.png",
  media: "/img/nodes/media.png",
  voz: "/img/nodes/voz.png",
  montaje: "/img/nodes/montaje.png",
  grabacion: "/img/nodes/grabacion.png",
};

type StepData = { iconId: string; label: string; state: NodeState; detail?: string };

function StepNode({ data }: NodeProps) {
  const d = data as StepData;
  const s = STATE_STYLE[d.state];
  const [iconBroken, setIconBroken] = useState(false);
  const icon = NODE_ICONS[d.iconId];
  return (
    <div
      className="glass-strong px-3 py-3"
      style={{
        minWidth: 200,
        border: `1px solid ${s.ring}`,
        boxShadow: d.state === "running" ? `0 0 18px ${s.ring}` : undefined,
        transition: "border-color 0.35s ease, box-shadow 0.35s ease",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="flex items-center gap-3">
        <div
          className={[
            "node-icon-shell",
            d.state === "running" ? "node-spinner" : "",
          ].join(" ")}
          style={{ "--node-state-color": s.dot } as CSSProperties}
        >
          <div className="node-icon-inner">
            {icon && !iconBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={icon}
                alt=""
                aria-hidden
                className="h-full w-full object-cover"
                onError={() => setIconBroken(true)}
              />
            ) : (
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{
                  background: s.dot,
                  animation: d.state === "running" ? "pulse 1.2s ease-in-out infinite" : undefined,
                }}
              />
            )}
          </div>
          {(d.state === "ok" || d.state === "error") && (
            <span
              className="absolute -bottom-1 -right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#12121a] text-[10px] font-bold text-black"
              style={{ background: s.dot }}
              aria-hidden
            >
              {d.state === "ok" ? "✓" : "×"}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{d.label}</div>
          <div className="mt-0.5 text-xs" style={{ color: s.dot }}>
            {s.text}
          </div>
        </div>
      </div>
      {d.detail && d.state === "error" && (
        <div className="mt-1 max-w-[200px] text-[11px] text-white/50">{d.detail}</div>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { step: StepNode };

export function PipelineGraph({ nodes }: { nodes: GraphNode[] }) {
  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((n, i) => ({
        id: n.id,
        type: "step",
        position: { x: i * 230, y: 0 },
        data: { iconId: n.id, label: n.label, state: n.state, detail: n.detail },
        draggable: false,
        connectable: false,
      })),
    [nodes],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      nodes.slice(1).map((n, i) => ({
        id: `${nodes[i].id}-${n.id}`,
        source: nodes[i].id,
        target: n.id,
        animated: nodes[i].state === "ok" && n.state === "running",
        style: { stroke: "var(--color-accent-2)", opacity: 0.5 },
      })),
    [nodes],
  );

  return (
    <div className="glass" style={{ height: 180 }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
      >
        <Background gap={20} color="rgba(255,255,255,0.05)" />
      </ReactFlow>
    </div>
  );
}
