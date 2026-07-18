"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type RecentProject = {
  id: string;
  name: string;
  url: string;
  logoPath?: string | null;
  dossierStatus: "approved" | "draft" | null;
};

export function RecentProjects({ initial }: { initial: RecentProject[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initial);
  const [deleting, setDeleting] = useState<string | null>(null);

  if (projects.length === 0) return null;

  async function remove(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("¿Eliminar este analisis y su dossier?")) return;
    setDeleting(id);
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setDeleting(null);
    router.refresh();
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold text-white/60">Proyectos recientes</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p, i) => (
          <div
            key={p.id}
            className="glass card-lift animate-in group relative p-4"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <Link href={`/proyecto/${p.id}`} className="block">
              <div className="flex items-center justify-between gap-2 pr-6">
                <span className="truncate font-medium">{p.name}</span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                  style={
                    p.dossierStatus === "approved"
                      ? { background: "rgba(52,211,153,0.15)", color: "var(--color-state-ok)" }
                      : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }
                  }
                >
                  {p.dossierStatus ? (p.dossierStatus === "approved" ? "Aprobado" : "Borrador") : "Sin dossier"}
                </span>
              </div>
              <div className="mt-1 truncate text-xs text-white/40">{p.url}</div>
            </Link>
            <button
              onClick={(e) => remove(e, p.id)}
              disabled={deleting === p.id}
              title="Eliminar analisis"
              className="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-xs text-white/30 opacity-0 transition hover:bg-[var(--color-state-error)]/15 hover:text-[var(--color-state-error)] group-hover:opacity-100 disabled:opacity-40"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
