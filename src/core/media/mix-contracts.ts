export interface MixSegment {
  id: string;
  assetId: string;
  sourceStart: number;
  sourceEnd: number;
  label: string;
  kind: string;
  locked: boolean;
  shotIndex?: number;
}

export type MixOverlayMode = "cover" | "pip";
export type MixOverlayPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

export interface MixOverlay {
  id: string;
  assetId: string;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  label: string;
  kind: string;
  mode: MixOverlayMode;
  position: MixOverlayPosition;
  size: number;
}

export interface MixRecipe {
  version: 1 | 2;
  videoAssetIds: string[];
  segments: MixSegment[];
  overlays: MixOverlay[];
  voiceAssetId: string;
  musicAssetId: string;
  subtitleText: string;
  musicVolume: number;
}

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function coerceMixRecipe(raw: unknown): MixRecipe {
  const value = (raw ?? {}) as Record<string, unknown>;
  const ids = Array.isArray(value.videoAssetIds)
    ? value.videoAssetIds.filter((id): id is string => typeof id === "string" && Boolean(id))
    : [];
  const segments = Array.isArray(value.segments)
    ? value.segments.slice(0, 40).flatMap((rawSegment, index) => {
        if (!rawSegment || typeof rawSegment !== "object") return [];
        const segment = rawSegment as Record<string, unknown>;
        const assetId = typeof segment.assetId === "string" ? segment.assetId : "";
        const sourceStart = Math.max(0, finiteNumber(segment.sourceStart));
        const sourceEnd = Math.max(sourceStart, finiteNumber(segment.sourceEnd));
        if (!assetId || sourceEnd - sourceStart < 0.05) return [];
        const item: MixSegment = {
          id: typeof segment.id === "string" && segment.id ? segment.id : `segment-${index + 1}`,
          assetId,
          sourceStart,
          sourceEnd,
          label: typeof segment.label === "string" ? segment.label.slice(0, 120) : `Bloque ${index + 1}`,
          kind: typeof segment.kind === "string" ? segment.kind : "video",
          locked: segment.locked === true,
        };
        const shotIndex = finiteNumber(segment.shotIndex, -1);
        if (shotIndex >= 0) item.shotIndex = Math.round(shotIndex);
        return [item];
      })
    : [];
  const overlays = Array.isArray(value.overlays)
    ? value.overlays.slice(0, 20).flatMap((rawOverlay, index) => {
        if (!rawOverlay || typeof rawOverlay !== "object") return [];
        const overlay = rawOverlay as Record<string, unknown>;
        const assetId = typeof overlay.assetId === "string" ? overlay.assetId : "";
        const sourceStart = Math.max(0, finiteNumber(overlay.sourceStart));
        const sourceEnd = Math.max(sourceStart, finiteNumber(overlay.sourceEnd));
        if (!assetId || sourceEnd - sourceStart < 0.05) return [];
        const positions: MixOverlayPosition[] = ["top-left", "top-right", "bottom-left", "bottom-right", "center"];
        const position = positions.includes(overlay.position as MixOverlayPosition)
          ? overlay.position as MixOverlayPosition
          : "top-right";
        return [{
          id: typeof overlay.id === "string" && overlay.id ? overlay.id : `overlay-${index + 1}`,
          assetId,
          sourceStart,
          sourceEnd,
          timelineStart: Math.max(0, finiteNumber(overlay.timelineStart)),
          label: typeof overlay.label === "string" ? overlay.label.slice(0, 120) : `Superposición ${index + 1}`,
          kind: typeof overlay.kind === "string" ? overlay.kind : "video",
          mode: overlay.mode === "pip" ? "pip" as const : "cover" as const,
          position,
          size: Math.min(0.8, Math.max(0.2, finiteNumber(overlay.size, 0.36))),
        }];
      })
    : [];
  const volume = Number(value.musicVolume);
  return {
    version: segments.length > 0 || overlays.length > 0 || value.version === 2 ? 2 : 1,
    videoAssetIds: [...new Set(ids)].slice(0, 20),
    segments,
    overlays,
    voiceAssetId: typeof value.voiceAssetId === "string" ? value.voiceAssetId : "",
    musicAssetId: typeof value.musicAssetId === "string" ? value.musicAssetId : "",
    subtitleText: typeof value.subtitleText === "string" ? value.subtitleText.trim() : "",
    musicVolume: Number.isFinite(volume) ? Math.min(0.5, Math.max(0.02, volume)) : 0.12,
  };
}

export function mixVideoCount(recipe: MixRecipe): number {
  return recipe.version === 2 ? recipe.segments.length : recipe.videoAssetIds.length;
}

export function mixVisualDuration(recipe: MixRecipe): number {
  return recipe.version === 2
    ? recipe.segments.reduce((sum, segment) => sum + segment.sourceEnd - segment.sourceStart, 0)
    : 0;
}
