import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReq001Pipeline } from "@/core/pipeline/req001";
import { executeRun, initialNodeStatus } from "@/core/pipeline/engine";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }

  const def = buildReq001Pipeline(project.codeType);
  const run = await prisma.run.create({
    data: {
      projectId: project.id,
      requisito: "REQ-001",
      status: "pending",
      nodes: JSON.stringify(initialNodeStatus(def)),
    },
  });

  void executeRun(run.id, def, {
    id: project.id,
    name: project.name,
    url: project.url,
    codeType: project.codeType,
    codePath: project.codePath,
  }).catch(() => {
    /* el estado de error se persiste dentro de executeRun */
  });

  return NextResponse.json({ runId: run.id });
}
