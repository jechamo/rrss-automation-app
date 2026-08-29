import { getSecret } from "@/core/secrets/vault";
import { fetchJson, sleep } from "./http";
import { downloadTo, saveBytes } from "./storage";
import { isMockE2E } from "@/core/runtime/e2e-profile";
import { mockProviderAsset } from "@/core/testing/mock-providers";
import { simulateMockProvider } from "@/core/testing/mock-runtime";
import type { MediaOption } from "./types";
import {
  buildFalRequestBody,
  classifyPollStatus,
  FAL_MODEL_IDS,
  queueFailureMessage,
} from "./contracts";

export { FAL_MODEL_IDS } from "./contracts";
export const buildRequestBody = buildFalRequestBody;

// Conector fal.ai: generacion de cortes de video (text-to-video) por prompt.
// fal no expone un listado estable de modelos, asi que se ofrece un set curado.

export const FAL_MODELS: MediaOption[] = [
  {
    id: FAL_MODEL_IDS.seedance,
    label: "Seedance 1.0 Pro Fast",
    hint: "Recomendado · económico · ≈ 0,049 $/s",
  },
  {
    id: FAL_MODEL_IDS.seedanceV2Fast,
    label: "Seedance 2.0 Fast",
    hint: "Nueva generación · 720p · 0,2419 $/s",
  },
  {
    id: FAL_MODEL_IDS.seedanceV2,
    label: "Seedance 2.0 Standard",
    hint: "Máxima calidad Seedance · 720p · 0,3034 $/s",
  },
  {
    id: FAL_MODEL_IDS.kling25,
    label: "Kling 2.5 Turbo Pro",
    hint: "Precisión de prompt · 0,07 $/s",
  },
  {
    id: FAL_MODEL_IDS.kling,
    label: "Kling 3.0 Standard",
    hint: "Movimiento y detalle · 0,084 $/s",
  },
  {
    id: FAL_MODEL_IDS.klingPro,
    label: "Kling 3.0 Pro",
    hint: "Calidad premium · 0,112 $/s",
  },
  {
    id: FAL_MODEL_IDS.veo31Fast,
    label: "Veo 3.1 Fast",
    hint: "Google · 1080p · 0,10 $/s",
  },
  {
    id: FAL_MODEL_IDS.veo31,
    label: "Veo 3.1 Standard",
    hint: "Google premium · 1080p · 0,20 $/s",
  },
  {
    id: FAL_MODEL_IDS.luma,
    label: "Luma Ray 2",
    hint: "Estilo cinematográfico · ≈ 0,10 $/s",
  },
];

export function listModels(): MediaOption[] {
  return FAL_MODELS;
}

/** Modelo por defecto cuando la config esta en "auto". */
export function autoModel(): string {
  return FAL_MODELS[0].id;
}

function key(): string {
  const k = getSecret("fal");
  if (!k) throw new Error("Falta la API key de fal.ai (Ajustes).");
  return k;
}

interface QueueSubmit {
  request_id: string;
  status_url?: string;
  response_url?: string;
}

interface QueueStatus {
  status: string;
  error?: string | { message?: string };
  logs?: Array<{ message?: string }>;
}

function is4xx(err: unknown): boolean {
  return err instanceof Error && /HTTP 4\d\d/.test(err.message);
}

/** Genera un corte de video a partir de un prompt y lo descarga. Devuelve ruta relativa. */
export async function generateClip(args: {
  pieceId: string;
  index: number;
  prompt: string;
  model: string;
  seconds?: number;
  log?: (m: string) => void;
}): Promise<string> {
  if (isMockE2E()) {
    args.log?.("fal.ai simulado: pending.");
    await simulateMockProvider("fal");
    args.log?.("fal.ai simulado: completed.");
    const asset = mockProviderAsset("fal-video", args.pieceId, args.index);
    return saveBytes(args.pieceId, asset.name, asset.bytes);
  }
  const model = args.model || autoModel();
  const auth = { Authorization: `Key ${key()}` };

  const submitClip = (seconds?: number) =>
    fetchJson<QueueSubmit>(
      `https://queue.fal.run/${model}`,
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(buildFalRequestBody(model, args.prompt, seconds)),
      },
      120_000,
    );

  // Red de seguridad: si el modelo rechaza la duracion pedida (4xx), reintenta
  // una vez con el valor seguro (5s) en vez de tumbar el corte.
  let submit: QueueSubmit;
  try {
    submit = await submitClip(args.seconds);
  } catch (err) {
    if (is4xx(err) && args.seconds !== undefined && args.seconds !== 5) {
      args.log?.(`fal.ai rechazo la duracion pedida; reintentando el corte a 5s.`);
      submit = await submitClip(5);
    } else {
      throw err;
    }
  }
  if (!submit.request_id) throw new Error("fal.ai no devolvio request_id.");

  const statusUrl =
    submit.status_url ?? `https://queue.fal.run/${model}/requests/${submit.request_id}/status`;
  const responseUrl =
    submit.response_url ?? `https://queue.fal.run/${model}/requests/${submit.request_id}`;

  // Poll hasta COMPLETED (o timeout ~10 min).
  for (let i = 0; i < 120; i++) {
    await sleep(5000);
    const st = await fetchJson<QueueStatus>(statusUrl, { headers: auth });
    const pollState = classifyPollStatus(st.status);
    if (pollState === "completed") break;
    if (pollState === "failed") {
      throw new Error(
        `fal.ai fallo al generar el corte: ${queueFailureMessage(st.error, st.logs)}.`,
      );
    }
    if (i === 119) throw new Error("fal.ai: timeout esperando el corte.");
  }

  const out = await fetchJson<{ video?: { url: string }; url?: string }>(responseUrl, {
    headers: auth,
  });
  const url = out.video?.url ?? out.url;
  if (!url) throw new Error("fal.ai no devolvio URL de video.");
  return downloadTo(args.pieceId, `clip-${args.index}.mp4`, url, 300_000);
}
