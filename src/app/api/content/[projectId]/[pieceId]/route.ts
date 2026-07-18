import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coerceContent, coerceAssets, rowToPiece, type PieceStatus } from "@/core/content/types";

export const dynamic = "force-dynamic";

const VALID_STATUS: PieceStatus[] = ["borrador", "generando", "listo", "publicado", "error"];

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string; pieceId: string }> },
) {
  const { projectId, pieceId } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
  }

  const existing = await prisma.contentPiece.findFirst({ where: { id: pieceId, projectId } });
  if (!existing) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });

  const data: { status?: string; content?: string; titulo?: string; assets?: string } = {};
  const status = (body as { status?: unknown }).status;
  if (typeof status === "string" && VALID_STATUS.includes(status as PieceStatus)) {
    data.status = status;
  }
  const content = (body as { content?: unknown }).content;
  if (content && typeof content === "object") {
    data.content = JSON.stringify(coerceContent(content));
  }
  const titulo = (body as { titulo?: unknown }).titulo;
  if (typeof titulo === "string") data.titulo = titulo;

  // REQ-010: al marcar publicado, se registra la red destino y la fecha en assets.
  const publishedTo = (body as { publishedTo?: unknown }).publishedTo;
  if (typeof publishedTo === "string" && publishedTo) {
    const assets = coerceAssets(JSON.parse(existing.assets || "{}"));
    assets.publishedTo = publishedTo;
    assets.publishedAt = new Date().toISOString();
    data.assets = JSON.stringify(assets);
  }

  // REQ-011: reutiliza una grabación libre de la mediateca sin copiar ni borrar el original.
  const recordingAssetId = (body as { recordingAssetId?: unknown }).recordingAssetId;
  if (typeof recordingAssetId === "string" && recordingAssetId) {
    const media = await prisma.mediaAsset.findFirst({
      where: { id: recordingAssetId, projectId, kind: { in: ["recording", "video", "clip"] } },
    });
    if (!media) return NextResponse.json({ error: "Grabación de mediateca no encontrada." }, { status: 404 });
    const assets = coerceAssets(JSON.parse(existing.assets || "{}"));
    assets.recordingPath = media.path;
    data.assets = JSON.stringify(assets);
  }
  if ((body as { clearRecording?: unknown }).clearRecording === true) {
    const assets = coerceAssets(JSON.parse(existing.assets || "{}"));
    if (assets.videoPath === assets.recordingPath) assets.videoPath = "";
    assets.recordingPath = "";
    data.assets = JSON.stringify(assets);
  }

  const updated = await prisma.contentPiece.update({ where: { id: pieceId }, data });
  return NextResponse.json({ piece: rowToPiece(updated) });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ projectId: string; pieceId: string }> },
) {
  const { projectId, pieceId } = await ctx.params;
  const existing = await prisma.contentPiece.findFirst({ where: { id: pieceId, projectId } });
  if (!existing) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
  await prisma.contentPiece.delete({ where: { id: pieceId } });
  return NextResponse.json({ ok: true });
}
