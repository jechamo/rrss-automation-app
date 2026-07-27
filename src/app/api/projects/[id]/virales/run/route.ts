import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReq004Pipeline } from "@/core/pipeline/req004";
import { executeRun, initialNodeStatus } from "@/core/pipeline/engine";
import {
  DEFAULT_CRITERIO,
  type ViralDiscoverySource,
  type ViralEnrichmentLevel,
} from "@/core/virales/types";
import { hasSecret } from "@/core/secrets/vault";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const rawVentana = (body as { ventanaDias?: unknown })?.ventanaDias;
  const ventanaDias = typeof rawVentana === "number" && rawVentana >= 0 ? rawVentana : DEFAULT_CRITERIO.ventanaDias;
  const modo = (body as { modo?: unknown })?.modo === "ampliar" ? "ampliar" : "reemplazar";
  const rawCant = (body as { cantidad?: unknown })?.cantidad;
  const cantidad = typeof rawCant === "number" && rawCant > 0 ? rawCant : undefined;
  const rawFuente = (body as { fuente?: unknown })?.fuente;
  const fuente: ViralDiscoverySource =
    rawFuente === "scrapecreators" || rawFuente === "hybrid" ? rawFuente : "web";
  const rawNivel = (body as { nivel?: unknown })?.nivel;
  const nivel: ViralEnrichmentLevel = rawNivel === "preciso" ? "preciso" : "rapido";
  const rawMaxCreditos = (body as { maxCreditos?: unknown })?.maxCreditos;
  const maxCreditos =
    typeof rawMaxCreditos === "number"
      ? Math.max(3, Math.min(100, Math.floor(rawMaxCreditos)))
      : undefined;

  const project = await prisma.project.findUnique({
    where: { id },
    include: { dossier: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }
  if (!project.dossier) {
    return NextResponse.json(
      { error: "Genera primero el dossier (REQ-001) antes de buscar virales del nicho." },
      { status: 409 },
    );
  }
  if (fuente !== "web" && !hasSecret("scrapecreators")) {
    return NextResponse.json(
      { error: "Configura primero la API key de Scrape Creators en Ajustes." },
      { status: 409 },
    );
  }

  const def = buildReq004Pipeline({
    ventanaDias,
    modo,
    cantidad,
    fuente,
    nivel,
    maxCreditos,
  });
  const run = await prisma.run.create({
    data: {
      projectId: project.id,
      requisito: "REQ-004",
      status: "pending",
      nodes: JSON.stringify(initialNodeStatus(def)),
    },
  });

  // Fire-and-forget: se ejecuta en el servidor local y emite eventos por SSE.
  void executeRun(run.id, def, {
    id: project.id,
    name: project.name,
    url: project.url,
    codeType: project.codeType,
    codePath: project.codePath,
  }).catch(() => {
    /* el estado de error ya se persiste dentro de executeRun */
  });

  return NextResponse.json({ runId: run.id, fuente, nivel, maxCreditos });
}
