"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PipelineGraph, type GraphNode, type NodeState } from "@/components/PipelineGraph";
import { GenerateContentModal } from "@/components/GenerateContentModal";
import { DemoContentModal } from "@/components/DemoContentModal";
import { PieceCarousel } from "@/components/PieceCarousel";
import { PublishModal } from "@/components/PublishModal";
import { SelfRecordModal } from "@/components/SelfRecordModal";
import { useAppDialog } from "@/components/AppDialog";
import type { ContentPiece, DemoConfig, MediaConfig } from "@/core/content/types";
import { friendlyProviderFailure, sanitizeProviderMessage } from "@/core/media/contracts";

type RunEvent =
  | { type: "node"; nodeId: string; state: NodeState; detail?: string }
  | { type: "run"; state: NodeState }
  | { type: "done"; ok: boolean }
  | { type: "log"; message: string };

type ViralPick = { url: string; titulo: string; plataforma: string };
type RunSnapshot = {
  requisito: string;
  status: string;
  nodes: string;
  logs: string | null;
  updatedAt: string;
};

// Pasos estaticos de los pipelines (evita importar el modulo de servidor).
const REQ005_STEPS: { id: string; label: string }[] = [
  { id: "input", label: "Entrada" },
  { id: "extract", label: "Extraer" },
  { id: "guion", label: "Guion" },
  { id: "media", label: "Vídeo" },
  { id: "voz", label: "Locución" },
  { id: "montaje", label: "Montaje" },
];

const REQ006_STEPS: { id: string; label: string }[] = [
  { id: "input", label: "Entrada" },
  { id: "grabacion", label: "Grabar app" },
  { id: "guion", label: "Guion" },
  { id: "media", label: "Cortes" },
  { id: "voz", label: "Locución" },
  { id: "montaje", label: "Montaje" },
];

const REQ006_REFRESH_STEPS: { id: string; label: string }[] = [
  { id: "input", label: "Reutilizar recursos" },
  { id: "navigation", label: "Navegación" },
  { id: "montage", label: "Remontar sin créditos" },
];

const nodesFrom = (steps: { id: string; label: string }[]): GraphNode[] =>
  steps.map((s) => ({ id: s.id, label: s.label, state: "pending" as NodeState }));

const initialNodes = (): GraphNode[] => nodesFrom(REQ005_STEPS);

const NODE_PROGRESS: Record<NodeState, number> = { pending: 0, running: 1, ok: 2, error: 2 };

function mergeNodeProgress(previous: GraphNode[] | undefined, incoming: GraphNode[]): GraphNode[] {
  if (!previous?.length) return incoming;
  return incoming.map((next) => {
    const current = previous.find((node) => node.id === next.id);
    if (!current) return next;
    return NODE_PROGRESS[next.state] >= NODE_PROGRESS[current.state] ? next : current;
  });
}

function displayGenerationMessage(message: string): string {
  const safe = sanitizeProviderMessage(message);
  return /fal\.run|fal\.ai|exhausted balance/i.test(safe) && /http 4\d\d|balance|credit|quota/i.test(safe)
    ? friendlyProviderFailure("fal.ai", safe)
    : safe;
}

const STATUS_META: Record<string, { text: string; color: string }> = {
  borrador: { text: "Borrador", color: "var(--color-state-pending)" },
  generando: { text: "Generando…", color: "var(--color-state-running)" },
  listo: { text: "Listo para revisar", color: "var(--color-state-ok)" },
  publicado: { text: "Publicado", color: "var(--color-accent-2)" },
  error: { text: "Error", color: "var(--color-state-error)" },
};

