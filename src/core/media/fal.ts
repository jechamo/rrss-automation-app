import { getSecret } from "@/core/secrets/vault";
import { fetchJson, sleep } from "./http";
import { downloadTo } from "./storage";
import type { MediaOption } from "./types";

// Conector fal.ai: generacion de cortes de video (text-to-video) por prompt.
// fal no expone un listado estable de modelos, asi que se ofrece un set curado.

export const FAL_MODELS: MediaOption[] = [
  { id: "fal-ai/ltx-video", label: "LTX Video", hint: "Rapido y economico" },
  { id: "fal-ai/kling-video/v1/standard/text-to-video", label: "Kling 1.0", hint: "Buen movimiento" },
  { id: "fal-ai/minimax-video", label: "MiniMax (Hailuo)", hint: "Realista" },
  { id: "fal-ai/luma-dream-machine", label: "Luma Dream Machine", hint: "Cinematico" },
  { id: "fal-ai/hunyuan-video", label: "Hunyuan Video", hint: "Alta calidad, lento" },
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

/** Cierta si el error es un HTTP 4xx (modelo que no acepta los parametros extra). */
function isHttp4xx(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /HTTP 4\d\d\b/.test(msg);
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

  // Cortes verticales acotados 5-10s (patron video-factory). Si el modelo rechaza
  // estos extras con un 4xx, se reintenta con solo {prompt} (compat total).
  const seconds =
    typeof args.seconds === "number"
      ? Math.min(10, Math.max(5, Math.round(args.seconds)))
      : undefined;
  const baseBody: Record<string, unknown> = { prompt: args.prompt };
  const richBody: Record<string, unknown> = {
    ...baseBody,
    aspect_ratio: "9:16",
    ...(seconds ? { duration: String(seconds) } : {}),
  };

  const post = (body: Record<string, unknown>) =>
    fetchJson<QueueSubmit>(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let submit: QueueSubmit;
  try {
    submit = await post(richBody);
  } catch (err) {
    if (!isHttp4xx(err)) throw err;
    submit = await post(baseBody);
  }

  const statusUrl =
    submit.status_url ?? `https://queue.fal.run/${model}/requests/${submit.request_id}/status`;
  const responseUrl =
    submit.response_url ?? `https://queue.fal.run/${model}/requests/${submit.request_id}`;

  // Poll hasta COMPLETED (o timeout ~5 min).
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    const st = await fetchJson<{ status: string }>(statusUrl, { headers: auth });
    if (st.status === "COMPLETED") break;
    if (st.status === "FAILED" || st.status === "ERROR") {
      throw new Error("fal.ai fallo al generar el corte.");
    }
    if (i === 59) throw new Error("fal.ai: timeout esperando el corte.");
  }

  const out = await fetchJson<{ video?: { url: string }; url?: string }>(responseUrl, {
    headers: auth,
  });
  const url = out.video?.url ?? out.url;
  if (!url) throw new Error("fal.ai no devolvio URL de video.");
  return downloadTo(args.pieceId, `clip-${args.index}.mp4`, url);
}
