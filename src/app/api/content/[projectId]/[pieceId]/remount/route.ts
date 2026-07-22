import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildReq006RefreshPipeline,
  type NavigationRefreshMode,
} from "@/core/pipeline/req006-refresh";
import { executeRun, initialNodeStatus } from "@/core/pipeline/engine";

export const dynamic = "force-dynamic";

/** Regenera únicamente navegación + montaje; no invoca proveedores de media. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string; pieceId: string }> },
) {
  const { projectId, pieceId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { mode?: unknown };
  const mode: NavigationRefreshMode = body.mode === "auto" ? "auto" : "existing";
  const [project, piece] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.contentPiece.findFirst({ where: { id: pieceId, projectId } }),
  ]);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  if (!piece || piece.origin !== "own") {
    return NextResponse.json({ error: "Solo se puede remontar contenido propio de la app." }, { status: 404 });
  }
  if (piece.status === "generando") {
    return NextResponse.json({ error: "La pieza ya tiene una pipeline en curso." }, { status: 409 });
  }

  const def = buildReq006RefreshPipeline(pieceId, mode);
  const run = await prisma.run.create({
    data: {
      projectId,
      requisito: def.requisito,
      status: "pending",
      nodes: JSON.stringify(initialNodeStatus(def)),
    },
  });
  await prisma.contentPiece.update({
    where: { id: pieceId },
    data: { runId: run.id, status: "generando" },
  });

  void (async () => {
    try {
      await executeRun(run.id, def, {
        id: project.id,
        name: project.name,
        url: project.url,
        codeType: project.codeType,
        codePath: project.codePath,
        context: project.context,
      });
    } finally {
      const latestRun = await prisma.run.findUnique({ where: { id: run.id } });
      if (latestRun?.status === "error") {
        await prisma.contentPiece.update({ where: { id: pieceId }, data: { status: "error" } }).catch(() => {});
      }
    }
  })();

  return NextResponse.json({
    runId: run.id,
    pieceId,
    nodes: initialNodeStatus(def),
    mode,
  });
}

