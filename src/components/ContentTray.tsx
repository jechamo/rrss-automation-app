"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PipelineGraph, type GraphNode, type NodeState } from "@/components/PipelineGraph";
import { GenerateContentModal } from "@/components/GenerateContentModal";
import type { ContentPiece, MediaConfig } from "@/core/content/types";

type RunEvent =
  | { type: "node"; nodeId: string; state: NodeState; detail?: string }
  | { type: "run"; state: NodeState }
  | { type: "done"; ok: boolean }
  | { type: "log"; message: string };

type ViralPick = { url: string; titulo: string; plataforma: string };

// Pasos estaticos del pipeline REQ-005 (evita importar el modulo de servidor).
const REQ005_STEPS: { id: string; label: string }[] = [
  { id: "input", label: "Entrada" },
  { id: "extract", label: "Extraer" },
  { id: "guion", label: "Guion" },
  { id: "media", label: "Vídeo" },
  { id: "voz", label: "Locución" },
  { id: "montaje", label: "Montaje" },
];

const initialNodes = (): GraphNode[] =>
  REQ005_STEPS.map((s) => ({ id: s.id, label: s.label, state: "pending" as NodeState }));

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
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const esRef = useRef<Map<string, EventSource>>(new Map());

  const load = useCallback(async () => {
    const r = await fetch(`/api/content/${projectId}`);
    if (!r.ok) return;
    const d = (await r.json()) as {
      pieces: ContentPiece[];
      runs: Record<string, { status: string; nodes: string }>;
    };
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

  async function updatePiece(pieceId: string, patch: { status?: string }) {
    await fetch(`/api/content/${projectId}/${pieceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
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
        <h2 className="text-lg font-bold">Contenido generado (REQ-005)</h2>
        <button
          onClick={() => setShowModal(true)}
          disabled={!canGenerate}
          className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
          title={canGenerate ? undefined : "Necesitas virales del nicho (REQ-004) para clonar."}
        >
          + Generar contenido
        </button>
      </div>

      {!ready && (
        <div className="glass p-4 text-sm text-white/50">
          Genera el dossier (REQ-001) y los virales del nicho (REQ-004) para clonar contenido.
        </div>
      )}
      {ready && virales.length === 0 && (
        <div className="glass p-4 text-sm text-white/50">
          No hay virales en el Top. Ejecuta REQ-004 primero.
        </div>
      )}

      {pieces.length === 0 && ready && virales.length > 0 && (
        <div className="glass p-4 text-xs text-white/40">
          Sin piezas todavía. Pulsa «Generar contenido» para clonar un viral por reinterpretación.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {pieces.map((p) => (
          <PieceCard
            key={p.id}
            projectId={projectId}
            piece={p}
            nodes={p.runId ? runNodes[p.runId] : undefined}
            expanded={!!expanded[p.id]}
            onToggle={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))}
            onPublish={() => updatePiece(p.id, { status: "publicado" })}
            onRegenerate={() => setShowModal(true)}
            onDelete={() => removePiece(p.id)}
          />
        ))}
      </div>

      {showModal && (
        <GenerateContentModal
          virales={virales}
          onClose={() => setShowModal(false)}
          onGenerate={generate}
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
  onPublish,
  onRegenerate,
  onDelete,
}: {
  projectId: string;
  piece: ContentPiece;
  nodes?: GraphNode[];
  expanded: boolean;
  onToggle: () => void;
  onPublish: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[piece.status] ?? STATUS_META.borrador;
  const asset = (rel: string) =>
    `/api/content/${projectId}/${piece.id}/asset?path=${encodeURIComponent(rel)}`;
  const g = piece.content.guion;

  return (
    <div className="glass p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: `${meta.color}22`, color: meta.color }}
            >
              {meta.text}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
              {piece.plataforma}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
              {piece.config.rama === "heygen" ? "HeyGen" : "fal.ai"}
            </span>
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
          {piece.status === "listo" && (
            <button
              onClick={onPublish}
              className="rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/5"
            >
              Marcar publicado
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
