import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coerceDossier } from "@/core/dossier/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const dossier = await prisma.dossier.findUnique({ where: { projectId } });
  if (!dossier) {
    return NextResponse.json({ error: "Dossier no disponible todavia." }, { status: 404 });
  }
  return NextResponse.json({
    dossier: coerceDossier(JSON.parse(dossier.content)),
    status: dossier.status,
    version: dossier.version,
    updatedAt: dossier.updatedAt,
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
  }

  const dossier = coerceDossier((body as { dossier?: unknown }).dossier ?? body);
  const approve = (body as { approve?: boolean }).approve === true;

  const existing = await prisma.dossier.findUnique({ where: { projectId } });
  if (!existing) {
    return NextResponse.json({ error: "Dossier no encontrado." }, { status: 404 });
  }

  const updated = await prisma.dossier.update({
    where: { projectId },
    data: {
      content: JSON.stringify(dossier),
      status: approve ? "approved" : existing.status,
      version: { increment: 1 },
    },
  });

  // Persistimos el nicho en el proyecto para alimentar los siguientes requisitos.
  if (dossier.nicho) {
    await prisma.project.update({ where: { id: projectId }, data: { niche: dossier.nicho } });
  }

  return NextResponse.json({ status: updated.status, version: updated.version });
}
