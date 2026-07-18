import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReq006Pipeline } from "@/core/pipeline/req006";
import { executeRun, initialNodeStatus } from "@/core/pipeline/engine";
import { coerceConfig, coerceDemo, validateMediaConfig } from "@/core/content/types";

export const dynamic = "force-dynamic";

// REQ-006: crea una pieza de contenido PROPIO (origin="own") y lanza el pipeline.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { config?: unknown; demo?: unknown } | null;

  const demo = coerceDemo((body?.demo as unknown) ?? {});
  if (!demo.funcion.trim()) {
    return NextResponse.json({ error: "Elige la funcionalidad a mostrar." }, { status: 400 });
  }
  const config = coerceConfig((body?.config as unknown) ?? {});
  const configError = validateMediaConfig(config);
  if (configError) return NextResponse.json({ error: configError }, { status: 400 });
  config.demo = demo;

  const project = await prisma.project.findUnique({ where: { id }, include: { dossier: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  if (!project.dossier) {
    return NextResponse.json({ error: "Genera primero el dossier (REQ-001)." }, { status: 409 });
  }

  const previousPieces = await prisma.contentPiece.findMany({
    where: { projectId: id, origin: "own" },
    select: { titulo: true, config: true },
  });
  const functionKey = demo.funcion.trim().toLocaleLowerCase("es");
  demo.videosPrevios = previousPieces.filter((previous) => {
    if (previous.titulo.trim().toLocaleLowerCase("es") === functionKey) return true;
    try {
      const previousDemo = coerceConfig(JSON.parse(previous.config)).demo;
      return previousDemo?.funcion.trim().toLocaleLowerCase("es") === functionKey;
    } catch {
      return false;
    }
  }).length;

  const piece = await prisma.contentPiece.create({
    data: {
      projectId: id,
      origin: "own",
      sourceUrl: demo.funcionUrl || project.url,
      titulo: demo.funcion,
      config: JSON.stringify(config),
      status: "borrador",
    },
  });

  const def = buildReq006Pipeline(piece.id);
  const run = await prisma.run.create({
    data: {
      projectId: id,
      requisito: "REQ-006",
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
