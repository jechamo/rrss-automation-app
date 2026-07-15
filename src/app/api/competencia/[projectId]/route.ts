import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coerceCompetencia } from "@/core/competencia/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }

  const competencia = await prisma.competencia.findUnique({ where: { projectId } });
  const lastRun = await prisma.run.findFirst({
    where: { projectId, requisito: "REQ-002" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, nodes: true },
  });

  return NextResponse.json({
    competencia: competencia ? coerceCompetencia(JSON.parse(competencia.content)) : null,
    status: competencia?.status ?? "draft",
    version: competencia?.version ?? 0,
    updatedAt: competencia?.updatedAt ?? null,
    lastRun: lastRun ?? null,
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
  }

  const competencia = coerceCompetencia((body as { competencia?: unknown }).competencia ?? body);
  const approve = (body as { approve?: boolean }).approve === true;

  const existing = await prisma.competencia.findUnique({ where: { projectId } });
  if (!existing) {
    return NextResponse.json({ error: "Competencia no encontrada." }, { status: 404 });
  }

  const updated = await prisma.competencia.update({
    where: { projectId },
    data: {
      content: JSON.stringify(competencia),
      status: approve ? "approved" : existing.status,
      version: { increment: 1 },
    },
  });

  return NextResponse.json({ status: updated.status, version: updated.version });
}
