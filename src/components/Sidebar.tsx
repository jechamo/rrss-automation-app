"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string; icon: string; hint?: string }[] = [
  { href: "/", label: "Dashboard", icon: "◈" },
  { href: "/proyecto", label: "Proyecto", icon: "❖", hint: "REQ-001" },
  { href: "/analisis", label: "Analisis", icon: "◎", hint: "REQ-002/003" },
  { href: "/rrss", label: "RRSS", icon: "✦", hint: "REQ-004/005/006" },
  { href: "/historial", label: "Historial", icon: "☰" },
  { href: "/skills", label: "Skills", icon: "✧", hint: "REQ-007" },
  { href: "/ajustes", label: "Ajustes", icon: "⚙", hint: "REQ-008" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-white/10 p-4 flex flex-col gap-6 bg-black/20 backdrop-blur">
      <div className="px-2">
        <div className="text-lg font-bold tracking-tight text-gradient">RRSS Studio</div>
        <div className="text-xs text-white/40">Automatizacion de contenido</div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
              {item.hint && (
                <span className="text-[10px] text-white/30 group-hover:text-white/50">
                  {item.hint}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-2 text-[11px] text-white/30">
        Proyecto activo
        <div className="mt-1 rounded-lg border border-white/10 px-2 py-1.5 text-white/60">
          — sin proyecto —
        </div>
      </div>
    </aside>
  );
}
