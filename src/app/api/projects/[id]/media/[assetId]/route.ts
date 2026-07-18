import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assetAbsPath } from "@/core/media/storage";
import { mediaDto } from "@/core/media/library";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  const existing = await prisma.mediaAsset.findFirst({ where: { id: assetId, projectId: id } });
  if (!existing) return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
  const asset = await prisma.mediaAsset.update({ where: { id: assetId }, data: { name } });
  return NextResponse.json({ asset: mediaDto(asset) });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await ctx.params;
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, projectId: id } });
  if (!asset) return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
  if (asset.pieceId) {
    return NextResponse.json({ error: "Este recurso pertenece a una pieza. Elimina o regenera esa pieza primero." }, { status: 409 });
  }
  const pieceUsingPath = await prisma.contentPiece.findFirst({
    where: { projectId: id, assets: { contains: asset.path } },
    select: { titulo: true },
  });
  if (pieceUsingPath) {
    return NextResponse.json({ error: `Este recurso está adjunto a la pieza «${pieceUsingPath.titulo || "Sin título"}».` }, { status: 409 });
  }
  const used = await prisma.mixComposition.findFirst({ where: { projectId: id, recipe: { contains: assetId } } });
  if (used) return NextResponse.json({ error: `El recurso se usa en el MIX «${used.name}».` }, { status: 409 });
  try {
    const abs = assetAbsPath(asset.path);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar el fichero local." }, { status: 500 });
  }
  await prisma.mediaAsset.delete({ where: { id: assetId } });
  return NextResponse.json({ ok: true });
}
