import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { indexProjectAssets, mediaDto, registerMediaAsset, type MediaKind } from "@/core/media/library";
import { saveProjectBytes } from "@/core/media/storage";

export const dynamic = "force-dynamic";
const MAX_BYTES = 250 * 1024 * 1024;
const ALLOWED = new Set([".mp4", ".webm", ".mov", ".mp3", ".wav", ".m4a"]);
const KINDS = new Set<MediaKind>(["recording", "video", "audio", "music", "presenter", "clip", "final"]);

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  await indexProjectAssets(id);
  const assets = await prisma.mediaAsset.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ assets: assets.map(mediaDto) });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el fichero." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El fichero debe ocupar entre 1 byte y 250 MB." }, { status: 400 });
  }
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED.has(extension)) {
    return NextResponse.json({ error: "Formato no soportado: MP4, WebM, MOV, MP3, WAV o M4A." }, { status: 400 });
  }
  const requestedKind = String(form?.get("kind") || "video") as MediaKind;
  const kind = KINDS.has(requestedKind) ? requestedKind : "video";
  const origin = String(form?.get("origin") || "upload").slice(0, 30);
  const displayName = String(form?.get("name") || file.name).trim().slice(0, 120) || file.name;
  const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${extension}`;
  const rel = saveProjectBytes(id, uniqueName, Buffer.from(await file.arrayBuffer()));
  const asset = await registerMediaAsset({
    projectId: id,
    kind,
    origin,
    name: displayName,
    path: rel,
    mimeType: file.type || undefined,
  });
  return NextResponse.json({ asset: mediaDto(asset) }, { status: 201 });
}
