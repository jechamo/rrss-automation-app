"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PipelineGraph, type GraphNode, type NodeState } from "@/components/PipelineGraph";
import { ViralesEditor } from "@/components/ViralesEditor";
import type { Virales } from "@/core/virales/types";

type RunEvent =
  | { type: "node"; nodeId: string; state: NodeState; detail?: string }
  | { type: "run"; state: NodeState }
  | { type: "done"; ok: boolean }
  | { type: "log"; message: string };

// Nodos estaticos para pintar el grafo antes/durante el run (evita importar el
// modulo de servidor req004.ts en el cliente).
const REQ004_STEPS: { id: string; label: string }[] = [
  { id: "input", label: "Entrada" },
  { id: "discover", label: "Buscar virales (web)" },
  { id: "rank", label: "Ranking Top 20" },
  { id: "analyze", label: "Análisis de patrones" },
];

const VENTANAS: { dias: number; label: string }[] = [
  { dias: 7, label: "7 días" },
  { dias: 14, label: "14 días" },
  { dias: 30, label: "30 días" },
  { dias: 0, label: "Histórico" },
];

const initialNodes = (): GraphNode[] =>
  REQ004_STEPS.map((s) => ({ id: s.id, label: s.label, state: "pending" as NodeState }));

export function ViralesPanel({
  projectId,
  dossierReady,
}: {
  projectId: string;
  dossierReady: boolean;
}) {
  const [virales, setVirales] = useState<Virales | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string>("idle");
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ventanaDias, setVentanaDias] = useState(30);
  const esRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/virales/${projectId}`);
    if (!r.ok) return;
    const d = await r.json();
    setVirales(d.virales);
    setStatus(d.status);
    if (d.virales?.criterio?.ventanaDias != null) setVentanaDias(d.virales.criterio.ventanaDias);
    if (d.lastRun) {
      setNodes(JSON.parse(d.lastRun.nodes) as GraphNode[]);
      setRunStatus(d.lastRun.status);
      if (d.lastRun.status === "running" || d.lastRun.status === "pending") {
        setRunId(d.lastRun.id);
      }
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Suscripcion SSE al run activo.
  useEffect(() => {
    if (!runId) return;
    setLogs([]);
    const es = new EventSource(`/api/runs/${runId}/stream`);
    esRef.current = es;
    es.onmessage = (ev) => {
      const e: RunEvent = JSON.parse(ev.data);
      if (e.type === "node") {
        setNodes((prev) => prev.map((n) => (n.id === e.nodeId ? { ...n, state: e.state, detail: e.detail } : n)));
      } else if (e.type === "run") {
        setRunStatus(e.state);
      } else if (e.type === "log") {
        setLogs((prev) => [...prev, e.message]);
      } else if (e.type === "done") {
        setRunStatus(e.ok ? "ok" : "error");
        es.close();
        esRef.current = null;
        setRunId(null);
        if (e.ok) load();
      }
    };
    es.onerror = () => {
      es.close();
      esRef.current = null;
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [runId, load]);

  async function startRun() {
    setStarting(true);
    setLogs([]);
    setNodes(initialNodes());
    setRunStatus("running");
    const r = await fetch(`/api/projects/${projectId}/virales/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ventanaDias }),
    });
    if (r.ok) {
      const d = await r.json();
      setRunId(d.runId);
    } else {
      setRunStatus("error");
    }
    setStarting(false);
  }

  async function saveVirales(v: Virales, approve: boolean) {
    setSaving(true);
    await fetch(`/api/virales/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ virales: v, approve }),
    });
    if (approve) setStatus("approved");
    setVirales(v);
    setSaving(false);
  }

  const running = runStatus === "running" || runStatus === "pending";
  const showGraph = nodes.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Virales del nicho (REQ-004)</h2>
        {!virales && (
          <div className="flex items-center gap-2">
            <select
              className="input w-32"
              value={ventanaDias}
              onChange={(e) => setVentanaDias(parseInt(e.target.value, 10))}
              disabled={!dossierReady || running || starting}
            >
              {VENTANAS.map((v) => (
                <option key={v.dias} value={v.dias}>
                  {v.label}
                </option>
              ))}
            </select>
            <button
              onClick={startRun}
              disabled={!dossierReady || running || starting}
              className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
              title={dossierReady ? undefined : "Genera primero el dossier (REQ-001)."}
            >
              {running || starting ? "Buscando…" : "Buscar virales"}
            </button>
          </div>
        )}
      </div>

      {!dossierReady && (
        <div className="glass p-4 text-sm text-white/50">
          Genera el dossier (REQ-001) para poder buscar virales del nicho.
        </div>
      )}

      {showGraph && (
        <div>
          <PipelineGraph nodes={nodes} />
        </div>
      )}

      {(running || logs.length > 0) && (
        <div className="glass max-h-48 overflow-auto p-4 font-mono text-xs text-white/60">
          {logs.length === 0 && <div className="text-white/30">Esperando eventos… (la búsqueda web puede tardar)</div>}
          {logs.map((l, i) => (
            <div key={i}>› {l}</div>
          ))}
        </div>
      )}

      {runStatus === "error" && !virales && (
        <div className="glass border border-[var(--color-state-error)]/40 p-4 text-sm text-[var(--color-state-error)]">
          La búsqueda de virales falló. Revisa el nodo en error y pulsa «Buscar virales» de nuevo.
          <div className="mt-3">
            <button
              onClick={startRun}
              disabled={starting}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-40"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {virales && (
        <ViralesEditor
          initial={virales}
          status={status}
          onSave={saveVirales}
          onRegenerate={startRun}
          saving={saving}
          regenerating={running || starting}
        />
      )}
    </div>
  );
}
