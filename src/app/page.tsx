import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RecentProjects } from "@/components/RecentProjects";

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
      <header className="hero glass-strong animate-in mb-8 p-8" style={{ animationDelay: "0ms" }}>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent-2)]" style={{ animation: "pulse 2s infinite" }} />
          Estudio local de contenido para RRSS
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Bienvenido a <span className="text-gradient">RRSS Studio</span>
        </h1>
        <p className="mt-3 max-w-xl text-white/60">
          Analiza tu appweb, estudia a la competencia y genera contenido para redes — todo en local.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/proyecto/nuevo"
            className="card-lift rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium"
          >
            Nuevo análisis →
          </Link>
          <Link
            href="/ajustes"
            className="card-lift rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
          >
            Ajustes
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Proyectos" value={projects} delay={60} />
        <Stat label="Piezas de contenido" value={pieces} delay={120} />
        <Stat label="Fase actual" value="REQ-009" delay={180} />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card
          href="/proyecto/nuevo"
          title="Analizar una appweb"
          desc="Dale una URL y (opcional) el codigo. Genera el dossier de negocio, marca, CTA y puntos de dolor."
          badge="REQ-001"
          cta="Nuevo analisis →"
          delay={240}
        />
        <Card
          href="/ajustes"
          title="Configurar conectores"
          desc="Motor de IA (Claude) y APIs (Gemini, fal.ai, HeyGen, ElevenLabs). Prueba cada conexion."
          badge="REQ-008"
          cta="Ir a Ajustes →"
          delay={300}
        />
      </section>

      <RecentProjects
        initial={recent.map((p) => ({
          id: p.id,
          name: p.name,
          url: p.url,
          dossierStatus: (p.dossier?.status as "approved" | "draft" | undefined) ?? null,
        }))}
      />
    </div>
  );
}

function Stat({ label, value, delay = 0 }: { label: string; value: string | number; delay?: number }) {
  return (
    <div className="glass card-lift animate-in p-4" style={{ animationDelay: `${delay}ms` }}>
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
  delay = 0,
}: {
  href: string;
  title: string;
  desc: string;
  badge: string;
  cta: string;
  delay?: number;
}) {
  return (
    <Link
      href={href}
      className="glass glow-border card-lift animate-in group p-5"
      style={{ animationDelay: `${delay}ms` }}
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
