import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coerceDossier } from "@/core/dossier/types";
import { coerceVirales } from "@/core/virales/types";
import { coerceConfig, validateMediaConfig } from "@/core/content/types";
import { extractViral } from "@/core/content/extract";
import { generateGuion } from "@/core/content/guion";
import { effectiveClipLimit } from "@/core/media/planning";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function normUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

/** REQ-013: prepara guion/prompts sin llamar a fal.ai ni crear una pieza. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as {
      sourceUrl?: unknown;
      config?: unknown;
    } | null;
    const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl : "";
    if (!sourceUrl) {
      return NextResponse.json({ error: "Falta la URL del viral." }, { status: 400 });
    }
    const config = coerceConfig(body?.config ?? {});
    const configError = validateMediaConfig(config);
    if (configError) return NextResponse.json({ error: configError }, { status: 400 });
    if (config.rama !== "fal") {
      return NextResponse.json({ error: "La revisión de prompts solo aplica a fal.ai." }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: { dossier: true, virales: true },
    });
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
    if (!project.dossier || !project.virales) {
      return NextResponse.json(
        { error: "Genera primero el dossier y los virales del nicho." },
        { status: 409 },
      );
    }

    const dossier = coerceDossier(JSON.parse(project.dossier.content));
    const virales = coerceVirales(JSON.parse(project.virales.content));
    const viral = virales.virales.find((item) => normUrl(item.url) === normUrl(sourceUrl));
    if (!viral) {
      return NextResponse.json({ error: "El viral seleccionado ya no está disponible." }, { status: 409 });
    }

    const extract = await extractViral({ viral, dossier, config, log: () => {} });
    const content = await generateGuion({
      dossier,
      extract,
      plataforma: viral.plataforma,
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