export function ContentTray({
  projectId,
  projectUrl,
  ready,
}: {
  projectId: string;
  projectUrl: string;
  ready: boolean;
}) {
  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [runNodes, setRunNodes] = useState<Record<string, GraphNode[]>>({});
  const [runLogs, setRunLogs] = useState<Record<string, string[]>>({});
  const [virales, setVirales] = useState<ViralPick[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [recordingPieceId, setRecordingPieceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"lista" | "carrusel">("lista");
  const [focusedPieceId, setFocusedPieceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const esRef = useRef<Map<string, EventSource>>(new Map());
  const appDialog = useAppDialog();

  const load = useCallback(async () => {
    const r = await fetch(`/api/content/${projectId}`);
    if (!r.ok) {
      setLoading(false);
      return;
    }
    const d = (await r.json()) as {
      pieces: ContentPiece[];
      runs: Record<string, RunSnapshot>;
    };
    setLoading(false);
    setPieces(d.pieces);
    const nodesMap: Record<string, GraphNode[]> = {};
    const logsMap: Record<string, string[]> = {};
    for (const [runId, run] of Object.entries(d.runs)) {
      try {
        nodesMap[runId] = JSON.parse(run.nodes) as GraphNode[];
      } catch {
        nodesMap[runId] = run.requisito === "REQ-006"
          ? nodesFrom(REQ006_STEPS)
          : run.requisito === "REQ-006-NAV"
            ? nodesFrom(REQ006_REFRESH_STEPS)
            : initialNodes();
      }
      try {
        logsMap[runId] = run.logs ? JSON.parse(run.logs) as string[] : [];
      } catch {
        logsMap[runId] = [];
      }
    }
    setRunNodes((previous) => {
      const merged = { ...previous };
      for (const [runId, incoming] of Object.entries(nodesMap)) {
        merged[runId] = mergeNodeProgress(previous[runId], incoming);
      }
      return merged;
    });
    setRunLogs((previous) => ({ ...previous, ...logsMap }));
  }, [projectId]);

  const loadVirales = useCallback(async () => {
    const r = await fetch(`/api/virales/${projectId}`);
    if (!r.ok) return;
    const d = await r.json();
    const list: ViralPick[] = (d.virales?.virales ?? []).map((v: ViralPick) => ({
      url: v.url,
      titulo: v.titulo,
      plataforma: v.plataforma,
    }));
    setVirales(list.filter((v) => v.url));
  }, [projectId]);

  const subscribe = useCallback(
    (runId: string) => {
      if (esRef.current.has(runId)) return;
      const es = new EventSource(`/api/runs/${runId}/stream`);
      esRef.current.set(runId, es);
      es.onmessage = (ev) => {
        const e: RunEvent = JSON.parse(ev.data);
        if (e.type === "node") {
          setRunNodes((prev) => ({
            ...prev,
            [runId]: prev[runId]?.length
              ? prev[runId].map((n) =>
                  n.id === e.nodeId ? { ...n, state: e.state, detail: e.detail } : n,
                )
              : [{ id: e.nodeId, label: e.nodeId, state: e.state, detail: e.detail }],
          }));
        } else if (e.type === "log") {
          setRunLogs((prev) => ({
            ...prev,
            [runId]: [...(prev[runId] ?? []), e.message],
          }));
        } else if (e.type === "done") {
          es.close();
          esRef.current.delete(runId);
          void load();
          window.setTimeout(() => void load(), 500);
        }
      };
      es.onerror = () => {
        void load();
      };
    },
    [load],
  );

  useEffect(() => {
    load();
    loadVirales();
  }, [load, loadVirales]);

  // Suscribe a los runs de las piezas que estan generando.
  useEffect(() => {
    for (const p of pieces) {
      if (p.status === "generando" && p.runId) subscribe(p.runId);
    }
  }, [pieces, subscribe]);

  useEffect(() => {
    const map = esRef.current;
    return () => {
      for (const es of map.values()) es.close();
      map.clear();
    };
  }, []);

  async function generate(sourceUrl: string, config: MediaConfig) {
    setBusy(true);
    const r = await fetch(`/api/projects/${projectId}/content/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceUrl, config }),
    });
    setBusy(false);
    if (r.ok) {
      const d = (await r.json()) as { runId: string; pieceId: string; nodes?: GraphNode[] };
      setRunNodes((prev) => ({ ...prev, [d.runId]: d.nodes ?? initialNodes() }));
      setRunLogs((prev) => ({ ...prev, [d.runId]: [] }));
      setShowModal(false);
      subscribe(d.runId);
      await load();
    }
  }

  async function generateDemo(demo: DemoConfig, config: Partial<MediaConfig>) {
    setBusy(true);
    const r = await fetch(`/api/projects/${projectId}/content/demo/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demo, config }),
    });
    setBusy(false);
    if (r.ok) {
      const d = (await r.json()) as { runId: string; pieceId: string; nodes?: GraphNode[] };
      setRunNodes((prev) => ({ ...prev, [d.runId]: d.nodes ?? nodesFrom(REQ006_STEPS) }));
      setRunLogs((prev) => ({ ...prev, [d.runId]: [] }));
      setShowDemoModal(false);
      subscribe(d.runId);
      await load();
    }
  }

  async function uploadScreencast(pieceId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    const r = await fetch(`/api/content/${projectId}/${pieceId}/upload`, {
      method: "POST",
      body: form,
    });
    if (r.ok) load();
  }

  async function attachRecording(pieceId: string, assetId: string) {
    const response = await fetch(`/api/content/${projectId}/${pieceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordingAssetId: assetId }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      await appDialog.alert({
        title: "No se pudo adjuntar",
        message: data.error || "No se pudo adjuntar la grabación.",
        tone: "danger",
      });
      return;
    }
    await load();
  }

  async function clearRecording(pieceId: string) {
    if (!await appDialog.confirm({
      title: "Quitar grabación de la pieza",
      message: "La grabación dejará de estar asociada a esta pieza, pero el archivo original seguirá disponible en la mediateca.",
      confirmLabel: "Quitar grabación",
      tone: "danger",
    })) return;
    await fetch(`/api/content/${projectId}/${pieceId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clearRecording: true }),
    });
    await load();
  }

  async function refreshOwnPiece(pieceId: string, mode: "auto" | "existing") {
    const message = mode === "auto"
      ? "Se validará y regrabará únicamente la navegación. Después se remontará reutilizando vídeos y voz existentes."
      : "Se remontará con la grabación actual y los recursos existentes, sin llamar a fal.ai ni ElevenLabs.";
    if (!await appDialog.confirm({
      title: mode === "auto" ? "Regrabar navegación" : "Remontar sin créditos",
      message,
      confirmLabel: mode === "auto" ? "Validar y regrabar" : "Crear nuevo montaje",
    })) return;
    const response = await fetch(`/api/content/${projectId}/${pieceId}/remount`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      runId?: string;
      nodes?: GraphNode[];
    };
    if (!response.ok || !data.runId) {
      await appDialog.alert({
        title: "No se pudo iniciar",
        message: data.error || "No se pudo iniciar el remontaje.",
        tone: "danger",
      });
      return;
    }
    setRunNodes((previous) => ({
      ...previous,
      [data.runId!]: data.nodes ?? nodesFrom(REQ006_REFRESH_STEPS),
    }));
    setRunLogs((previous) => ({ ...previous, [data.runId!]: [] }));
    subscribe(data.runId);
    await load();
  }

  async function removePiece(pieceId: string) {
    if (!await appDialog.confirm({
      title: "Eliminar pieza de contenido",
      message: "Se eliminará la pieza y dejará de aparecer en esta bandeja.",
      confirmLabel: "Eliminar pieza",
      tone: "danger",
    })) return;
    await fetch(`/api/content/${projectId}/${pieceId}`, { method: "DELETE" });
    setPieces((prev) => prev.filter((p) => p.id !== pieceId));
  }

  const canGenerate = ready && virales.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Contenido generado</h2>
        <div className="flex items-center gap-2">
          {pieces.length > 0 && (
            <div className="mr-1 flex rounded-lg border border-white/10 p-0.5 text-xs">
              {(["lista", "carrusel"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={[
                    "rounded-md px-2.5 py-1 capitalize transition",
                    view === v ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70",
                  ].join(" ")}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowModal(true)}
            disabled={!canGenerate}
            className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
            title={canGenerate ? undefined : "Necesitas virales del nicho para clonar."}
          >
            + Clonar viral
          </button>
          <button
            onClick={() => setShowDemoModal(true)}
            disabled={!ready}
            className="rounded-lg border border-[var(--color-accent-2)]/50 px-3 py-2 text-sm font-medium text-[var(--color-accent-2)] hover:bg-[var(--color-accent-2)]/10 disabled:opacity-40"
            title={ready ? undefined : "Genera primero el dossier."}
          >
            + Contenido propio
          </button>
        </div>
      </div>

      {!ready && (
        <div className="glass p-4 text-sm text-white/50">
          Genera el dossier para crear contenido. Para clonar virales necesitas además analizar
          los virales del nicho.
        </div>
      )}
      {ready && virales.length === 0 && (
        <div className="glass p-4 text-sm text-white/50">
          No hay virales en el Top. Analiza los virales del nicho para usar «Clonar viral»;
          mientras tanto puedes crear «Contenido propio».
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="glass p-4">
              <div className="flex items-center gap-2">
                <div className="skeleton h-5 w-24" />
                <div className="skeleton h-5 w-16" />
              </div>
              <div className="skeleton mt-3 h-4 w-2/3" />
              <div className="skeleton mt-4 h-40 w-full" />
            </div>
          ))}
        </div>
      )}

      {!loading && pieces.length === 0 && ready && (
        <div className="glass p-4 text-xs text-white/40">
          Sin piezas todavía. «Clonar viral» reinterpreta un viral; «Contenido propio» muestra tu app.
        </div>
      )}

      {view === "carrusel" && pieces.length > 0 ? (
        <div className="flex flex-col gap-4">
          <PieceCarousel
            projectId={projectId}
            pieces={pieces}
            onSelect={(id) => setFocusedPieceId(id)}
          />
          {(() => {
            const focus = pieces.find((p) => p.id === focusedPieceId) ?? pieces[0];
            return (
              <PieceCard
                key={focus.id}
                projectId={projectId}
                piece={focus}
                nodes={focus.runId ? runNodes[focus.runId] : undefined}
                runLogs={focus.runId ? runLogs[focus.runId] : undefined}
                expanded={!!expanded[focus.id]}
                onToggle={() => setExpanded((e) => ({ ...e, [focus.id]: !e[focus.id] }))}
                onRegenerate={() => (focus.origin === "own" ? setShowDemoModal(true) : setShowModal(true))}
                onDelete={() => removePiece(focus.id)}
                onUpload={(file) => uploadScreencast(focus.id, file)}
                onRecord={() => setRecordingPieceId(focus.id)}
                onClearRecording={() => clearRecording(focus.id)}
                onRefreshNavigation={() => refreshOwnPiece(focus.id, "auto")}
                onRemount={() => refreshOwnPiece(focus.id, "existing")}
                onReload={load}
              />
            );
          })()}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {pieces.map((p, i) => (
            <div key={p.id} className="animate-in" style={{ animationDelay: `${i * 50}ms` }}>
              <PieceCard
                projectId={projectId}
                piece={p}
                nodes={p.runId ? runNodes[p.runId] : undefined}
                runLogs={p.runId ? runLogs[p.runId] : undefined}
                expanded={!!expanded[p.id]}
                onToggle={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))}
                onRegenerate={() => (p.origin === "own" ? setShowDemoModal(true) : setShowModal(true))}
                onDelete={() => removePiece(p.id)}
                onUpload={(file) => uploadScreencast(p.id, file)}
                onRecord={() => setRecordingPieceId(p.id)}
                onClearRecording={() => clearRecording(p.id)}
                onRefreshNavigation={() => refreshOwnPiece(p.id, "auto")}
                onRemount={() => refreshOwnPiece(p.id, "existing")}
                onReload={load}
              />
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <GenerateContentModal
          projectId={projectId}
          virales={virales}
          onClose={() => setShowModal(false)}
          onGenerate={generate}
          busy={busy}
        />
      )}

      {showDemoModal && (
        <DemoContentModal
          projectId={projectId}
          projectUrl={projectUrl}
          onClose={() => setShowDemoModal(false)}
          onGenerate={generateDemo}
          busy={busy}
        />
      )}
      {recordingPieceId && (
        <SelfRecordModal
          projectId={projectId}
          initialUrl={projectUrl}
          onClose={() => setRecordingPieceId(null)}
          onSaved={async (asset) => {
            await attachRecording(recordingPieceId, asset.id);
            setRecordingPieceId(null);
          }}
        />
      )}
      {appDialog.dialog}
    </div>
  );
}

