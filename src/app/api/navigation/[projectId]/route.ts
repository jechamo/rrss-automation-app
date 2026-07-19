import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coerceNavigationMap } from "@/core/navigation/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const row = await prisma.navigationMap.findUnique({ where: { projectId } });
  if (!row) return NextResponse.json({ map: null, status: "draft", version: 0 });
  return NextResponse.json({
    map: coerceNavigationMap(JSON.parse(row.content)),
    status: row.status,
    version: row.version,
    updatedAt: row.updatedAt,
    verifiedAt: row.verifiedAt,
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const body = await req.json().catch(() => null) as { map?: unknown; approve?: unknown } | null;
  if (!body?.map) return NextResponse.json({ error: "Falta el mapa funcional." }, { status: 400 });
  const map = coerceNavigationMap(body.map);
  if (map.roots.length === 0) {
    return NextResponse.json({ error: "El mapa debe contener al menos una sección." }, { status: 400 });
  }
  try {
    const row = await prisma.navigationMap.update({
      where: { projectId },
      data: {
        content: JSON.stringify(map),
        status: body.approve === true ? "verified" : "draft",
        version: { increment: 1 },
      },
    });
    return NextResponse.json({ map, status: row.status, version: row.version });
  } catch {
    return NextResponse.json({ error: "Mapa funcional no encontrado." }, { status: 404 });
  }
}
