export const FAL_MODEL_IDS = {
  seedance: "fal-ai/bytedance/seedance/v1/pro/fast/text-to-video",
  kling: "fal-ai/kling-video/v3/standard/text-to-video",
  luma: "fal-ai/luma-dream-machine/ray-2",
} as const;

function clampSeconds(seconds: number | undefined): number {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return 5;
  return Math.min(10, Math.max(5, Math.round(seconds)));
}

export function buildFalRequestBody(
  model: string,
  prompt: string,
  requestedSeconds?: number,
): Record<string, unknown> {
  const seconds = clampSeconds(requestedSeconds);
  switch (model) {
    case FAL_MODEL_IDS.kling:
      // Audio nativo OFF: la locucion va por ElevenLabs (mas barato y controlable).
      return {
        prompt,
        aspect_ratio: "9:16",
        duration: seconds < 8 ? "5" : "10",
        generate_audio: false,
      };
    case FAL_MODEL_IDS.seedance:
      return { prompt, aspect_ratio: "9:16", duration: String(seconds) };
    case FAL_MODEL_IDS.luma:
      return { prompt, aspect_ratio: "9:16", duration: seconds < 8 ? "5s" : "9s" };
    default:
      throw new Error(
        `fal.ai: el modelo '${model}' no tiene un contrato verificado. Elige uno del catálogo actual.`,
      );
  }
}

export interface HeygenVideoInput {
  avatarId: string;
  texto?: string;
  voiceId?: string;
  audioAssetId?: string;
  aspectRatio?: "9:16" | "16:9" | "1:1" | "auto";
  resolution?: "720p" | "1080p";
}

export function buildHeygenVideoBody(input: HeygenVideoInput): Record<string, unknown> {
  if (!input.avatarId) throw new Error("HeyGen: elige un avatar en la configuracion de la pieza.");
  const hasScript = Boolean(input.texto?.trim());
  const hasAudio = Boolean(input.audioAssetId);
  if (hasScript === hasAudio) {
    throw new Error(
      "HeyGen requiere exactamente una fuente de audio: una voz del catalogo o un audio propio.",
    );
  }

  const body: Record<string, unknown> = {
    type: "avatar",
    avatar_id: input.avatarId,
    resolution: input.resolution ?? "1080p",
    aspect_ratio: input.aspectRatio ?? "9:16",
    title: "RRSS Studio",
  };
  if (hasScript) {
    body.script = input.texto;
    if (input.voiceId) body.voice_id = input.voiceId;
  } else {
    body.audio_asset_id = input.audioAssetId;
  }
  return body;
}

export function providerHttpError(provider: string, status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed.error?.message) return `${provider} ${status}: ${parsed.error.message}`;
  } catch {
    // Un cuerpo no JSON nunca debe ocultar el codigo HTTP.
  }
  return `${provider} respondio ${status}.`;
}

export function isRetriableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function retryDelayMs(retryAfter: string | null, attempt: number): number {
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 2000 * (attempt + 1);
}

export type PollState = "pending" | "completed" | "failed";

export function classifyPollStatus(status: string | undefined): PollState {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "completed") return "completed";
  if (normalized === "failed" || normalized === "error") return "failed";
  return "pending";
}

export function queueFailureMessage(
  error: string | { message?: string } | undefined,
  logs?: Array<{ message?: string }>,
): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object" && typeof error.message === "string") {
    return error.message;
  }
  return logs?.map((log) => log.message).filter(Boolean).at(-1) || "sin detalle";
}
