export const FAL_MODEL_IDS = {
  seedance: "fal-ai/bytedance/seedance/v1/pro/fast/text-to-video",
  seedanceV2Fast: "bytedance/seedance-2.0/fast/text-to-video",
  seedanceV2: "bytedance/seedance-2.0/text-to-video",
  kling25: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
  kling: "fal-ai/kling-video/v3/standard/text-to-video",
  klingPro: "fal-ai/kling-video/v3/pro/text-to-video",
  veo31Fast: "fal-ai/veo3.1/fast",
  veo31: "fal-ai/veo3.1",
  luma: "fal-ai/luma-dream-machine/ray-2",
} as const;

/** Duraciones de corte que la UI ofrece (segundos pedidos, no siempre los efectivos). */
export type FalClipSeconds = 5 | 10 | 15;

function clampSeconds(seconds: number | undefined): number {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return 5;
  return Math.min(15, Math.max(5, Math.round(seconds)));
}

export interface FalDuration {
  /** Valor exacto que va en el body de fal (string, con o sin sufijo "s"). */
  body: string;
  /** Segundos reales que generara el modelo (para coste y etiqueta). */
  effectiveSeconds: number;
  /** Texto para la UI, p.ej. "12 s" cuando se pidio 15 pero el modelo topa en 12. */
  label: string;
}

/**
 * Traduce los segundos pedidos (5/10/15) al esquema de duracion de cada modelo.
 * Mapeo oficial revisado en fal.ai (2026-07-19). Cada endpoint tiene enums
 * distintos; esta funcion evita enviar una duracion que el proveedor rechazara.
 */
export function resolveFalDuration(model: string, requestedSeconds?: number): FalDuration {
  const seconds = clampSeconds(requestedSeconds);
  switch (model) {
    case FAL_MODEL_IDS.kling:
    case FAL_MODEL_IDS.klingPro: {
      const eff = seconds >= 13 ? 15 : seconds >= 8 ? 10 : 5;
      return { body: String(eff), effectiveSeconds: eff, label: `${eff} s` };
    }
    case FAL_MODEL_IDS.kling25: {
      const eff = seconds >= 8 ? 10 : 5;
      return { body: String(eff), effectiveSeconds: eff, label: `${eff} s` };
    }
    case FAL_MODEL_IDS.seedance: {
      // Esquema 5..12: se pasa el valor pedido acotado (15 -> 12, su maximo).
      const eff = Math.min(12, Math.max(5, seconds));
      return { body: String(eff), effectiveSeconds: eff, label: `${eff} s` };
    }
    case FAL_MODEL_IDS.seedanceV2:
    case FAL_MODEL_IDS.seedanceV2Fast:
      return { body: String(seconds), effectiveSeconds: seconds, label: `${seconds} s` };
    case FAL_MODEL_IDS.veo31:
    case FAL_MODEL_IDS.veo31Fast: {
      const eff = seconds < 8 ? 4 : 8;
      return { body: `${eff}s`, effectiveSeconds: eff, label: `${eff} s` };
    }
    case FAL_MODEL_IDS.luma: {
      const eff = seconds < 8 ? 5 : 9;
      return { body: `${eff}s`, effectiveSeconds: eff, label: `${eff} s` };
    }
    default:
      throw new Error(
        `fal.ai: el modelo '${model}' no tiene un contrato verificado. Elige uno del catálogo actual.`,
      );
  }
}

export function buildFalRequestBody(
  model: string,
  prompt: string,
  requestedSeconds?: number,
): Record<string, unknown> {
  const duration = resolveFalDuration(model, requestedSeconds).body;
  switch (model) {
    case FAL_MODEL_IDS.kling:
    case FAL_MODEL_IDS.klingPro:
      // Audio nativo OFF: la locucion va por ElevenLabs (mas barato y controlable).
      return { prompt, aspect_ratio: "9:16", duration, generate_audio: false };
    case FAL_MODEL_IDS.kling25:
      return { prompt, aspect_ratio: "9:16", duration };
    case FAL_MODEL_IDS.seedance:
      return { prompt, aspect_ratio: "9:16", duration };
    case FAL_MODEL_IDS.seedanceV2:
    case FAL_MODEL_IDS.seedanceV2Fast:
      return {
        prompt,
        resolution: "720p",
        aspect_ratio: "9:16",
        duration,
        generate_audio: false,
      };
    case FAL_MODEL_IDS.veo31:
    case FAL_MODEL_IDS.veo31Fast:
      return {
        prompt,
        aspect_ratio: "9:16",
        duration,
        resolution: "1080p",
        generate_audio: false,
      };
    case FAL_MODEL_IDS.luma:
      return { prompt, aspect_ratio: "9:16", duration };
    default:
      // resolveFalDuration ya lanzo, pero mantenemos el guard por exhaustividad.
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

export function sanitizeProviderMessage(rawMessage: string): string {
  return rawMessage
    .replace(/(authorization:\s*bearer\s+)[^\s]+/gi, "$1[oculto]")
    .replace(/([?&](?:key|token|api_key)=)[^&\s]+/gi, "$1[oculto]")
    .slice(0, 500);
}

export function friendlyProviderFailure(provider: string, rawMessage: string): string {
  const message = sanitizeProviderMessage(rawMessage);
  const normalized = message.toLowerCase();
  if (/http 402|insufficient|credit|credits|balance|saldo|quota exceeded/.test(normalized)) {
    return `${provider}: saldo o créditos insuficientes. Revisa la facturación del proveedor.`;
  }
  if (/http 401|http 403|unauthori[sz]ed|invalid.*(?:key|token)|forbidden/.test(normalized)) {
    return `${provider}: autenticación rechazada. Revisa la API key en Ajustes.`;
  }
  if (/http 429|rate.?limit|too many requests/.test(normalized)) {
    return `${provider}: límite temporal de solicitudes alcanzado. Espera unos minutos y reintenta.`;
  }
  return `${provider}: ${message || "error desconocido del proveedor."}`;
}

export interface TimelineSlot {
  kind: "clip" | "recording";
  shotIndex: number;
  clipIndex?: number;
}

/**
 * Traduce la escaleta product-led a fuentes de montaje. Cada plano con prompt
 * consume exactamente un corte fal.ai; los planos sin prompt usan screencast.
 * Cualquier corte legacy no referenciado se anexa para no perder un asset ya cobrado.
 */
export function planDemoTimeline(
  shots: Array<{ prompt?: string }>,
  clipCount: number,
): TimelineSlot[] {
  const slots: TimelineSlot[] = [];
  let clipIndex = 0;
  shots.forEach((shot, shotIndex) => {
    if (shot.prompt?.trim() && clipIndex < clipCount) {
      slots.push({ kind: "clip", shotIndex, clipIndex });
      clipIndex += 1;
    } else {
      slots.push({ kind: "recording", shotIndex });
    }
  });
  while (clipIndex < clipCount) {
    slots.push({ kind: "clip", shotIndex: -1, clipIndex });
    clipIndex += 1;
  }
  return slots;
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
