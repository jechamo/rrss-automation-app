"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { PipelineGraph, type GraphNode, type NodeState } from "@/components/PipelineGraph";
import { DossierEditor, type Dossier } from "@/components/DossierEditor";
import { CompetenciaPanel } from "@/components/CompetenciaPanel";
import { LeadsPanel } from "@/components/LeadsPanel";
import { ViralesPanel } from "@/components/ViralesPanel";
import { ContentTray } from "@/components/ContentTray";

type RunEvent =
  | { type: "node"; nodeId: string; state: NodeState; detail?: string }
  | { type: "run"; state: NodeState }
  | { type: "done"; ok: boolean }
  | { type: "log"; message: string };

type ProjectResp = {
  project: {
    id: string;
    name: string;
    url: string;
    codeType: string | null;
    codePath: string | null;
  };
  lastRun: { id: string; status: string; nodes: string } | null;
};

export default function ProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectResp["project"] | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string>("pending");
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [dossierStatus, setDossierStatus] = useState<string>("draft");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const loadDossier = useCallback(async () => {
    const r = await fetch(`/api/dossier/${id}`);
    if (r.ok) {
      const d = await r.json();
      setDossier(d.dossier);
      setDossierStatus(d.status);
    }
  }, [id]);

  // Carga inicial del proyecto + ultimo run.
  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/projects/${id}`);
      if (!r.ok) return;
      const d: ProjectResp = await r.json();
      setProject(d.project);
      if (d.lastRun) {
        setNodes(JSON.parse(d.lastRun.nodes) as GraphNode[]);
        setRunStatus(d.lastRun.status);
        if (d.lastRun.status === "ok") {
          loadDossier();
        } else if (d.lastRun.status !== "error") {
          setRunId(d.lastRun.id);
        }
      }
    })();
  }, [id, loadDossier]);

  // Suscripcion SSE al run activo.
  useEffect(() => {
    if (!runId) return;
    setLogs([]);
    const es = new EventSource(`/api/runs/${runId}/stream`);
    esRef.current = es;
    es.onmessage = (ev) => {
      const e: RunEvent = JSON.parse(ev.data);
      if (e.type === "node") {
        setNodes((prev) =>
          prev.map((n) => (n.id === e.nodeId ? { ...n, state: e.state, detail: e.detail } : n)),
        );
      } else if (e.type === "run") {
        setRunStatus(e.state);
      } else if (e.type === "log") {
        setLogs((prev) => [...prev, e.message]);
      } else if (e.type === "done") {
        setRunStatus(e.ok ? "ok" : "error");
        es.close();
        esRef.current = null;
        setRunId(null);
        if (e.ok) loadDossier();
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
  }, [runId, loadDossier]);

  async function saveDossier(d: Dossier, approve: boolean) {
    setSaving(true);
    await fetch(`/api/dossier/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dossier: d, approve }),
    });
    if (approve) setDossierStatus("approved");
    setSaving(false);
  }

  async function removeProject() {
    if (!confirm("¿Eliminar este analisis y su dossier? Esta accion no se puede deshacer.")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    window.location.href = "/";
  }

  async function regenerate() {
    setRegenerating(true);
    setDossier(null);
    const r = await fetch(`/api/projects/${id}/rerun`, { method: "POST" });
    const d = await r.json();
    setNodes((prev) => prev.map((n) => ({ ...n, state: "pending" as NodeState, detail: undefined })));
    setRunStatus("running");
    setRunId(d.runId);
    setRegenerating(false);
  }

  if (!project) return <div className="text-white/50">Cargando…</div>;

  const running = runStatus === "running" || runStatus === "pending";

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <a
            href={project.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[var(--color-accent-2)] hover:underline"
          >
            {project.url} ↗
          </a>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <StatusBadge status={runStatus} />
          <button
            onClick={removeProject}
            className="rounded-lg border border-[var(--color-state-error)]/40 px-3 py-1.5 text-xs text-[var(--color-state-error)] hover:bg-[var(--color-state-error)]/10"
          >
            Eliminar
          </button>
        </div>
      </header>

      <section id="pipeline" className="mb-6 scroll-mt-6">
        <h2 className="mb-2 text-sm font-semibold text-white/60">Pipeline REQ-001</h2>
        <PipelineGraph nodes={nodes} />
      </section>

      {(running || logs.length > 0) && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-white/60">Registro</h2>
          <div className="glass max-h-48 overflow-auto p-4 font-mono text-xs text-white/60">
            {logs.length === 0 && <div className="text-white/30">Esperando eventos…</div>}
            {logs.map((l, i) => (
              <div key={i}>› {l}</div>
            ))}
          </div>
        </section>
      )}

      {runStatus === "error" && (
        <div className="glass mb-6 border border-[var(--color-state-error)]/40 p-4 text-sm text-[var(--color-state-error)]">
          El analisis fallo. Revisa el nodo en error (motor de IA en Ajustes o acceso a la web/codigo)
          y pulsa «Regenerar con IA».
          <div className="mt-3">
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-40"
            >
              {regenerating ? "Regenerando…" : "Regenerar con IA"}
            </button>
          </div>
        </div>
      )}

      {dossier && (
        <section id="dossier" className="scroll-mt-6">
          <DossierEditor
            initial={dossier}
            status={dossierStatus}
            onSave={saveDossier}
            onRegenerate={regenerate}
            saving={saving}
            regenerating={regenerating}
          />
        </section>
      )}

      {dossier && (
        <section id="competencia" className="mt-8 scroll-mt-6 border-t border-white/10 pt-8">
          <CompetenciaPanel projectId={id} dossierReady={!!dossier} />
        </section>
      )}

      {dossier && (
        <section id="leads" className="mt-8 scroll-mt-6 border-t border-white/10 pt-8">
          <LeadsPanel projectId={id} dossierReady={!!dossier} />
        </section>
      )}

      {dossier && (
        <section id="virales" className="mt-8 scroll-mt-6 border-t border-white/10 pt-8">
          <ViralesPanel projectId={id} dossierReady={!!dossier} />
        </section>
      )}

      {dossier && (
        <section id="contenido" className="mt-8 scroll-mt-6 border-t border-white/10 pt-8">
          <ContentTray projectId={id} ready={!!dossier} />
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; color: string }> = {
    pending: { text: "En cola", color: "var(--color-state-pending)" },
    running: { text: "Analizando…", color: "var(--color-state-running)" },
    ok: { text: "Completado", color: "var(--color-state-ok)" },
    error: { text: "Error", color: "var(--color-state-error)" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      className="shrink-0 rounded-full px-3 py-1 text-xs font-medium"
      style={{ background: `${s.color}22`, color: s.color }}
    >
      {s.text}
    </span>
  );
}
