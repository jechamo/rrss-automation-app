import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      dossier: true,
      runs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ project, lastRun: project.runs[0] ?? null });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await prisma.project.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar (¿ya no existe?)." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
