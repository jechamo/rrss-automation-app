"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { PipelineGraph, type GraphNode, type NodeState } from "@/components/PipelineGraph";
import { DossierEditor, type Dossier } from "@/components/DossierEditor";
import { CompetenciaPanel } from "@/components/CompetenciaPanel";
import { LeadsPanel } from "@/components/LeadsPanel";
import { ViralesPanel } from "@/components/ViralesPanel";
import { ContentTray } from "@/components/ContentTray";
import { EntityLogo } from "@/components/EntityLogo";
import { ProjectLoading } from "@/components/ProjectLoading";
import { NavigationMapPanel } from "@/components/NavigationMapPanel";

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
    context: string | null;
    logoPath: string | null;
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
  const [logoRevision, setLogoRevision] = useState(0);
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

  if (!project) return <ProjectLoading />;

  const running = runStatus === "running" || runStatus === "pending";

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <EntityLogo
            name={project.name}
            web={project.url}
            src={
              project.logoPath
                ? `/api/projects/${id}/logo?v=${logoRevision}`
                : undefined
            }
            size={52}
          />
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
        <h2 className="mb-2 text-sm font-semibold text-white/60">Pipeline de análisis</h2>
        <PipelineGraph nodes={nodes} />
      </section>

      <section id="mapa" className="mb-6 scroll-mt-6">
        <NavigationMapPanel projectId={id} runStatus={runStatus} />
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-[240px_1fr]">
        <ProjectLogoEditor
          projectId={id}
          projectName={project.name}
          projectUrl={project.url}
          logoPath={project.logoPath}
          revision={logoRevision}
          onChanged={(logoPath) => {
            setProject((current) => (current ? { ...current, logoPath } : current));
            setLogoRevision(Date.now());
          }}
        />
        <SourceEditor
          projectId={id}
          initialType={project.codeType ?? "none"}
          initialPath={project.codePath ?? ""}
          onSaved={(codeType, codePath) =>
            setProject((p) => (p ? { ...p, codeType, codePath } : p))
          }
        />
        <div className="md:col-span-2">
          <ContextEditor
            projectId={id}
            initialContext={project.context ?? ""}
            onSaved={(context) =>
              setProject((current) => (current ? { ...current, context } : current))
            }
          />
        </div>
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
          <ContentTray projectId={id} projectUrl={project?.url ?? ""} ready={!!dossier} />
        </section>
      )}
    </div>
  );
}

