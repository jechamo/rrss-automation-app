import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReq002Pipeline } from "@/core/pipeline/req002";
import { executeRun, initialNodeStatus } from "@/core/pipeline/engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const modo = (body as { modo?: unknown })?.modo === "ampliar" ? "ampliar" : "reemplazar";
  const project = await prisma.project.findUnique({
    where: { id },
    include: { dossier: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }
  if (!project.dossier) {
    return NextResponse.json(
      { error: "Genera primero el dossier (REQ-001) antes de analizar la competencia." },
      { status: 409 },
    );
  }

  const def = buildReq002Pipeline({ modo });
  const run = await prisma.run.create({
    data: {
      projectId: project.id,
      requisito: "REQ-002",
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
