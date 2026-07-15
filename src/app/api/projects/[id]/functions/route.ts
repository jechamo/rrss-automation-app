import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coerceDossier } from "@/core/dossier/types";
import { analyzeFunctions } from "@/core/content/demo";

export const dynamic = "force-dynamic";

// REQ-006: la IA propone funcionalidades demostrables de la app (a partir del dossier).
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id }, include: { dossier: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  if (!project.dossier) {
    return NextResponse.json({ error: "Genera primero el dossier (REQ-001)." }, { status: 409 });
  }

  try {
    const dossier = coerceDossier(JSON.parse(project.dossier.content));
    const funciones = await analyzeFunctions({ dossier, appUrl: project.url });
    return NextResponse.json({ funciones });
  } catch (e) {
    return NextResponse.json({ funciones: [], error: (e as Error).message });
  }
}
