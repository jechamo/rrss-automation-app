import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [projects, pieces, recent] = await Promise.all([
    prisma.project.count(),
    prisma.contentPiece.count(),
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { dossier: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Bienvenido a <span className="text-gradient">RRSS Studio</span>
        </h1>
        <p className="mt-2 text-white/50">
          Analiza tu appweb, estudia a la competencia y genera contenido para redes — todo en local.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Proyectos" value={projects} />
        <Stat label="Piezas de contenido" value={pieces} />
        <Stat label="Fase actual" value="REQ-001" />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card
          href="/proyecto/nuevo"
          title="Analizar una appweb"
          desc="Dale una URL y (opcional) el codigo. Genera el dossier de negocio, marca, CTA y puntos de dolor."
          badge="REQ-001"
          cta="Nuevo analisis →"
        />
        <Card
          href="/ajustes"
          title="Configurar conectores"
          desc="Motor de IA (Claude) y APIs (Gemini, fal.ai, HeyGen, ElevenLabs). Prueba cada conexion."
          badge="REQ-008"
          cta="Ir a Ajustes →"
        />
      </section>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-white/60">Proyectos recientes</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((p) => (
              <Link
                key={p.id}
                href={`/proyecto/${p.id}`}
                className="glass group p-4 transition hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{p.name}</span>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                    style={
                      p.dossier?.status === "approved"
                        ? { background: "rgba(52,211,153,0.15)", color: "var(--color-state-ok)" }
                        : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }
                    }
                  >
                    {p.dossier ? (p.dossier.status === "approved" ? "Aprobado" : "Borrador") : "Sin dossier"}
                  </span>
                </div>
                <div className="mt-1 truncate text-xs text-white/40">{p.url}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass p-4">
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Card({
  href,
  title,
  desc,
  badge,
  cta,
}: {
  href: string;
  title: string;
  desc: string;
  badge: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="glass glow-border group p-5 transition hover:bg-white/[0.06]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/40">
          {badge}
        </span>
      </div>
      <p className="mt-2 text-sm text-white/50">{desc}</p>
      <div className="mt-4 text-sm text-[var(--color-accent-2)] group-hover:translate-x-0.5 transition">
        {cta}
      </div>
    </Link>
  );
}
