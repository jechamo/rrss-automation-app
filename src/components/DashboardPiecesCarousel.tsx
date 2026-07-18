"use client";

import { useRouter } from "next/navigation";
import { Carousel3D } from "@/components/Carousel3D";
import { CardArt } from "@/components/CardArt";
import type { ContentPiece } from "@/core/content/types";

const STATUS_COLOR: Record<string, string> = {
  borrador: "var(--color-state-pending)",
  generando: "var(--color-state-running)",
  listo: "var(--color-state-ok)",
  publicado: "var(--color-accent-2)",
  error: "var(--color-state-error)",
};

export type DashboardPiece = ContentPiece & {
  projectId: string;
  projectName: string;
};

export function DashboardPiecesCarousel({ pieces }: { pieces: DashboardPiece[] }) {
  const router = useRouter();

  if (pieces.length === 0) {
    return (
      <section className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-white/60">Piezas recientes</h2>
        <div className="glass relative overflow-hidden p-10 text-center">
          <CardArt
            name="empty-carousel.webp"
            fallback="linear-gradient(135deg, rgba(217,70,239,0.2), rgba(34,211,238,0.12))"
          />
          <p className="relative text-white/70">
            Aún no hay piezas. Abre un proyecto y genera la primera.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-sm font-semibold text-white/60">Piezas recientes</h2>
      <Carousel3D
        items={pieces}
        getKey={(piece) => piece.id}
        onSelectCenter={(piece) => router.push(`/proyecto/${piece.projectId}#contenido`)}
        renderCard={(piece, isCenter) => {
          const preview = piece.assets.videoPath || piece.assets.recordingPath;
          const color = STATUS_COLOR[piece.status] ?? STATUS_COLOR.borrador;
          const assetUrl = preview
            ? `/api/content/${piece.projectId}/${piece.id}/asset?path=${encodeURIComponent(preview)}`
            : "";

          return (
            <>
              <div className="relative flex flex-1 bg-gradient-to-br from-fuchsia-500/25 via-black/45 to-cyan-400/20">
                {isCenter && preview ? (
                  <video
                    key={preview}
                    className="h-full w-full object-cover"
                    src={assetUrl}
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl opacity-70">
                    {preview ? "▶" : "◇"}
                  </div>
                )}
                <span
                  className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ background: `${color}22`, color }}
                >
                  {piece.status}
                </span>
                <span className="absolute right-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white/60 backdrop-blur">
                  {piece.plataforma}
                </span>
              </div>
              <div className="shrink-0 p-2.5">
                <div className="truncate text-xs font-semibold">
                  {piece.titulo || piece.content.guion.gancho || "(sin título)"}
                </div>
                <div className="mt-0.5 truncate text-[10px] text-white/40">
                  {piece.projectName}
                </div>
              </div>
              {isCenter && (
                <div className="shrink-0 bg-fuchsia-500/80 py-1.5 text-center text-xs font-medium">
                  Ver en el proyecto →
                </div>
              )}
            </>
          );
        }}
      />
    </section>
  );
}
