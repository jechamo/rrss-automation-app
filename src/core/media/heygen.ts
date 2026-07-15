import { getSecret } from "@/core/secrets/vault";
import { fetchJson, sleep } from "./http";
import { downloadTo } from "./storage";
import type { MediaOption } from "./types";

// Conector HeyGen: avatares + voces + generacion de video de avatar hablando.

const BASE = "https://api.heygen.com";

function key(): string {
  const k = getSecret("heygen");
  if (!k) throw new Error("Falta la API key de HeyGen (Ajustes).");
  return k;
}

export async function listAvatars(): Promise<MediaOption[]> {
  const data = await fetchJson<{ data?: { avatars?: { avatar_id: string; avatar_name: string }[] } }>(
    `${BASE}/v2/avatars`,
    { headers: { "X-Api-Key": key() } },
  );
  return (data.data?.avatars ?? []).map((a) => ({ id: a.avatar_id, label: a.avatar_name }));
}

export async function listVoices(): Promise<MediaOption[]> {
  const data = await fetchJson<{
    data?: { voices?: { voice_id: string; name: string; language?: string }[] };
  }>(`${BASE}/v2/voices`, { headers: { "X-Api-Key": key() } });
  return (data.data?.voices ?? []).map((v) => ({ id: v.voice_id, label: v.name, hint: v.language }));
}

/** Genera un video de avatar (foto + voz) hablando la locucion. Devuelve ruta relativa. */
export async function generateAvatarVideo(args: {
  pieceId: string;
  avatarId: string;
  voiceId: string;
  texto: string;
}): Promise<string> {
  if (!args.avatarId) throw new Error("HeyGen: elige un avatar en la configuracion de la pieza.");
  const headers = { "X-Api-Key": key(), "Content-Type": "application/json" };
  const gen = await fetchJson<{ data?: { video_id: string } }>(`${BASE}/v2/video/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: args.avatarId, avatar_style: "normal" },
          voice: { type: "text", input_text: args.texto, voice_id: args.voiceId || undefined },
        },
      ],
      dimension: { width: 720, height: 1280 }, // vertical 9:16 para RRSS
    }),
  });
  const videoId = gen.data?.video_id;
  if (!videoId) throw new Error("HeyGen no devolvio video_id.");

  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    const st = await fetchJson<{ data?: { status: string; video_url?: string } }>(
      `${BASE}/v1/video_status.get?video_id=${videoId}`,
      { headers: { "X-Api-Key": key() } },
    );
    const s = st.data?.status;
    if (s === "completed" && st.data?.video_url) {
      return downloadTo(args.pieceId, "avatar.mp4", st.data.video_url);
    }
    if (s === "failed") throw new Error("HeyGen fallo al generar el video.");
  }
  throw new Error("HeyGen: timeout esperando el video.");
}
