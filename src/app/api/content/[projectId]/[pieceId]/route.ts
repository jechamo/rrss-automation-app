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
