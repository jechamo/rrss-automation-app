"use client";

import { useState } from "react";
import type { ContentPiece, Plataforma } from "@/core/content/types";
import { PUBLISH_TARGET_LIST, composeCaption, finalVideoPath } from "@/core/content/publish";

// REQ-010 — Publicación asistida (opción A): descargar vídeo + copiar copy +
// abrir la red destino. Sin APIs oficiales; el usuario pega y publica.
export function PublishModal({
  projectId,
  piece,
  onClose,
  onPublished,
}: {
  projectId: string;
  piece: ContentPiece;
  onClose: () => void;
  onPublished: () => void;
}) {
  const [platform, setPlatform] = useState<Plataforma>(piece.plataforma);
  const [caption, setCaption] = useState(() => composeCaption(piece));
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [marking, setMarking] = useState(false);

  const target = PUBLISH_TARGET_LIST.find((t) => t.id === platform)!;
  const rel = finalVideoPath(piece);
  const downloadUrl = rel
    ? `/api/content/${projectId}/${piece.id}/asset?path=${encodeURIComponent(rel)}&download=1`
    : "";

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function openNetwork() {
    window.open(target.uploadUrl, "_blank", "noopener,noreferrer");
    setOpened(true);
  }

  async function markPublished() {
    setMarking(true);
    const r = await fetch(`/api/content/${projectId}/${piece.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "publicado", publishedTo: platform }),
    });
    setMarking(false);
    if (r.ok) {
      onPublished();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass max-h-[90vh] w-full max-w-lg overflow-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Publicar en redes</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 text-sm">
          <div>
            <div className="mb-1 text-xs text-white/50">Red destino</div>
            <div className="flex gap-2">
              {PUBLISH_TARGET_LIST.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPlatform(t.id)}
                  className={[
                    "flex-1 rounded-lg border px-3 py-2 text-sm capitalize",
                    platform === t.id
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15"
                      : "border-white/15 hover:bg-white/5",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-white/40">{target.hint}</p>
          </div>

          {/* Paso 1 — Descargar el vídeo */}
          <Step n={1} done={downloaded} title="Descarga el vídeo final">
            {downloadUrl ? (
              <a
                href={downloadUrl}
                download
                onClick={() => setDownloaded(true)}
                className="inline-block rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:bg-white/5"
              >
                Descargar vídeo ↓
              </a>
            ) : (
              <p className="text-[11px] text-[var(--color-state-pending)]">
                Aún no hay vídeo generado para esta pieza. Genera/monta el contenido antes de publicar.
              </p>
            )}
          </Step>

          {/* Paso 2 — Copiar copy */}
          <Step n={2} done={copied} title="Copia el texto (copy + hashtags)">
            <textarea
              className="input min-h-28 font-mono text-xs"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <button
              onClick={copyCaption}
              className="mt-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:bg-white/5"
            >
              {copied ? "¡Copiado!" : "Copiar copy"}
            </button>
          </Step>

          {/* Paso 3 — Abrir la red */}
          <Step n={3} done={opened} title={`Abre ${target.label} y sube el vídeo`}>
            <button
              onClick={openNetwork}
              className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium"
            >
              Abrir {target.label} ↗
            </button>
            <p className="mt-1 text-[11px] text-white/40">
              Se abre en otra pestaña. Pega el copy y sube el vídeo descargado.
            </p>
          </Step>

          {/* Paso 4 — Marcar publicado */}
          <Step n={4} done={piece.status === "publicado"} title="Marca la pieza como publicada">
            <button
              onClick={markPublished}
              disabled={marking}
              className="rounded-lg border border-[var(--color-state-ok)]/50 px-3 py-1.5 text-xs text-[var(--color-state-ok)] hover:bg-[var(--color-state-ok)]/10 disabled:opacity-40"
            >
              {marking ? "Guardando…" : "Marcar como publicado"}
            </button>
          </Step>

          <div className="rounded-lg bg-white/5 p-3 text-[11px] text-white/40">
            Publicación <b>asistida</b>: la subida automática por API oficial (YouTube/TikTok/Instagram)
            queda para un requisito futuro (necesita OAuth y apps aprobadas por cada plataforma).
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/10 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors"
          style={
            done
              ? { background: "var(--color-state-ok)", color: "#04120c" }
              : { background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }
          }
        >
          {done ? "✓" : n}
        </span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="pl-7">{children}</div>
    </div>
  );
}
