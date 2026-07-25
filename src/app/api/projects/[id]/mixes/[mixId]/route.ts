import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coerceAssets } from "@/core/content/types";
import { assetAbsPath } from "@/core/media/storage";
import { coerceMixRecipe, mixVideoCount } from "@/core/media/mix";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string; mixId: string }> }) {
  const { id, mixId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    useAsFinal?: unknown;
    name?: unknown;
    pieceId?: unknown;
    recipe?: unknown;
  } | null;
  const mix = await prisma.mixComposition.findFirst({ where: { id: mixId, projectId: id } });
  if (!mix) return NextResponse.json({ error: "MIX no encontrado." }, { status: 404 });
  if (body?.useAsFinal === true) {
    if (mix.status !== "ready" || !mix.outputPath) return NextResponse.json({ error: "El MIX todavía no está listo." }, { status: 409 });
    if (!mix.pieceId) return NextResponse.json({ error: "Este MIX no tiene pieza destino." }, { status: 409 });
    const piece = await prisma.contentPiece.findFirst({ where: { id: mix.pieceId, projectId: id } });
    if (!piece) return NextResponse.json({ error: "Pieza destino no encontrada." }, { status: 404 });
    const assets = coerceAssets(JSON.parse(piece.assets || "{}"));
    assets.videoPath = mix.outputPath;
    assets.logs.push(`MIX «${mix.name}» seleccionado como vídeo final.`);
    await prisma.contentPiece.update({ where: { id: piece.id }, data: { assets: JSON.stringify(assets), status: "listo", version: { increment: 1 } } });
    return NextResponse.json({ ok: true });
  }
  if (mix.status !== "draft") {
    return NextResponse.json({ error: "Solo los borradores pueden editarse." }, { status: 409 });
  }
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  const recipe = coerceMixRecipe(body?.recipe);
  const pieceId = typeof body?.pieceId === "string" && body.pieceId ? body.pieceId : null;
  if (!name) return NextResponse.json({ error: "Pon un nombre al borrador." }, { status: 400 });
  if (pieceId && !(await prisma.contentPiece.findFirst({ where: { id: pieceId, projectId: id }, select: { id: true } }))) {
    return NextResponse.json({ error: "Pieza destino no encontrada." }, { status: 404 });
  }
  const updated = await prisma.mixComposition.update({
    where: { id: mix.id },
    data: { name, pieceId, recipe: JSON.stringify(recipe), error: null },
  });
  return NextResponse.json({
    mix: {
      ...updated,
      recipe,
      isFinal: false,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
    videoCount: mixVideoCount(recipe),
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; mixId: string }> }) {
  const { id, mixId } = await ctx.params;
  const mix = await prisma.mixComposition.findFirst({ where: { id: mixId, projectId: id } });
  if (!mix) return NextResponse.json({ error: "MIX no encontrado." }, { status: 404 });
  if (mix.pieceId && mix.outputPath) {
    const piece = await prisma.contentPiece.findUnique({ where: { id: mix.pieceId } });
    if (piece && coerceAssets(JSON.parse(piece.assets || "{}")).videoPath === mix.outputPath) {
      return NextResponse.json({ error: "Este MIX es el vídeo final de una pieza. Cambia el final antes de eliminarlo." }, { status: 409 });
    }
  }
  if (mix.outputPath) {
    const media = await prisma.mediaAsset.findFirst({ where: { projectId: id, path: mix.outputPath } });
    if (media) await prisma.mediaAsset.delete({ where: { id: media.id } });
    try { const abs = assetAbsPath(mix.outputPath); if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch { /* best effort */ }
  }
  await prisma.mixComposition.delete({ where: { id: mixId } });
  return NextResponse.json({ ok: true });
}
