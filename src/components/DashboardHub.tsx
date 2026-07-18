"use client";

import { useState } from "react";
import Link from "next/link";
import { CardArt } from "@/components/CardArt";
import { DashboardPiecesCarousel, type DashboardPiece } from "@/components/DashboardPiecesCarousel";
import { ProjectsCarousel } from "@/components/ProjectsCarousel";
import type { RecentProject } from "@/components/RecentProjects";

type DashboardView = "projects" | "pieces";

export function DashboardHub({
  projects,
  pieces,
  projectCount,
  pieceCount,
}: {
  projects: RecentProject[];
  pieces: DashboardPiece[];
  projectCount: number;
  pieceCount: number;
}) {
  const [view, setView] = useState<DashboardView>("projects");

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/proyecto/nuevo"
          className="card-lift inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-3.5 py-2 text-sm font-medium"
        >
          <span aria-hidden>＋</span>
          Nuevo análisis
        </Link>
        <Link
          href="/ajustes"
          className="card-lift inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-sm text-white/75 hover:bg-white/10"
        >
          <span aria-hidden>⚙</span>
          Ajustes
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Vista del dashboard">
        <ViewCard
          active={view === "projects"}
          title="Proyectos"
          count={projectCount}
          description="Análisis, dossier y estrategia de cada app."
          image="dashboard-projects.webp"
          fallback="linear-gradient(135deg, rgba(34,211,238,0.24), rgba(124,58,237,0.2))"
          onClick={() => setView("projects")}
        />
        <ViewCard
          active={view === "pieces"}
          title="Piezas de contenido"
          count={pieceCount}
          description="Vídeos creados y listos para revisar."
          image="dashboard-pieces.webp"
          fallback="linear-gradient(135deg, rgba(217,70,239,0.24), rgba(34,211,238,0.16))"
          onClick={() => setView("pieces")}
        />
      </section>

      <div key={view} className="animate-in">
        {view === "projects" ? (
          <ProjectsCarousel projects={projects} />
        ) : (
          <DashboardPiecesCarousel pieces={pieces} />
        )}
      </div>
    </>
  );
}

function ViewCard({
  active,
  title,
  count,
  description,
  image,
  fallback,
  onClick,
}: {
  active: boolean;
  title: string;
  count: number;
  description: string;
  image: string;
  fallback: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "card-lift group relative min-h-44 overflow-hidden rounded-2xl border p-5 text-left transition",
        active
          ? "border-[var(--color-accent-2)] shadow-[0_0_30px_rgba(34,211,238,0.16)]"
          : "border-white/10 opacity-75 hover:opacity-100",
      ].join(" ")}
    >
      <CardArt name={image} fallback={fallback} overlay={false} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/5" />
      <div className="relative flex h-full max-w-[62%] flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-semibold tabular-nums">{count}</span>
            {active && (
              <span className="rounded-full border border-[var(--color-accent-2)]/40 bg-[var(--color-accent-2)]/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-accent-2)]">
                Vista activa
              </span>
            )}
          </div>
          <h2 className="mt-3 text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/55">{description}</p>
        </div>
        <span className="mt-4 text-xs font-medium text-[var(--color-accent-2)]">
          {active ? "Explorando ahora" : "Mostrar carrusel →"}
        </span>
      </div>
    </button>
  );
}
