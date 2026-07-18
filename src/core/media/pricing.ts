import { FAL_MODEL_IDS, resolveFalDuration } from "./contracts";
import type { MediaConfig } from "@/core/content/types";

/**
 * Tarifas aproximadas publicas (USD), revisadas 2026-07-18.
 * Son orientativas: cada proveedor puede cambiar precios/planes.
 * Fuentes: documentacion fal.ai, tarifas tipicas HeyGen/ElevenLabs API.
 */
export const PRICING_AS_OF = "2026-07";

/** USD por segundo de video generado (audio nativo OFF — usamos locucion aparte). */
const FAL_USD_PER_SEC: Record<string, number> = {
  [FAL_MODEL_IDS.seedance]: 0.03, // Seedance V1 Pro Fast (aprox.)
  [FAL_MODEL_IDS.kling]: 0.084, // Kling v3 Standard sin audio nativo
  [FAL_MODEL_IDS.luma]: 0.1, // Luma Ray 2 = 0.50 USD / 5s
};

/** HeyGen API: coste tipico por minuto de video avatar (varia mucho por plan). */
const HEYGEN_USD_PER_MIN = { min: 0.2, max: 1.2 };

/** ElevenLabs TTS: coste tipico por 1000 caracteres. */
const ELEVEN_USD_PER_1K_CHARS = 0.18;

/** Gemini Flash analisis de VIDEO (multimodal): rango orientativo por pieza. */
const GEMINI_VIDEO_USD = { min: 0.01, max: 0.08 };

export interface CostLine {
  label: string;
  detail: string;
  usdMin: number;
  usdMax: number;
}

export interface CostEstimate {
  lines: CostLine[];
  totalMin: number;
  totalMax: number;
  note: string;
}

function falModelId(config: MediaConfig): string {
  return config.videoAuto || !config.videoModelo
    ? FAL_MODEL_IDS.seedance
    : config.videoModelo;
}

function falModelLabel(modelId: string): string {
  if (modelId === FAL_MODEL_IDS.kling) return "Kling v3 Standard";
  if (modelId === FAL_MODEL_IDS.luma) return "Luma Ray 2";
  return "Seedance Pro Fast";
}

function formatUsd(n: number): string {
  if (n < 0.01) return "< 0,01 $";
  return `${n.toFixed(2).replace(".", ",")} $`;
}

/**
 * Estima el coste de una pieza antes de lanzarla.
 * `clipSeconds` / `clipCount`: cortes fal (por defecto 4×5s).
 * `scriptChars`: caracteres de locucion (por defecto ~450 ≈ 30s hablados).
 * `heygenSeconds`: duracion estimada del avatar (por defecto 30s).
 */
export function estimatePieceCost(
  config: MediaConfig,
  opts: {
    clipSeconds?: number;
    clipCount?: number;
    scriptChars?: number;
    heygenSeconds?: number;
    usarGemini?: boolean;
  } = {},
): CostEstimate {
  const clipSeconds = opts.clipSeconds ?? 5;
  const clipCount = opts.clipCount ?? 4;
  const scriptChars = opts.scriptChars ?? 450;
  const heygenSeconds = opts.heygenSeconds ?? 30;
  const lines: CostLine[] = [];

  if (config.rama === "fal") {
    const model = falModelId(config);
    const rate = FAL_USD_PER_SEC[model] ?? FAL_USD_PER_SEC[FAL_MODEL_IDS.seedance];
    // Segundos EFECTIVOS del modelo (p.ej. Luma pide 15 pero genera 9s).
    const effSec = resolveFalDuration(model, clipSeconds).effectiveSeconds;
    const totalSec = effSec * clipCount;
    const videoCost = rate * totalSec;
    lines.push({
      label: `Vídeo · ${falModelLabel(model)}`,
      detail: `≈ ${clipCount} cortes × ${effSec}s ≈ ${totalSec}s · ~${rate.toFixed(3)} $/s`,
      usdMin: videoCost * 0.85,
      usdMax: videoCost * 1.15,
    });

    const voiceCost = (scriptChars / 1000) * ELEVEN_USD_PER_1K_CHARS;
    lines.push({
      label: "Voz · ElevenLabs",
      detail: `≈ ${scriptChars} caracteres de locución`,
      usdMin: voiceCost * 0.7,
      usdMax: voiceCost * 1.4,
    });
  } else {
    const minutes = heygenSeconds / 60;
    lines.push({
      label: "Avatar · HeyGen",
      detail: `≈ ${heygenSeconds}s de vídeo (voz o audio incluido)`,
      usdMin: HEYGEN_USD_PER_MIN.min * minutes,
      usdMax: HEYGEN_USD_PER_MIN.max * minutes,
    });
    if (config.heygen?.narracion === "audio") {
      lines.push({
        label: "Audio propio",
        detail: "Sin coste ElevenLabs (usas tu MP3/WAV)",
        usdMin: 0,
        usdMax: 0,
      });
    }
  }

  if (opts.usarGemini) {
    lines.push({
      label: "Análisis · Gemini",
      detail: "Comprensión multimodal del vídeo fuente",
      usdMin: GEMINI_VIDEO_USD.min,
      usdMax: GEMINI_VIDEO_USD.max,
    });
  }

  lines.push({
    label: "Guion / análisis · Claude",
    detail: "Plan Pro local · sin coste de API",
    usdMin: 0,
    usdMax: 0,
  });

  const totalMin = lines.reduce((s, l) => s + l.usdMin, 0);
  const totalMax = lines.reduce((s, l) => s + l.usdMax, 0);

  return {
    lines,
    totalMin,
    totalMax,
    note: `Estimación orientativa (${PRICING_AS_OF}). El cobro real lo decide cada proveedor según tu plan.`,
  };
}

export function formatCostRange(min: number, max: number): string {
  if (min <= 0 && max <= 0) return "0 $";
  if (Math.abs(max - min) < 0.02) return `≈ ${formatUsd(max)}`;
  return `≈ ${formatUsd(min)} – ${formatUsd(max)}`;
}
