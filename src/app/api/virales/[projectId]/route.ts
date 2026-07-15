import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coerceVirales } from "@/core/virales/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }

  const viralesRow = await prisma.virales.findUnique({ where: { projectId } });
  const lastRun = await prisma.run.findFirst({
    where: { projectId, requisito: "REQ-004" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, nodes: true },
  });

  return NextResponse.json({
    virales: viralesRow ? coerceVirales(JSON.parse(viralesRow.content)) : null,
    status: viralesRow?.status ?? "draft",
    version: viralesRow?.version ?? 0,
    updatedAt: viralesRow?.updatedAt ?? null,
    lastRun: lastRun ?? null,
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
  }

  const virales = coerceVirales((body as { virales?: unknown }).virales ?? body);
  const approve = (body as { approve?: boolean }).approve === true;

  const existing = await prisma.virales.findUnique({ where: { projectId } });
  if (!existing) {
    return NextResponse.json({ error: "Virales no encontrados." }, { status: 404 });
  }

  const updated = await prisma.virales.update({
    where: { projectId },
    data: {
      content: JSON.stringify(virales),
      status: approve ? "approved" : existing.status,
      version: { increment: 1 },
    },
  });

  return NextResponse.json({ status: updated.status, version: updated.version });
}
