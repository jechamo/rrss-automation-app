"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PipelineGraph, type GraphNode, type NodeState } from "@/components/PipelineGraph";
import { GenerateContentModal } from "@/components/GenerateContentModal";
import { DemoContentModal } from "@/components/DemoContentModal";
import { PieceCarousel } from "@/components/PieceCarousel";
import { PublishModal } from "@/components/PublishModal";
import type { ContentPiece, DemoConfig, MediaConfig } from "@/core/content/types";

type RunEvent =
  | { type: "node"; nodeId: string; state: NodeState; detail?: string }
  | { type: "run"; state: NodeState }
  | { type: "done"; ok: boolean }
  | { type: "log"; message: string };

type ViralPick = { url: string; titulo: string; plataforma: string };

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

const nodesFrom = (steps: { id: string; label: string }[]): GraphNode[] =>
  steps.map((s) => ({ id: s.id, label: s.label, state: "pending" as NodeState }));

const initialNodes = (): GraphNode[] => nodesFrom(REQ005_STEPS);

const STATUS_META: Record<string, { text: string; color: string }> = {
  borrador: { text: "Borrador", color: "var(--color-state-pending)" },
  generando: { text: "Generando…", color: "var(--color-state-running)" },
  listo: { text: "Listo para revisar", color: "var(--color-state-ok)" },
  publicado: { text: "Publicado", color: "var(--color-accent-2)" },
  error: { text: "Error", color: "var(--color-state-error)" },
};

export function ContentTray({
  projectId,
  ready,
}: {
  projectId: string;
  ready: boolean;
}) {
  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [runNodes, setRunNodes] = useState<Record<string, GraphNode[]>>({});
  const [virales, setVirales] = useState<ViralPick[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"lista" | "carrusel">("lista");
  const [focusedPieceId, setFocusedPieceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const esRef = useRef<Map<string, EventSource>>(new Map());

  const load = useCallback(async () => {
    const r = await fetch(`/api/content/${projectId}`);
    if (!r.ok) {
      setLoading(false);
      return;
    }
    const d = (await r.json()) as {
      pieces: ContentPiece[];
      runs: Record<string, { status: string; nodes: string }>;
    };
    setLoading(false);
    setPieces(d.pieces);
    const nodesMap: Record<string, GraphNode[]> = {};
    for (const [runId, run] of Object.entries(d.runs)) {
      try {
        nodesMap[runId] = JSON.parse(run.nodes) as GraphNode[];
      } catch {
        nodesMap[runId] = initialNodes();
      }
    }
    setRunNodes((prev) => ({ ...nodesMap, ...prev }));
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
            [runId]: (prev[runId] ?? initialNodes()).map((n) =>
              n.id === e.nodeId ? { ...n, state: e.state, detail: e.detail } : n,
            ),
          }));
        } else if (e.type === "done") {
          es.close();
          esRef.current.delete(runId);
          load();
        }
      };
      es.onerror = () => {
        es.close();
        esRef.current.delete(runId);
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
      const d = (await r.json()) as { runId: string; pieceId: string };
      setRunNodes((prev) => ({ ...prev, [d.runId]: initialNodes() }));
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
      const d = (await r.json()) as { runId: string; pieceId: string };
      setRunNodes((prev) => ({ ...prev, [d.runId]: nodesFrom(REQ006_STEPS) }));
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

  async function removePiece(pieceId: string) {
    if (!confirm("¿Eliminar esta pieza de contenido?")) return;
    await fetch(`/api/content/${projectId}/${pieceId}`, { method: "DELETE" });
    setPieces((prev) => prev.filter((p) => p.id !== pieceId));
  }

  const canGenerate = ready && virales.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Contenido generado (REQ-005 / REQ-006)</h2>
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
            title={canGenerate ? undefined : "Necesitas virales del nicho (REQ-004) para clonar."}
          >
            + Clonar viral
          </button>
          <button
            onClick={() => setShowDemoModal(true)}
            disabled={!ready}
            className="rounded-lg border border-[var(--color-accent-2)]/50 px-3 py-2 text-sm font-medium text-[var(--color-accent-2)] hover:bg-[var(--color-accent-2)]/10 disabled:opacity-40"
            title={ready ? undefined : "Genera primero el dossier (REQ-001)."}
          >
            + Contenido propio
          </button>
        </div>
      </div>

      {!ready && (
        <div className="glass p-4 text-sm text-white/50">
          Genera el dossier (REQ-001) para crear contenido. Para clonar virales necesitas además REQ-004.
        </div>
      )}
      {ready && virales.length === 0 && (
        <div className="glass p-4 text-sm text-white/50">
          No hay virales en el Top (para «Clonar viral» ejecuta REQ-004). Puedes usar «Contenido propio» ya.
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
                expanded={!!expanded[focus.id]}
                onToggle={() => setExpanded((e) => ({ ...e, [focus.id]: !e[focus.id] }))}
                onRegenerate={() => (focus.origin === "own" ? setShowDemoModal(true) : setShowModal(true))}
                onDelete={() => removePiece(focus.id)}
                onUpload={(file) => uploadScreencast(focus.id, file)}
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
                expanded={!!expanded[p.id]}
                onToggle={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))}
                onRegenerate={() => (p.origin === "own" ? setShowDemoModal(true) : setShowModal(true))}
                onDelete={() => removePiece(p.id)}
                onUpload={(file) => uploadScreencast(p.id, file)}
                onReload={load}
              />
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <GenerateContentModal
          virales={virales}
          onClose={() => setShowModal(false)}
          onGenerate={generate}
          busy={busy}
        />
      )}

      {showDemoModal && (
        <DemoContentModal
          projectId={projectId}
          onClose={() => setShowDemoModal(false)}
          onGenerate={generateDemo}
          busy={busy}
        />
      )}
    </div>
  );
}

function PieceCard({
  projectId,
  piece,
  nodes,
  expanded,
  onToggle,
  onRegenerate,
  onDelete,
  onUpload,
  onReload,
}: {
  projectId: string;
  piece: ContentPiece;
  nodes?: GraphNode[];
  expanded: boolean;
  onToggle: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onUpload: (file: File) => void;
  onReload: () => void;
}) {
  const [showPublish, setShowPublish] = useState(false);
  const meta = STATUS_META[piece.status] ?? STATUS_META.borrador;
  const asset = (rel: string) =>
    `/api/content/${projectId}/${piece.id}/asset?path=${encodeURIComponent(rel)}`;
  const g = piece.content.guion;
  const isOwn = piece.origin === "own";

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

      {piece.status === "generando" && nodes && (
        <div className="mb-3">
          <PipelineGraph nodes={nodes} />
        </div>
      )}

      {/* Reproductores de lo generado */}
      {piece.assets.videoPath && (
        <video
          key={piece.assets.videoPath}
          controls
          className="mb-3 max-h-80 w-full rounded-lg bg-black"
          src={asset(piece.assets.videoPath)}
        />
      )}
      {piece.assets.audioPath && (
        <audio key={piece.assets.audioPath} controls className="mb-3 w-full" src={asset(piece.assets.audioPath)} />
      )}
      {piece.assets.clips.length > 1 && (
        <div className="mb-3 text-xs text-white/50">
          {piece.assets.clips.length} cortes generados (montaje con FFmpeg pendiente).
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
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-white/50">Grabación de la app</span>
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
          </div>
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
