"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PipelineGraph, type GraphNode, type NodeState } from "@/components/PipelineGraph";
import { CompetenciaEditor } from "@/components/CompetenciaEditor";
import { CardArt } from "@/components/CardArt";
import type { Competencia } from "@/core/competencia/types";

type RunEvent =
  | { type: "node"; nodeId: string; state: NodeState; detail?: string }
  | { type: "run"; state: NodeState }
  | { type: "done"; ok: boolean }
  | { type: "log"; message: string };

// Nodos estaticos para pintar el grafo antes/durante el run (evita importar el
// modulo de servidor req002.ts en el cliente).
const REQ002_STEPS: { id: string; label: string }[] = [
  { id: "input", label: "Entrada" },
  { id: "discover", label: "Descubrir competidores" },
  { id: "crawl", label: "Crawl competidores" },
  { id: "compare", label: "Comparativa IA" },
];

const initialNodes = (): GraphNode[] =>
  REQ002_STEPS.map((s) => ({ id: s.id, label: s.label, state: "pending" as NodeState }));

export function CompetenciaPanel({
  projectId,
  dossierReady,
}: {
  projectId: string;
  dossierReady: boolean;
}) {
  const [competencia, setCompetencia] = useState<Competencia | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string>("idle");
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/competencia/${projectId}`);
    if (!r.ok) return;
    const d = await r.json();
    setCompetencia(d.competencia);
    setStatus(d.status);
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
      // Conserva la reconexión nativa: el endpoint reenvía el estado persistido.
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [runId, load]);

  async function startRun(modo: "reemplazar" | "ampliar" = "reemplazar") {
    setStarting(true);
    setLogs([]);
    setNodes(initialNodes());
    setRunStatus("running");
    const r = await fetch(`/api/projects/${projectId}/competencia/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modo }),
    });
    if (r.ok) {
      const d = await r.json();
      setRunId(d.runId);
    } else {
      setRunStatus("error");
    }
    setStarting(false);
  }

  async function saveCompetencia(c: Competencia, approve: boolean) {
    setSaving(true);
    await fetch(`/api/competencia/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competencia: c, approve }),
    });
    if (approve) setStatus("approved");
    setCompetencia(c);
    setSaving(false);
  }

  const running = runStatus === "running" || runStatus === "pending";
  const showGraph = nodes.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex items-center justify-between overflow-hidden rounded-xl p-4">
        <CardArt name="bg-competencia.webp" fallback="linear-gradient(120deg, rgba(124,58,237,0.35), rgba(34,211,238,0.2))" />
        <h2 className="relative text-lg font-bold">Competencia</h2>
        {!competencia ? (
          <button
            onClick={() => startRun()}
            disabled={!dossierReady || running || starting}
            className="relative rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
            title={dossierReady ? undefined : "Genera primero el dossier."}
          >
            {running || starting ? "Analizando…" : "Analizar competencia"}
          </button>
        ) : (
          <button
            onClick={() => startRun("ampliar")}
            disabled={running || starting}
            className="relative rounded-lg border border-[var(--color-accent-2)]/50 bg-black/30 px-3 py-2 text-sm font-medium text-[var(--color-accent-2)] hover:bg-[var(--color-accent-2)]/10 disabled:opacity-40"
            title="Busca competidores NUEVOS y los añade a los actuales"
          >
            {running || starting ? "Buscando…" : "+ Buscar más"}
          </button>
        )}
      </div>

      {!dossierReady && (
        <div className="glass p-4 text-sm text-white/50">
          Genera el dossier para poder analizar la competencia.
        </div>
      )}

      {showGraph && (
        <div>
          <PipelineGraph nodes={nodes} />
        </div>
      )}

      {(running || logs.length > 0) && (
        <div className="glass max-h-48 overflow-auto p-4 font-mono text-xs text-white/60">
          {logs.length === 0 && <div className="text-white/30">Esperando eventos…</div>}
          {logs.map((l, i) => (
            <div key={i}>› {l}</div>
          ))}
        </div>
      )}

      {runStatus === "error" && !competencia && (
        <div className="glass border border-[var(--color-state-error)]/40 p-4 text-sm text-[var(--color-state-error)]">
          El análisis de competencia falló. Revisa el nodo en error y pulsa «Analizar competencia» de nuevo.
          <div className="mt-3">
            <button
              onClick={() => startRun()}
              disabled={starting}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-40"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {competencia && (
        <CompetenciaEditor
          initial={competencia}
          status={status}
          onSave={saveCompetencia}
          onRegenerate={() => startRun("reemplazar")}
          saving={saving}
          regenerating={running || starting}
        />
      )}
    </div>
  );
}
