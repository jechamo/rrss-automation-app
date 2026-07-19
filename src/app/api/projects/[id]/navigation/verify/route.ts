import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coerceNavigationMap } from "@/core/navigation/types";
import { verifyNavigationMap } from "@/core/navigation/runtime";
import { getLogin } from "@/core/secrets/login";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [project, row] = await Promise.all([
    prisma.project.findUnique({ where: { id } }),
    prisma.navigationMap.findUnique({ where: { projectId: id } }),
  ]);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  if (!row) return NextResponse.json({ error: "Genera primero el mapa funcional." }, { status: 409 });

  try {
    const map = await verifyNavigationMap({
      projectId: id,
      baseUrl: project.url,
      map: coerceNavigationMap(JSON.parse(row.content)),
      login: getLogin(id),
    });
    const updated = await prisma.navigationMap.update({
      where: { projectId: id },
      data: {
        content: JSON.stringify(map),
        status: "verified",
        verifiedAt: new Date(map.verifiedAt ?? Date.now()),
        version: { increment: 1 },
      },
    });
    return NextResponse.json({ map, status: updated.status, version: updated.version });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 422 },
    );
  }
}
