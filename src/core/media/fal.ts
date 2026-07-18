import { getSecret } from "@/core/secrets/vault";
import { fetchJson, sleep } from "./http";
import { downloadTo } from "./storage";
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
    label: "Seedance Pro Fast",
    hint: "Recomendado · rápido y eficiente",
  },
  {
    id: FAL_MODEL_IDS.kling,
    label: "Kling v3 Standard",
    hint: "Movimiento y detalle",
  },
  {
    id: FAL_MODEL_IDS.luma,
    label: "Luma Ray 2",
    hint: "Estilo cinematográfico",
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

/** Genera un corte de video a partir de un prompt y lo descarga. Devuelve ruta relativa. */
export async function generateClip(args: {
  pieceId: string;
  index: number;
  prompt: string;
  model: string;
  seconds?: number;
}): Promise<string> {
  const model = args.model || autoModel();
  const auth = { Authorization: `Key ${key()}` };
  const body = buildFalRequestBody(model, args.prompt, args.seconds);
  const submit = await fetchJson<QueueSubmit>(
    `https://queue.fal.run/${model}`,
    {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    120_000,
  );
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
