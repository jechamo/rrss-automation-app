import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coerceMixRecipe, mixVideoCount } from "@/core/media/mix";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    pieceId?: unknown;
    recipe?: unknown;
  } | null;
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  const pieceId = typeof body?.pieceId === "string" && body.pieceId ? body.pieceId : null;
  const recipe = coerceMixRecipe(body?.recipe);
  if (!name) return NextResponse.json({ error: "Pon un nombre al borrador." }, { status: 400 });
  if (pieceId && !(await prisma.contentPiece.findFirst({ where: { id: pieceId, projectId: id }, select: { id: true } }))) {
    return NextResponse.json({ error: "Pieza destino no encontrada." }, { status: 404 });
  }
  const draft = await prisma.mixComposition.create({
    data: {
      projectId: id,
      pieceId,
      name,
      status: "draft",
      recipe: JSON.stringify(recipe),
    },
  });
  return NextResponse.json({
    mix: {
      ...draft,
      recipe,
      isFinal: false,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    },
    videoCount: mixVideoCount(recipe),
  }, { status: 201 });
}