function PieceCard({
  projectId,
  piece,
  nodes,
  runLogs,
  expanded,
  onToggle,
  onRegenerate,
  onDelete,
  onUpload,
  onRecord,
  onClearRecording,
  onRefreshNavigation,
  onRemount,
  onReload,
}: {
  projectId: string;
  piece: ContentPiece;
  nodes?: GraphNode[];
  runLogs?: string[];
  expanded: boolean;
  onToggle: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onUpload: (file: File) => void;
  onRecord: () => void;
  onClearRecording: () => void;
  onRefreshNavigation: () => void;
  onRemount: () => void;
  onReload: () => void;
}) {
  const [showPublish, setShowPublish] = useState(false);
  const [showClips, setShowClips] = useState(false);
  const meta = STATUS_META[piece.status] ?? STATUS_META.borrador;
  const asset = (rel: string) =>
    `/api/content/${projectId}/${piece.id}/asset?path=${encodeURIComponent(rel)}`;
  const g = piece.content.guion;
  const isOwn = piece.origin === "own";
  const isMounted = /(?:^|\/)final(?:-[^/]+)?\.mp4$/i.test(piece.assets.videoPath);
  const allLogs = [...piece.assets.logs, ...(runLogs ?? [])].map(displayGenerationMessage).filter(
    (log, index, list) => list.indexOf(log) === index,
  );
  const ffmpegMissing = allLogs.some((log) => log.includes("FFmpeg no encontrado"));
  const displayNodes = nodes?.map((node) => ({
    ...node,
    ...(node.detail ? { detail: displayGenerationMessage(node.detail) } : {}),
  }));
  const errorNode = displayNodes?.find((node) => node.state === "error");
  const clipItems = piece.assets.clipManifest.length > 0
    ? piece.assets.clipManifest
    : piece.assets.clips.map((path, index) => ({
        shot: index + 1,
        description: "Corte generado",
        prompt: "",
        model: piece.config.videoModelo,
        requestedSeconds: piece.config.falClipSeconds,
        actualSeconds: null,
        path,
        status: "ok" as const,
        error: undefined as string | undefined,
      }));
  const generatedResourceCount = clipItems.filter((clip) => clip.status === "ok").length +
    (piece.assets.brandOutroPath ? 1 : 0);
  const generatedResourceTotal = clipItems.length + (piece.assets.brandOutroPath ? 1 : 0);

  return (
    <div className="glass card-lift p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-300"
              style={{ background: `${meta.color}22`, color: meta.color }}
            >
              {meta.text}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
              {piece.plataforma}
            </span>
            {isOwn ? (
              <span className="rounded-full bg-[var(--color-accent-2)]/15 px-2 py-0.5 text-[10px] text-[var(--color-accent-2)]">
                Propio · app
              </span>
            ) : (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
                {piece.config.rama === "heygen" ? "HeyGen" : "fal.ai"}
              </span>
            )}
            {isMounted && (
              <span className="rounded-full bg-[var(--color-state-ok)]/15 px-2 py-0.5 text-[10px] text-[var(--color-state-ok)]">
                Montaje ✓
              </span>
            )}
          </div>
          <div className="mt-1 truncate text-sm font-semibold">
            {piece.titulo || g.gancho || "(sin título)"}
          </div>
          {piece.sourceUrl && (
            <a
              href={piece.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[var(--color-accent-2)] hover:underline"
            >
              viral fuente ↗
            </a>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          {(piece.status === "listo" || piece.status === "publicado") && (
            <button
              onClick={() => setShowPublish(true)}
              className="rounded-lg bg-[var(--color-accent)] px-2 py-1 text-xs font-medium"
            >
              Publicar ↗
            </button>
          )}
          <button
            onClick={onRegenerate}
            className="rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/5"
          >
            Regenerar
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg border border-[var(--color-state-error)]/40 px-2 py-1 text-xs text-[var(--color-state-error)] hover:bg-[var(--color-state-error)]/10"
          >
            Eliminar
          </button>
        </div>
      </div>

      {displayNodes && displayNodes.length > 0 && (
        <div className="mb-3">
          <PipelineGraph nodes={displayNodes} />
        </div>
      )}
      {piece.status === "generando" && (!nodes || nodes.length === 0) && (
        <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/45">
          Preparando pipeline…
        </div>
      )}
      {piece.status === "error" && (
        <div className="mb-3 rounded-lg border border-[var(--color-state-error)]/45 bg-[var(--color-state-error)]/10 p-3 text-xs">
          <div className="font-semibold text-[var(--color-state-error)]">
            Falló {errorNode ? `en «${errorNode.label}»` : "la generación"}
          </div>
          <div className="mt-1 text-white/65">
            {(errorNode?.detail ? displayGenerationMessage(errorNode.detail) : "") || allLogs.at(-1) || "Consulta el registro de generación para ver el motivo."}
          </div>
        </div>
      )}

      {/* Reproductores de lo generado */}
      {piece.assets.videoPath && (
        <div className="mb-3">
          <div className="mb-1 text-[11px] font-medium text-white/55">
            {isMounted ? "Vídeo final montado" : "Preview provisional"}
            {!isMounted && piece.assets.clips[0] === piece.assets.videoPath ? " · corte 1" : ""}
          </div>
          <video
            key={piece.assets.videoPath}
            controls
            className="max-h-80 w-full rounded-lg bg-black"
            src={asset(piece.assets.videoPath)}
          />
        </div>
      )}
      {piece.assets.audioPath && (
        <audio key={piece.assets.audioPath} controls className="mb-3 w-full" src={asset(piece.assets.audioPath)} />
      )}
      {generatedResourceTotal > 0 && (
        <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <button
            type="button"
            onClick={() => setShowClips((value) => !value)}
            className="flex w-full items-center justify-between text-left text-xs font-medium text-white/70"
          >
            <span>Recursos generados ({generatedResourceCount}/{generatedResourceTotal})</span>
            <span className="text-[var(--color-accent-2)]">{showClips ? "Ocultar" : "Ver todos"}</span>
          </button>
          {showClips && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {clipItems.map((clip, index) => (
                <div key={`${clip.shot}-${clip.path}-${index}`} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
                    <b>Corte {index + 1} · plano {clip.shot}</b>
                    <span className={clip.status === "ok" ? "text-[var(--color-state-ok)]" : clip.status === "error" ? "text-[var(--color-state-error)]" : "text-white/40"}>
                      {clip.status === "ok" ? "Generado" : clip.status === "error" ? "Error" : "Generando…"}
                    </span>
                  </div>
                  {clip.path && <video controls preload="metadata" className="w-full rounded bg-black" src={asset(clip.path)} />}
                  <div className="mt-2 text-[10px] text-white/45">
                    {clip.description || "Corte generado"}
                    <div>
                      Duración: {clip.actualSeconds ? `${clip.actualSeconds.toFixed(1)}s real` : `${clip.requestedSeconds}s solicitada`}
                      {clip.model ? ` · ${clip.model.split("/").at(-1)}` : ""}
                    </div>
                    {clip.error && <div className="mt-1 text-[var(--color-state-error)]">{clip.error}</div>}
                    {clip.prompt && <details className="mt-1"><summary className="cursor-pointer">Ver prompt</summary><div className="mt-1 break-words">{clip.prompt}</div></details>}
                  </div>
                </div>
              ))}
              {piece.assets.brandOutroPath && (
                <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] p-2">
                  <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
                    <b>Cierre de marca · logo</b>
                    <span className="text-[var(--color-state-ok)]">Generado</span>
                  </div>
                  <video controls preload="metadata" className="w-full rounded bg-black" src={asset(piece.assets.brandOutroPath)} />
                  <div className="mt-2 text-[10px] text-white/45">
                    Animación final de 3 segundos creada localmente, sin coste de proveedor.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {allLogs.length > 0 && (
        <div
          className={[
            "mb-3 rounded-lg border p-3 text-xs",
            ffmpegMissing
              ? "border-[var(--color-state-pending)]/40 bg-[var(--color-state-pending)]/10"
              : "border-white/10 bg-white/5",
          ].join(" ")}
        >
          <div className="mb-1 font-medium text-white/70">Registro de generación</div>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-white/55">
            {allLogs.map((log, index) => (
              <li key={`${index}-${log}`}>{log}</li>
            ))}
          </ul>
          {ffmpegMissing && (
            <code className="mt-2 block rounded bg-black/30 px-2 py-1 text-[11px] text-white/70">
              winget install ffmpeg
            </code>
          )}
        </div>
      )}

      {/* Grabación real de la app (REQ-006) + subida manual */}
      {isOwn && (
        <div
          className={[
            "mb-3 rounded-lg p-3",
            piece.assets.recordingPath
              ? "bg-white/5"
              : "border border-dashed border-[var(--color-accent)]/50 bg-[var(--color-accent)]/5",
          ].join(" ")}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-white/50">Grabación de la app</span>
            <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onRecord} className="rounded-lg bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-400">● REC</button>
            {piece.config.demo?.navSteps?.length ? (
              <button
                type="button"
                onClick={onRefreshNavigation}
                disabled={piece.status === "generando"}
                className="rounded-lg border border-cyan-400/35 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-400/15 disabled:opacity-40"
                title="Valida y regraba Playwright; reutiliza los vídeos y la voz existentes"
              >
                Regrabar navegación
              </button>
            ) : null}
            <label
              className={[
                "cursor-pointer rounded-lg px-2 py-1 text-xs",
                piece.assets.recordingPath
                  ? "border border-white/15 hover:bg-white/5"
                  : "bg-[var(--color-accent)] font-medium",
              ].join(" ")}
            >
              {piece.assets.recordingPath ? "Reemplazar vídeo" : "Subir vídeo de la app ↑"}
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            {piece.assets.recordingPath && <button type="button" onClick={onClearRecording} className="rounded-lg border border-red-400/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10">Quitar</button>}
            {piece.assets.recordingPath ? (
              <button
                type="button"
                onClick={onRemount}
                disabled={piece.status === "generando"}
                className="rounded-lg border border-purple-400/35 bg-purple-400/10 px-2 py-1 text-xs font-medium text-purple-200 hover:bg-purple-400/15 disabled:opacity-40"
                title="No solicita nuevos vídeos, voz ni avatar"
              >
                Remontar sin créditos
              </button>
            ) : null}
            </div>
          </div>
          <details className="mb-2 rounded-lg border border-white/8 bg-black/15 px-3 py-2 text-[10px] text-white/45">
            <summary className="cursor-pointer font-medium text-white/60">¿Qué hace cada opción?</summary>
            <dl className="mt-2 grid gap-2 leading-relaxed sm:grid-cols-2">
              <div><dt className="font-semibold text-red-200">REC</dt><dd>Abre la captura manual. Navegas tú por la app y guardas el resultado en la mediateca y en esta pieza.</dd></div>
              <div><dt className="font-semibold text-cyan-200">Regrabar navegación</dt><dd>Valida los pasos y vuelve a grabarlos con Playwright. Después remonta usando los vídeos y la voz ya existentes.</dd></div>
              <div><dt className="font-semibold text-white/75">Reemplazar vídeo</dt><dd>Sube otro archivo como navegación de esta pieza. No genera ni monta nada hasta que pulses remontar.</dd></div>
              <div><dt className="font-semibold text-red-200">Quitar</dt><dd>Desvincula la grabación de esta pieza. El original sigue guardado en la mediateca.</dd></div>
              <div className="sm:col-span-2"><dt className="font-semibold text-purple-200">Remontar sin créditos</dt><dd>Crea de nuevo el vídeo final con la grabación actual, los cortes, la locución, el guion y los subtítulos existentes. No llama a fal.ai, ElevenLabs ni HeyGen.</dd></div>
            </dl>
          </details>
          {piece.assets.recordingPath ? (
            <video
              key={piece.assets.recordingPath}
              controls
              className="max-h-80 w-full rounded-lg bg-black"
              src={asset(piece.assets.recordingPath)}
            />
          ) : (
            <p className="text-[11px] text-white/50">
              {piece.config.demo?.grabacionModo === "manual"
                ? "Modo manual: graba tú la pantalla de tu app y súbela aquí con el botón de arriba."
                : "Sin grabación automática (Playwright). Puedes subir un vídeo manual aquí."}
            </p>
          )}
        </div>
      )}

      {(g.gancho || piece.content.escaleta.length > 0) && (
        <button onClick={onToggle} className="text-xs text-[var(--color-accent-2)] hover:underline">
          {expanded ? "Ocultar guion" : "Ver guion y escaleta"}
        </button>
      )}

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <Field label="Gancho" value={g.gancho} />
          <Field label="Desarrollo" value={g.desarrollo} />
          <Field label="CTA" value={g.cta} />
          <Field label="Locución" value={g.locucion} />
          {piece.content.patronAplicado && <Field label="Patrón aplicado" value={piece.content.patronAplicado} />}
          {g.hashtags.length > 0 && <Field label="Hashtags" value={g.hashtags.join(" ")} />}
          {piece.content.escaleta.length > 0 && (
            <div>
              <div className="mb-1 text-xs text-white/50">Escaleta ({piece.content.escaleta.length} planos)</div>
              <div className="flex flex-col gap-1">
                {piece.content.escaleta.map((s) => (
                  <div key={s.n} className="rounded-lg bg-white/5 p-2 text-xs">
                    <b>#{s.n}</b> ({s.segundos}s) — {s.descripcion}
                    {s.texto ? ` · texto: ${s.texto}` : ""}
                    {s.prompt ? (
                      <div className="mt-0.5 text-white/40">prompt: {s.prompt}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="text-[10px] text-white/30">{piece.content.notaLegal}</div>
        </div>
      )}

      {showPublish && (
        <PublishModal
          projectId={projectId}
          piece={piece}
          onClose={() => setShowPublish(false)}
          onPublished={onReload}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs text-white/50">{label}: </span>
      <span className="text-white/80">{value}</span>
    </div>
  );
}
