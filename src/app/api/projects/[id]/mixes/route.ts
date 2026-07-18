import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assembleMix, coerceMixRecipe } from "@/core/media/mix";
import { registerMediaAsset } from "@/core/media/library";

export const dynamic = "force-dynamic";

function dto(row: { id: string; projectId: string; pieceId: string | null; name: string; status: string; recipe: string; outputPath: string | null; error: string | null; createdAt: Date; updatedAt: Date }) {
  return { ...row, recipe: coerceMixRecipe(JSON.parse(row.recipe || "{}")), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const mixes = await prisma.mixComposition.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ mixes: mixes.map(dto) });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { name?: unknown; pieceId?: unknown; recipe?: unknown } | null;
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  const recipe = coerceMixRecipe(body?.recipe);
  if (!name) return NextResponse.json({ error: "Pon un nombre al MIX." }, { status: 400 });
  if (!recipe.videoAssetIds.length) return NextResponse.json({ error: "Selecciona al menos un vídeo." }, { status: 400 });
  if (!recipe.subtitleText) return NextResponse.json({ error: "Escribe los subtítulos obligatorios." }, { status: 400 });
  const pieceId = typeof body?.pieceId === "string" && body.pieceId ? body.pieceId : null;
  if (pieceId && !(await prisma.contentPiece.findFirst({ where: { id: pieceId, projectId: id }, select: { id: true } }))) {
    return NextResponse.json({ error: "Pieza destino no encontrada." }, { status: 404 });
  }
  const mix = await prisma.mixComposition.create({
    data: { projectId: id, pieceId, name, status: "rendering", recipe: JSON.stringify(recipe) },
  });
  try {
    const outputPath = await assembleMix(id, mix.id, recipe);
    const updated = await prisma.mixComposition.update({ where: { id: mix.id }, data: { status: "ready", outputPath } });
    await registerMediaAsset({ projectId: id, pieceId, kind: "final", origin: "mix", name: `MIX · ${name}`, path: outputPath });
    return NextResponse.json({ mix: dto(updated) }, { status: 201 });
  } catch (error) {
    const failed = await prisma.mixComposition.update({ where: { id: mix.id }, data: { status: "error", error: (error as Error).message } });
    return NextResponse.json({ error: failed.error, mix: dto(failed) }, { status: 422 });
  }
}
