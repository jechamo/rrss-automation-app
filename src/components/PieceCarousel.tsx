"use client";

import { useState } from "react";
import type { ContentPiece } from "@/core/content/types";

const STATUS_COLOR: Record<string, string> = {
  borrador: "var(--color-state-pending)",
  generando: "var(--color-state-running)",
  listo: "var(--color-state-ok)",
  publicado: "var(--color-accent-2)",
  error: "var(--color-state-error)",
};

// REQ-009 — carrusel 360 (cover-flow) para revisar piezas de forma vistosa.
// El centro muestra un preview de vídeo; las tarjetas laterales rotan en 3D.
export function PieceCarousel({
  projectId,
  pieces,
  onSelect,
}: {
  projectId: string;
  pieces: ContentPiece[];
  onSelect?: (pieceId: string) => void;
}) {
  const [active, setActive] = useState(0);
  if (pieces.length === 0) return null;

  const clamp = (n: number) => Math.max(0, Math.min(pieces.length - 1, n));
  const asset = (pieceId: string, rel: string) =>
    `/api/content/${projectId}/${pieceId}/asset?path=${encodeURIComponent(rel)}`;

  return (
    <div className="coverflow relative">
      <div className="relative mx-auto h-72 w-full max-w-xl">
        {pieces.map((p, i) => {
          const offset = i - active;
          const abs = Math.abs(offset);
          if (abs > 2) return null;
          const isCenter = offset === 0;
          const preview = p.assets.recordingPath || p.assets.videoPath;
          const color = STATUS_COLOR[p.status] ?? STATUS_COLOR.borrador;
          return (
            <button
              key={p.id}
              onClick={() => {
                if (isCenter) onSelect?.(p.id);
                else setActive(i);
              }}
              className="coverflow-item glass absolute left-1/2 top-1/2 flex h-64 w-52 flex-col overflow-hidden text-left"
              style={{
                transform: `translate(-50%, -50%) translateX(${offset * 58}%) rotateY(${-offset * 34}deg) scale(${isCenter ? 1 : 0.82})`,
                opacity: isCenter ? 1 : 0.4,
                filter: isCenter ? "none" : "saturate(0.7)",
                zIndex: 10 - abs,
                cursor: "pointer",
              }}
            >
              <div className="relative flex-1 bg-gradient-to-br from-[var(--color-accent)]/30 via-black/40 to-[var(--color-accent-2)]/25">
                {isCenter && preview ? (
                  <video
                    key={preview}
                    className="h-full w-full object-cover"
                    src={asset(p.id, preview)}
                    muted
                    playsInline
                    preload="metadata"
                    controls
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl opacity-60">
                    {preview ? "▶" : "◇"}
                  </div>
                )}
                <span
                  className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ background: `${color}22`, color }}
                >
                  {p.status}
                </span>
                {p.origin === "own" && (
                  <span className="absolute right-2 top-2 rounded-full bg-[var(--color-accent-2)]/20 px-2 py-0.5 text-[10px] text-[var(--color-accent-2)]">
                    Propio
                  </span>
                )}
              </div>
              <div className="shrink-0 p-2">
                <div className="truncate text-xs font-semibold">
                  {p.titulo || p.content.guion.gancho || "(sin título)"}
                </div>
                <div className="mt-0.5 truncate text-[10px] text-white/40">{p.plataforma}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-center gap-3">
        <button
          onClick={() => setActive((a) => clamp(a - 1))}
          disabled={active === 0}
          className="rounded-full border border-white/15 px-3 py-1 text-sm hover:bg-white/5 disabled:opacity-30"
          aria-label="Anterior"
        >
          ‹
        </button>
        <div className="flex items-center gap-1.5">
          {pieces.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActive(i)}
              aria-label={`Ir a la pieza ${i + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === active ? 18 : 6,
                background: i === active ? "var(--color-accent-2)" : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>
        <button
          onClick={() => setActive((a) => clamp(a + 1))}
          disabled={active === pieces.length - 1}
          className="rounded-full border border-white/15 px-3 py-1 text-sm hover:bg-white/5 disabled:opacity-30"
          aria-label="Siguiente"
        >
          ›
        </button>
      </div>
    </div>
  );
}
