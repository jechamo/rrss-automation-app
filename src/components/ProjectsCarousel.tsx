"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Carousel3D } from "@/components/Carousel3D";
import { EntityLogo } from "@/components/EntityLogo";
import { CardArt } from "@/components/CardArt";
import type { RecentProject } from "@/components/RecentProjects";

// Dashboard: carrusel 360 de proyectos. La card central navega al proyecto.
export function ProjectsCarousel({ projects }: { projects: RecentProject[] }) {
  const router = useRouter();

  if (projects.length === 0) {
    return (
      <section className="mt-10">
        <h2 className="mb-4 text-sm font-semibold text-white/60">Tus proyectos</h2>
        <div className="glass relative flex flex-col items-center gap-4 overflow-hidden p-10 text-center">
          <CardArt name="empty-carousel.webp" fallback="linear-gradient(135deg, rgba(124,58,237,0.25), rgba(34,211,238,0.15))" />
          <p className="relative text-white/70">Aún no tienes proyectos. Crea tu primer análisis para empezar.</p>
          <Link
            href="/proyecto/nuevo"
            className="relative rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium"
          >
            Nuevo análisis →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-sm font-semibold text-white/60">Tus proyectos</h2>
      <Carousel3D
        items={projects}
        getKey={(p) => p.id}
        onSelectCenter={(p) => router.push(`/proyecto/${p.id}`)}
        renderCard={(p, isCenter) => {
          const approved = p.dossierStatus === "approved";
          return (
            <>
              <div className="relative flex flex-1 flex-col items-center justify-center gap-3 bg-gradient-to-br from-[var(--color-accent)]/30 via-black/50 to-[var(--color-accent-2)]/25 p-4">
                <div className={isCenter ? "float" : ""}>
                  <EntityLogo name={p.name} web={p.url} size={64} />
                </div>
                <div className="text-center">
                  <div className="line-clamp-2 text-sm font-semibold">{p.name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-white/40">
                    {p.url.replace(/^https?:\/\//, "")}
                  </div>
                </div>
                <span
                  className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px]"
                  style={
                    approved
                      ? { background: "rgba(52,211,153,0.15)", color: "var(--color-state-ok)" }
                      : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }
                  }
                >
                  {p.dossierStatus ? (approved ? "Aprobado" : "Borrador") : "Sin dossier"}
                </span>
              </div>
              {isCenter && (
                <div className="shrink-0 bg-[var(--color-accent)]/90 py-1.5 text-center text-xs font-medium">
                  Abrir proyecto →
                </div>
              )}
            </>
          );
        }}
      />
    </section>
  );
}
