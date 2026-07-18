import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReq005Pipeline } from "@/core/pipeline/req005";
import { executeRun, initialNodeStatus } from "@/core/pipeline/engine";
import {
  coerceConfig,
  validateFalPromptReview,
  validateMediaConfig,
} from "@/core/content/types";
import { coerceVirales } from "@/core/virales/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const sourceUrl = typeof (body as { sourceUrl?: unknown })?.sourceUrl === "string"
    ? (body as { sourceUrl: string }).sourceUrl
    : "";
  if (!sourceUrl) {
    return NextResponse.json({ error: "Falta la URL del viral a clonar." }, { status: 400 });
  }
  const config = coerceConfig((body as { config?: unknown })?.config ?? {});
  const configError = validateMediaConfig(config);
  if (configError) return NextResponse.json({ error: configError }, { status: 400 });
  const reviewError = validateFalPromptReview(config, "viral");
  if (reviewError) return NextResponse.json({ error: reviewError }, { status: 400 });

  const project = await prisma.project.findUnique({
    where: { id },
    include: { dossier: true, virales: true },
  });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  if (!project.dossier) {
    return NextResponse.json({ error: "Genera primero el dossier (REQ-001)." }, { status: 409 });
  }
  if (!project.virales) {
    return NextResponse.json(
      { error: "Genera primero los virales del nicho (REQ-004)." },
      { status: 409 },
    );
  }
  const normalizedSource = sourceUrl.trim().toLowerCase().replace(/\/+$/, "");
  const virales = coerceVirales(JSON.parse(project.virales.content));
  const selectedViral = virales.virales.find(
    (viral) => viral.url.trim().toLowerCase().replace(/\/+$/, "") === normalizedSource,
  );
  if (!selectedViral) {
    return NextResponse.json(
      { error: "El viral seleccionado ya no está disponible. Actualiza la lista de virales." },
      { status: 409 },
    );
  }

  const piece = await prisma.contentPiece.create({
    data: {
      projectId: id,
      origin: "viral",
      sourceUrl,
      titulo: selectedViral.titulo,
      plataforma: selectedViral.plataforma,
      config: JSON.stringify(config),
      status: "generando",
    },
  });

  const def = buildReq005Pipeline(piece.id);
  const run = await prisma.run.create({
    data: {
      projectId: id,
      requisito: "REQ-005",
      status: "pending",
      nodes: JSON.stringify(initialNodeStatus(def)),
    },
  });
  await prisma.contentPiece.update({
    where: { id: piece.id },
    data: { runId: run.id, status: "generando" },
  });

  // Fire-and-forget: ejecuta y reconcilia el estado de la pieza si el run falla.
  void (async () => {
    try {
      await executeRun(run.id, def, {
        id: project.id,
        name: project.name,
        url: project.url,
        codeType: project.codeType,
        codePath: project.codePath,
      });
    } finally {
      const r = await prisma.run.findUnique({ where: { id: run.id } });
      if (r?.status === "error") {
        await prisma.contentPiece
          .update({ where: { id: piece.id }, data: { status: "error" } })
          .catch(() => {});
      }
    }
  })();

  return NextResponse.json({
    runId: run.id,
    pieceId: piece.id,
    nodes: initialNodeStatus(def),
    plataforma: selectedViral.plataforma,
    titulo: selectedViral.titulo,
  });
}
