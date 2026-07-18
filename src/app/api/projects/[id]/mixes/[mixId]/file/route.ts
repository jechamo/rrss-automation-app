import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assetAbsPath } from "@/core/media/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; mixId: string }> }) {
  const { id, mixId } = await ctx.params;
  const mix = await prisma.mixComposition.findFirst({ where: { id: mixId, projectId: id } });
  if (!mix?.outputPath) return NextResponse.json({ error: "Salida no encontrada." }, { status: 404 });
  let abs: string;
  try { abs = assetAbsPath(mix.outputPath); } catch { return NextResponse.json({ error: "Ruta inválida." }, { status: 400 }); }
  if (!fs.existsSync(abs)) return NextResponse.json({ error: "Fichero no encontrado." }, { status: 404 });
  return new NextResponse(fs.readFileSync(abs), { headers: { "Content-Type": "video/mp4", "Content-Length": String(fs.statSync(abs).size), "Cache-Control": "no-store" } });
}
