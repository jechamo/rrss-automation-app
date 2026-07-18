import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { coerceAssets } from "@/core/content/types";
import { assetAbsPath } from "./storage";
import { ffprobeDuration } from "./ffmpeg";

export type MediaKind = "recording" | "video" | "audio" | "music" | "presenter" | "clip" | "final";

export type MediaAssetDto = {
  id: string;
  projectId: string;
  pieceId: string | null;
  kind: string;
  origin: string;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  duration: number | null;
  createdAt: string;
  updatedAt: string;
};

export function mimeFromPath(rel: string): string {
  const ext = path.extname(rel).toLowerCase();
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".m4a") return "audio/mp4";
  return "video/mp4";
}

export function mediaDto(row: {
  id: string; projectId: string; pieceId: string | null; kind: string; origin: string; name: string;
  path: string; mimeType: string; size: number; duration: number | null; createdAt: Date; updatedAt: Date;
}): MediaAssetDto {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export async function registerMediaAsset(input: {
  projectId: string;
  pieceId?: string | null;
  kind: MediaKind;
  origin: string;
  name: string;
  path: string;
  mimeType?: string;
}) {
  let size = 0;
  let duration: number | null = null;
  try {
    const abs = assetAbsPath(input.path);
    const stat = fs.statSync(abs);
    size = stat.size;
    if (input.kind !== "audio" && input.kind !== "music" || stat.size > 0) {
      duration = ffprobeDuration(abs);
    }
  } catch {
    // Los assets externos o legacy pueden no estar disponibles todavía.
  }
  const existing = await prisma.mediaAsset.findUnique({
    where: { projectId_path: { projectId: input.projectId, path: input.path } },
  });
  if (existing) {
    return prisma.mediaAsset.update({
      where: { id: existing.id },
      data: {
        kind: input.kind,
        name: existing.origin === "indexed" ? input.name : existing.name,
        mimeType: input.mimeType || mimeFromPath(input.path),
        size,
        duration,
      },
    });
  }
  return prisma.mediaAsset.create({
    data: {
      projectId: input.projectId,
      pieceId: input.pieceId ?? null,
      kind: input.kind,
      origin: input.origin,
      name: input.name,
      path: input.path,
      mimeType: input.mimeType || mimeFromPath(input.path),
      size,
      duration,
    },
  });
}

export async function indexProjectAssets(projectId: string): Promise<void> {
  const pieces = await prisma.contentPiece.findMany({
    where: { projectId },
    select: { id: true, titulo: true, assets: true },
  });
  for (const piece of pieces) {
    let assets;
    try {
      assets = coerceAssets(JSON.parse(piece.assets || "{}"));
    } catch {
      continue;
    }
    const entries: Array<{ rel: string; kind: MediaKind; label: string }> = [
      { rel: assets.recordingPath, kind: "recording", label: "Grabación" },
      { rel: assets.presenterPath, kind: "presenter", label: "Presentador HeyGen" },
      { rel: assets.audioPath, kind: "audio", label: "Locución" },
      { rel: assets.videoPath, kind: /(?:^|\/)final\.mp4$/i.test(assets.videoPath) ? "final" : "video", label: "Vídeo" },
      ...assets.clips.map((rel, index) => ({ rel, kind: "clip" as const, label: `Clip ${index + 1}` })),
    ];
    for (const entry of entries) {
      if (!entry.rel || !entry.rel.startsWith("media/")) continue;
      await registerMediaAsset({
        projectId,
        pieceId: piece.id,
        kind: entry.kind,
        origin: "indexed",
        name: `${entry.label} · ${piece.titulo || "Pieza"}`,
        path: entry.rel,
      });
    }
  }
}
