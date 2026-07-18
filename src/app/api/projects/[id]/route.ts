import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Editar la fuente de código de un proyecto ya creado (REQ-006 A4): permite
// corregir/añadir la ruta local o el repo sin recrear el proyecto.
const putSchema = z.object({
  codeType: z.enum(["local", "github_public", "github_private", "none"]),
  codePath: z.string().optional(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      dossier: true,
      // Solo el ultimo run de REQ-001: la Competencia (REQ-002) gestiona su
      // propio lastRun via /api/competencia/[projectId].
      runs: { where: { requisito: "REQ-001" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ project, lastRun: project.runs[0] ?? null });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos", issues: parsed.error.issues }, { status: 400 });
  }
  const { codeType, codePath } = parsed.data;
  const needsPath = codeType === "local" || codeType.startsWith("github");
  if (needsPath && !codePath?.trim()) {
    return NextResponse.json({ error: "Falta la ruta/URL del codigo." }, { status: 400 });
  }

  try {
    const project = await prisma.project.update({
      where: { id },
      data: { codeType, codePath: needsPath ? codePath!.trim() : null },
    });
    return NextResponse.json({ project });
  } catch {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }
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
