import type { MediaConfig, NavStep, Shot } from "../content/types.js";

export interface VisualPlanInput {
  config: MediaConfig;
  origin: "viral" | "own";
  targetSeconds?: number | null;
  narrationText?: string;
  recordingSeconds?: number | null;
  navSteps?: NavStep[];
  shots?: Shot[];
}

export interface VisualPlan {
  targetSeconds: number;
  narrationSeconds: number;
  recordingSeconds: number | null;
  protectedDemoSeconds: number;
  brollSeconds: number;
  recommendedClipCount: number;
  clipCount: number;
  requestedClipSeconds: number;
  generatedSeconds: number;
  estimated: boolean;
  warnings: string[];
}

export function estimateNarrationSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words ? Math.max(3, words / 2.45) : 0;
}

function clampCount(value: number): number {
  return Math.min(6, Math.max(0, Math.round(value)));
}

/**
 * Plan puro compartido por UI y pipelines. No llama proveedores: permite
 * aprobar cantidad y coste antes de consumir fal.ai.
 */
export function buildVisualPlan(input: VisualPlanInput): VisualPlan {
  const narrationSeconds = estimateNarrationSeconds(input.narrationText ?? "");
  const shotSeconds = (input.shots ?? []).reduce(
    (sum, shot) => sum + Math.max(0, shot.segundos || 0),
    0,
  );
  const targetSeconds = Math.max(
    10,
    input.targetSeconds ?? 0,
    narrationSeconds,
    shotSeconds,
    input.origin === "own" ? 30 : 20,
  );
  const recordingSeconds = input.recordingSeconds && input.recordingSeconds > 0
    ? input.recordingSeconds
    : null;
  const navEstimate = (input.navSteps?.length ?? 0) * 2.25;
  const protectedDemoSeconds = input.origin === "own"
    ? Math.min(targetSeconds * 0.72, recordingSeconds ?? Math.max(10, navEstimate || 14))
    : 0;
  const brollSeconds = Math.max(0, targetSeconds - protectedDemoSeconds);
  const promptShots = (input.shots ?? []).filter((shot) => Boolean(shot.prompt.trim())).length;
  const byDuration = Math.ceil(brollSeconds / Math.max(3, Math.min(5, input.config.falClipSeconds)));
  const recommendedClipCount = clampCount(promptShots || byDuration || (input.origin === "own" ? 3 : 4));
  const clipCount = input.config.rama !== "fal"
    ? 0
    : input.config.falClipMode === "manual"
      ? clampCount(input.config.falClipCount)
      : recommendedClipCount;
  const warnings: string[] = [];
  if (!recordingSeconds && input.origin === "own") {
    warnings.push("La duración de la demostración es estimada hasta que exista la grabación.");
  }
  if (input.config.falClipMode === "manual" && clipCount === 0) {
    warnings.push("El vídeo usará solamente la demostración, sin cortes generativos.");
  }
  if (clipCount > 0 && brollSeconds / clipCount < 2) {
    warnings.push("Hay más cortes que huecos visuales útiles; algunos quedarían muy breves.");
  }
  return {
    targetSeconds,
    narrationSeconds,
    recordingSeconds,
    protectedDemoSeconds,
    brollSeconds,
    recommendedClipCount,
    clipCount,
    requestedClipSeconds: input.config.falClipSeconds,
    generatedSeconds: clipCount * input.config.falClipSeconds,
    estimated: !recordingSeconds || !narrationSeconds,
    warnings,
  };
}

export function effectiveClipLimit(config: MediaConfig, shots?: Shot[]): number {
  if (config.rama !== "fal") return 0;
  if (config.falClipMode === "manual") return clampCount(config.falClipCount);
  if (shots) return clampCount(shots.filter((shot) => Boolean(shot.prompt.trim())).length || 4);
  return clampCount(config.falClipCount || 4);
}
