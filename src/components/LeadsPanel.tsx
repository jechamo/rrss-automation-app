"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PipelineGraph, type GraphNode, type NodeState } from "@/components/PipelineGraph";
import { LeadsEditor } from "@/components/LeadsEditor";
import { CardArt } from "@/components/CardArt";
import type { Leads } from "@/core/leads/types";

type RunEvent =
  | { type: "node"; nodeId: string; state: NodeState; detail?: string }
  | { type: "run"; state: NodeState }
  | { type: "done"; ok: boolean }
  | { type: "log"; message: string };

// Nodos estaticos para pintar el grafo antes/durante el run (evita importar el
// modulo de servidor req003.ts en el cliente).
const REQ003_STEPS: { id: string; label: string }[] = [
  { id: "input", label: "Entrada" },
  { id: "research", label: "Perfil de cliente" },
  { id: "discover", label: "Buscar negocios (web)" },
  { id: "strategy", label: "Estrategia IA" },
];

const initialNodes = (): GraphNode[] =>
  REQ003_STEPS.map((s) => ({ id: s.id, label: s.label, state: "pending" as NodeState }));

export function LeadsPanel({
  projectId,
  dossierReady,
}: {
  projectId: string;
  dossierReady: boolean;
}) {
  const [leads, setLeads] = useState<Leads | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string>("idle");
  const [saving, setSaving] = useState(false);
  const [recalibrating, setRecalibrating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [zona, setZona] = useState("");
  const esRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/leads/${projectId}`);
    if (!r.ok) return;
    const d = await r.json();
    setLeads(d.leads);
    setStatus(d.status);
    if (d.leads?.zona) setZona(d.leads.zona);
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
    const r = await fetch(`/api/projects/${projectId}/leads/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zona, modo }),
    });
    if (r.ok) {
      const d = await r.json();
      setRunId(d.runId);
    } else {
      setRunStatus("error");
    }
    setStarting(false);
  }

  async function saveLeads(l: Leads, approve: boolean) {
    setSaving(true);
    await fetch(`/api/leads/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leads: l, approve }),
    });
    if (approve) setStatus("approved");
    setLeads(l);
    setSaving(false);
  }

  async function recalibrate() {
    setRecalibrating(true);
    try {
      const response = await fetch(`/api/leads/${projectId}/recalibrate`, { method: "POST" });
      const data = (await response.json()) as { leads?: Leads; status?: string };
      if (response.ok && data.leads) {
        setLeads(data.leads);
        setStatus(data.status ?? "draft");
      }
    } finally {
      setRecalibrating(false);
    }
  }

  const running = runStatus === "running" || runStatus === "pending";
  const showGraph = nodes.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-xl p-4">
        <CardArt name="bg-leads.webp" fallback="linear-gradient(120deg, rgba(34,211,238,0.28), rgba(124,58,237,0.22))" />
        <h2 className="relative text-lg font-bold">Clientes potenciales</h2>
        {!leads ? (
          <div className="relative flex items-center gap-2">
            <input
              className="input w-48"
              placeholder="Zona (opcional)"
              value={zona}
              onChange={(e) => setZona(e.target.value)}
              disabled={!dossierReady || running || starting}
            />
            <button
              onClick={() => startRun()}
              disabled={!dossierReady || running || starting}
              className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
              title={dossierReady ? undefined : "Genera primero el dossier."}
            >
              {running || starting ? "Buscando…" : "Buscar clientes potenciales"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => startRun("ampliar")}
            disabled={running || starting}
            className="relative rounded-lg border border-[var(--color-accent-2)]/50 bg-black/30 px-3 py-2 text-sm font-medium text-[var(--color-accent-2)] hover:bg-[var(--color-accent-2)]/10 disabled:opacity-40"
            title="Busca clientes NUEVOS y los añade a los actuales"
          >
            {running || starting ? "Buscando…" : "+ Buscar más"}
          </button>
        )}
      </div>

      {!dossierReady && (
        <div className="glass p-4 text-sm text-white/50">
          Genera el dossier para poder buscar clientes potenciales.
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

      {runStatus === "error" && !leads && (
        <div className="glass border border-[var(--color-state-error)]/40 p-4 text-sm text-[var(--color-state-error)]">
          La búsqueda de clientes potenciales falló. Revisa el nodo en error y pulsa «Buscar» de nuevo.
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

      {leads && (
        <LeadsEditor
          initial={leads}
          status={status}
          onSave={saveLeads}
          onRegenerate={() => startRun("reemplazar")}
          onRecalibrate={recalibrate}
          saving={saving}
          regenerating={running || starting}
          recalibrating={recalibrating}
        />
      )}
    </div>
  );
}
