import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rowToPiece } from "@/core/content/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;

  const rows = await prisma.contentPiece.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  const pieces = rows.map(rowToPiece);

  // Runs referenciados por las piezas (para restaurar el grafo de generacion).
  const runIds = rows.map((r) => r.runId).filter((x): x is string => !!x);
  const runs = runIds.length
    ? await prisma.run.findMany({
        where: { id: { in: runIds } },
        select: { id: true, requisito: true, status: true, nodes: true, logs: true, updatedAt: true },
      })
    : [];
  const runMap: Record<string, {
    requisito: string;
    status: string;
    nodes: string;
    logs: string | null;
    updatedAt: string;
  }> = {};
  for (const r of runs) {
    runMap[r.id] = {
      requisito: r.requisito,
      status: r.status,
      nodes: r.nodes,
      logs: r.logs,
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  return NextResponse.json({ pieces, runs: runMap });
}
