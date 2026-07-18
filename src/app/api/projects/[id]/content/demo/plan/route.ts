import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coerceDossier } from "@/core/dossier/types";
import {
  coerceConfig,
  coerceDemo,
  validateMediaConfig,
} from "@/core/content/types";
import { generateDemoGuion, type AppFuncion } from "@/core/content/demo";
import { effectiveClipLimit } from "@/core/media/planning";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** REQ-013: prepara el guion product-led y sus prompts sin consumir fal.ai. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as {
      demo?: unknown;
      config?: unknown;
    } | null;
    const demo = coerceDemo(body?.demo ?? {});
    if (!demo.funcion.trim()) {
      return NextResponse.json({ error: "Elige la funcionalidad a mostrar." }, { status: 400 });
    }
    const config = coerceConfig(body?.config ?? {});
    const configError = validateMediaConfig(config);
    if (configError) return NextResponse.json({ error: configError }, { status: 400 });
    if (config.rama !== "fal") {
      return NextResponse.json({ error: "La revisión de prompts solo aplica a fal.ai." }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id }, include: { dossier: true } });
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
    if (!project.dossier) {
      return NextResponse.json({ error: "Genera primero el dossier." }, { status: 409 });
    }

    const previousPieces = await prisma.contentPiece.findMany({
      where: { projectId: id, origin: "own" },
      select: { titulo: true, config: true },
    });
    const functionKey = demo.funcion.trim().toLocaleLowerCase("es");
    const previousCount = previousPieces.filter((previous) => {
      if (previous.titulo.trim().toLocaleLowerCase("es") === functionKey) return true;
      try {
        return coerceConfig(JSON.parse(previous.config)).demo?.funcion
          .trim()
          .toLocaleLowerCase("es") === functionKey;
      } catch {
        return false;
      }
    }).length;

    const funcion: AppFuncion = {
      nombre: demo.funcion,
      descripcion: demo.funcionDescripcion || demo.funcion,
      url: demo.funcionUrl,
      pasos: demo.pasos,
      navSteps: demo.navSteps,
      evidencias: demo.funcionEvidencias,
      confianza: demo.funcionConfianza,
    };
    const content = await generateDemoGuion({
      dossier: coerceDossier(JSON.parse(project.dossier.content)),
      funcion,
      plataforma: "youtube",
      previousCount,
      clipCount: effectiveClipLimit(config),
    });
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
