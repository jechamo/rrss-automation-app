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
  metadata: MediaAssetMetadata;
  createdAt: string;
  updatedAt: string;
};

export type MediaMarker = {
  id: string;
  label: string;
  start: number;
  end: number;
  protected: boolean;
  origin: "playwright" | "manual";
};

export type MediaAssetMetadata = { markers?: MediaMarker[] };

function parseMetadata(raw: string): MediaAssetMetadata {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" ? value as MediaAssetMetadata : {};
  } catch {
    return {};
  }
}

function playwrightMarkers(rel: string): MediaMarker[] {
  try {
    const file = path.join(path.dirname(assetAbsPath(rel)), "nav_log.json");
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      pasos?: Array<{ action?: string; t_inicio?: number; t_fin?: number }>;
    };
    const steps = raw.pasos ?? [];
    return steps.flatMap((step, index) => {
      if (step.action === "final" || !Number.isFinite(step.t_inicio) || !Number.isFinite(step.t_fin)) return [];
      const start = Math.max(0, Number(step.t_inicio));
      // El log cierra la accion antes de su pausa visual. El inicio del paso
      // siguiente conserva ese resultado en pantalla y es un limite mejor.
      const nextStart = Number(steps[index + 1]?.t_inicio);
      const end = Math.max(
        start,
        Number.isFinite(nextStart) ? nextStart : Number(step.t_fin) + 1.5,
      );
      if (end - start < 0.05) return [];
      return [{
        id: `playwright-${index + 1}`,
        label: `Paso ${index + 1} · ${step.action || "acción"}`,
        start,
        end,
        protected: true,
        origin: "playwright" as const,
      }];
    });
  } catch {
    return [];
  }
}

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
  path: string; mimeType: string; size: number; duration: number | null; metadata: string; createdAt: Date; updatedAt: Date;
}): MediaAssetDto {
  const { metadata, ...rest } = row;
  return { ...rest, metadata: parseMetadata(metadata), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export async function registerMediaAsset(input: {
  projectId: string;
  pieceId?: string | null;
  kind: MediaKind;
  origin: string;
  name: string;
  path: string;
  mimeType?: string;
  metadata?: MediaAssetMetadata;
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
  const detectedMarkers = input.kind === "recording" ? playwrightMarkers(input.path) : [];
  const metadata = detectedMarkers.length
    ? { ...(input.metadata ?? {}), markers: detectedMarkers }
    : input.metadata;
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
        ...(metadata ? { metadata: JSON.stringify(metadata) } : {}),
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
      metadata: JSON.stringify(metadata ?? {}),
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
      { rel: assets.videoPath, kind: /(?:^|\/)final(?:-[^/]+)?\.mp4$/i.test(assets.videoPath) ? "final" : "video", label: "Vídeo" },
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
