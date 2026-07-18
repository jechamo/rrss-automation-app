"use client";

import { Carousel3D } from "@/components/Carousel3D";
import type { ContentPiece } from "@/core/content/types";

const STATUS_COLOR: Record<string, string> = {
  borrador: "var(--color-state-pending)",
  generando: "var(--color-state-running)",
  listo: "var(--color-state-ok)",
  publicado: "var(--color-accent-2)",
  error: "var(--color-state-error)",
};

// REQ-009 — carrusel 360 (cover-flow) para revisar piezas. Ahora sobre el
// Carousel3D genérico; la card central muestra un preview de vídeo.
export function PieceCarousel({
  projectId,
  pieces,
  onSelect,
}: {
  projectId: string;
  pieces: ContentPiece[];
  onSelect?: (pieceId: string) => void;
}) {
  const asset = (pieceId: string, rel: string) =>
    `/api/content/${projectId}/${pieceId}/asset?path=${encodeURIComponent(rel)}`;

  return (
    <Carousel3D
      items={pieces}
      getKey={(p) => p.id}
      onSelectCenter={(p) => onSelect?.(p.id)}
      renderCard={(p, isCenter) => {
        // El montaje final tiene prioridad; recordingPath queda como fallback
        // para piezas propias antiguas o pendientes de FFmpeg.
        const preview = p.assets.videoPath || p.assets.recordingPath;
        const color = STATUS_COLOR[p.status] ?? STATUS_COLOR.borrador;
        return (
          <>
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
          </>
        );
      }}
    />
  );
}
