"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Navegación global: SOLO rutas que existen de verdad.
const NAV: { href: string; label: string; icon: string }[] = [
  { href: "/", label: "Dashboard", icon: "◈" },
  { href: "/proyecto/nuevo", label: "Nuevo análisis", icon: "❖" },
  { href: "/ajustes", label: "Ajustes", icon: "⚙" },
];

// Secciones dentro de un proyecto (anclas de la página /proyecto/[id]).
const PROJECT_SECTIONS: { anchor: string; label: string }[] = [
  { anchor: "pipeline", label: "Pipeline" },
  { anchor: "dossier", label: "Dossier" },
  { anchor: "competencia", label: "Competencia" },
  { anchor: "leads", label: "Leads" },
  { anchor: "virales", label: "Virales" },
  { anchor: "contenido", label: "Contenido" },
];

export function Sidebar() {
  const pathname = usePathname();
  // ¿Estamos dentro de un proyecto concreto? (/proyecto/<id>, no /proyecto/nuevo)
  const inProject =
    pathname.startsWith("/proyecto/") && pathname !== "/proyecto/nuevo";
  const projectId = inProject ? pathname.split("/")[2] : null;

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-white/10 bg-black/20 p-4 backdrop-blur">
      <Link href="/" className="px-2 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/logo-lockup.png" alt="LeadView" className="w-full max-w-[180px]" />
        <div className="mt-1 text-xs text-white/40">Automatización de contenido RRSS</div>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                active
                  ? "bg-white/10 text-white glow-border"
                  : "text-white/60 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              <span className="text-base opacity-80">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {inProject && projectId && (
        <div>
          <div className="px-3 pb-2 text-[11px] uppercase tracking-wide text-white/30">
            Secciones del proyecto
          </div>
          <nav className="flex flex-col gap-1">
            {PROJECT_SECTIONS.map((s) => (
              <a
                key={s.anchor}
                href={`/proyecto/${projectId}#${s.anchor}`}
                className="group flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-white/55 transition hover:bg-white/5 hover:text-white"
              >
                <span className="text-xs opacity-50">◦</span>
                <span className="flex-1">{s.label}</span>
              </a>
            ))}
          </nav>
        </div>
      )}

      <div className="mt-auto px-2 text-[11px] text-white/30">
        Proyecto activo
        <div className="mt-1 truncate rounded-lg border border-white/10 px-2 py-1.5 text-white/60">
          {inProject ? "En este proyecto" : "— sin proyecto —"}
        </div>
      </div>
    </aside>
  );
}
