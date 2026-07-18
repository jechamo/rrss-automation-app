import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReq005Pipeline } from "@/core/pipeline/req005";
import { executeRun, initialNodeStatus } from "@/core/pipeline/engine";
import { coerceConfig, validateMediaConfig } from "@/core/content/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const sourceUrl = typeof (body as { sourceUrl?: unknown })?.sourceUrl === "string"
    ? (body as { sourceUrl: string }).sourceUrl
    : "";
  if (!sourceUrl) {
    return NextResponse.json({ error: "Falta la URL del viral a clonar." }, { status: 400 });
  }
  const config = coerceConfig((body as { config?: unknown })?.config ?? {});
  const configError = validateMediaConfig(config);
  if (configError) return NextResponse.json({ error: configError }, { status: 400 });

  const project = await prisma.project.findUnique({
    where: { id },
    include: { dossier: true, virales: true },
  });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  if (!project.dossier) {
    return NextResponse.json({ error: "Genera primero el dossier (REQ-001)." }, { status: 409 });
  }
  if (!project.virales) {
    return NextResponse.json(
      { error: "Genera primero los virales del nicho (REQ-004)." },
      { status: 409 },
    );
  }

  const piece = await prisma.contentPiece.create({
    data: {
      projectId: id,
      origin: "viral",
      sourceUrl,
      config: JSON.stringify(config),
      status: "borrador",
    },
  });

  const def = buildReq005Pipeline(piece.id);
  const run = await prisma.run.create({
    data: {
      projectId: id,
      requisito: "REQ-005",
      status: "pending",
      nodes: JSON.stringify(initialNodeStatus(def)),
    },
  });
  await prisma.contentPiece.update({ where: { id: piece.id }, data: { runId: run.id } });

  // Fire-and-forget: ejecuta y reconcilia el estado de la pieza si el run falla.
  void (async () => {
    try {
      await executeRun(run.id, def, {
        id: project.id,
        name: project.name,
        url: project.url,
        codeType: project.codeType,
        codePath: project.codePath,
      });
    } finally {
      const r = await prisma.run.findUnique({ where: { id: run.id } });
      if (r?.status === "error") {
        await prisma.contentPiece
          .update({ where: { id: piece.id }, data: { status: "error" } })
          .catch(() => {});
      }
    }
  })();

  return NextResponse.json({ runId: run.id, pieceId: piece.id });
}
