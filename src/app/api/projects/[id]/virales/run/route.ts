import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReq004Pipeline } from "@/core/pipeline/req004";
import { executeRun, initialNodeStatus } from "@/core/pipeline/engine";
import { DEFAULT_CRITERIO } from "@/core/virales/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const rawVentana = (body as { ventanaDias?: unknown })?.ventanaDias;
  const ventanaDias = typeof rawVentana === "number" && rawVentana >= 0 ? rawVentana : DEFAULT_CRITERIO.ventanaDias;

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

  const def = buildReq004Pipeline(ventanaDias);
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

  return NextResponse.json({ runId: run.id });
}
