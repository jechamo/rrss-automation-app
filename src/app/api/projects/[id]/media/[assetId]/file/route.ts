import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assetAbsPath } from "@/core/media/storage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await ctx.params;
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, projectId: id } });
  if (!asset) return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
  let abs: string;
  try { abs = assetAbsPath(asset.path); } catch { return NextResponse.json({ error: "Ruta inválida." }, { status: 400 }); }
  if (!fs.existsSync(abs)) return NextResponse.json({ error: "Fichero no encontrado." }, { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": asset.mimeType,
    "Content-Length": String(fs.statSync(abs).size),
    "Cache-Control": "no-store",
  };
  if (req.nextUrl.searchParams.get("download") === "1") {
    headers["Content-Disposition"] = `attachment; filename="${asset.name.replace(/["\r\n]/g, "")}"`;
  }
  return new NextResponse(fs.readFileSync(abs), { headers });
}