function ProjectLogoEditor({
  projectId,
  projectName,
  projectUrl,
  logoPath,
  revision,
  onChanged,
}: {
  projectId: string;
  projectName: string;
  projectUrl: string;
  logoPath: string | null;
  revision: number;
  onChanged: (logoPath: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("file", file);
    const response = await fetch(`/api/projects/${projectId}/logo`, {
      method: "POST",
      body: form,
    });
    const data = (await response.json().catch(() => ({}))) as {
      logoPath?: string;
      error?: string;
    };
    setBusy(false);
    if (!response.ok || !data.logoPath) {
      setError(data.error ?? `HTTP ${response.status}`);
      return;
    }
    onChanged(data.logoPath);
  }

  async function remove() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/projects/${projectId}/logo`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? `HTTP ${response.status}`);
      return;
    }
    onChanged(null);
  }

  return (
    <div className="glass flex flex-col items-center p-4 text-center">
      <h2 className="mb-3 self-start text-sm font-semibold text-white/60">Logo del proyecto</h2>
      <EntityLogo
        name={projectName}
        web={projectUrl}
        src={logoPath ? `/api/projects/${projectId}/logo?v=${revision}` : undefined}
        size={72}
      />
      <p className="mt-2 text-[10px] text-white/40">
        PNG, JPG o WebP · máximo 2 MB
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <label className="cursor-pointer rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium">
          {busy ? "Guardando…" : logoPath ? "Reemplazar" : "Subir logo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            disabled={busy}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
        </label>
        {logoPath && (
          <button
            onClick={remove}
            disabled={busy}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-40"
          >
            Quitar
          </button>
        )}
      </div>
      {error && <div className="mt-2 text-xs text-[var(--color-state-error)]">{error}</div>}
    </div>
  );
}

const CODE_TYPES: { id: string; label: string }[] = [
  { id: "local", label: "Ruta local" },
  { id: "github_public", label: "GitHub público" },
  { id: "github_private", label: "GitHub privado" },
  { id: "none", label: "Sin código" },
];

// Editar la fuente de código de un proyecto ya creado (REQ-006 A4). La ruta se
// fijaba solo al crearlo; aquí se puede ver/corregir sin recrear el proyecto.
function SourceEditor({
  projectId,
  initialType,
  initialPath,
  onSaved,
}: {
  projectId: string;
  initialType: string;
  initialPath: string;
  onSaved: (codeType: string, codePath: string | null) => void;
}) {
  const [codeType, setCodeType] = useState(initialType);
  const [codePath, setCodePath] = useState(initialPath);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const needsPath = codeType === "local" || codeType.startsWith("github");
  const placeholder =
    codeType === "local" ? "C:\\ruta\\a\\tu\\proyecto" : "https://github.com/usuario/repo";
  const dirty = codeType !== initialType || codePath !== initialPath;

  async function save() {
    setSaving(true);
    setErr("");
    setSaved(false);
    const r = await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codeType, codePath: needsPath ? codePath : undefined }),
    });
    setSaving(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error ?? `HTTP ${r.status}`);
      return;
    }
    setSaved(true);
    onSaved(codeType, needsPath ? codePath : null);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="glass p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white/60">Fuente de código</h2>
        {saved && <span className="text-xs text-[var(--color-state-ok)]">Guardado ✓</span>}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {CODE_TYPES.map((o) => (
          <button
            key={o.id}
            onClick={() => setCodeType(o.id)}
            className={[
              "rounded-lg border px-3 py-1.5 text-xs",
              codeType === o.id
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15"
                : "border-white/15 hover:bg-white/5",
            ].join(" ")}
          >
            {o.label}
          </button>
        ))}
      </div>
      {needsPath && (
        <input
          className="input"
          placeholder={placeholder}
          value={codePath}
          onChange={(e) => setCodePath(e.target.value)}
        />
      )}
      <p className="mt-2 text-[11px] text-white/40">
        Aquí va la <b>ruta del repo del PC</b> (tipo «Ruta local»). Afecta a las próximas
        ejecuciones; vuelve a generar el dossier para reanalizar con la nueva ruta.
      </p>
      {err && <div className="mt-2 text-xs text-[var(--color-state-error)]">{err}</div>}
      <div className="mt-3">
        <button
          onClick={save}
          disabled={saving || !dirty || (needsPath && !codePath.trim())}
          className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Guardar fuente"}
        </button>
      </div>
    </div>
  );
}

function ContextEditor({
  projectId,
  initialContext,
  onSaved,
}: {
  projectId: string;
  initialContext: string;
  onSaved: (context: string | null) => void;
}) {
  const [context, setContext] = useState(initialContext);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const dirty = context !== initialContext;

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context }),
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? `HTTP ${response.status}`);
      return;
    }
    const normalized = context.trim();
    onSaved(normalized || null);
    setContext(normalized);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="glass p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white/60">Contexto para el análisis</h2>
        {saved && <span className="text-xs text-[var(--color-state-ok)]">Guardado ✓</span>}
      </div>
      <textarea
        className="input min-h-24 resize-y"
        value={context}
        maxLength={8000}
        onChange={(event) => setContext(event.target.value)}
        placeholder="Funcionalidades importantes, zonas privadas o aclaraciones que la IA debe priorizar…"
      />
      <div className="mt-1 flex items-start justify-between gap-4 text-[11px] text-white/40">
        <p>
          Se usa en próximas regeneraciones para priorizar web y código. Se trata como información
          aportada por ti y se contrasta con las evidencias disponibles.
        </p>
        <span className="shrink-0 tabular-nums">{context.length}/8000</span>
      </div>
      {error && <div className="mt-2 text-xs text-[var(--color-state-error)]">{error}</div>}
      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        className="mt-3 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium disabled:opacity-40"
      >
        {saving ? "Guardando…" : "Guardar contexto"}
      </button>
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
