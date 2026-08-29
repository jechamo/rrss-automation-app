import { getSecret } from "@/core/secrets/vault";
import { fetchJson, fetchWithTimeout } from "./http";
import { saveBytes } from "./storage";
import type { MediaOption } from "./types";
import { isMockE2E } from "@/core/runtime/e2e-profile";
import { mockProviderAsset, mockProviderOptions } from "@/core/testing/mock-providers";
import { simulateMockProvider } from "@/core/testing/mock-runtime";

// Conector ElevenLabs: listado de voces + text-to-speech (locucion de la rama fal).

const BASE = "https://api.elevenlabs.io/v1";
const VOZ_DEFECTO = "21m00Tcm4TlvDq8ikWAM"; // "Rachel", voz publica por defecto de ElevenLabs

function key(): string {
  const k = getSecret("elevenlabs");
  if (!k) throw new Error("Falta la API key de ElevenLabs (Ajustes).");
  return k;
}

export async function listVoices(): Promise<MediaOption[]> {
  if (isMockE2E()) {
    await simulateMockProvider("elevenlabs");
    return mockProviderOptions("elevenlabs-voices");
  }
  const data = await fetchJson<{ voices?: { voice_id: string; name: string; category?: string }[] }>(
    `${BASE}/voices`,
    { headers: { "xi-api-key": key() } },
  );
  return (data.voices ?? []).map((v) => ({ id: v.voice_id, label: v.name, hint: v.category }));
}

/** Genera la locucion (mp3) y la guarda. Devuelve ruta relativa a data/. */
export async function tts(pieceId: string, text: string, voiceId: string): Promise<string> {
  if (isMockE2E()) {
    await simulateMockProvider("elevenlabs");
    const asset = mockProviderAsset("elevenlabs-audio", pieceId);
    return saveBytes(pieceId, asset.name, asset.bytes);
  }
  const vid = voiceId || VOZ_DEFECTO;
  const r = await fetchWithTimeout(
    `${BASE}/text-to-speech/${vid}`,
    {
      method: "POST",
      headers: { "xi-api-key": key(), "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
    },
    120000,
  );
  if (!r.ok) {
    const b = await r.text().catch(() => "");
    throw new Error(`ElevenLabs TTS ${r.status}: ${b.slice(0, 200)}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  return saveBytes(pieceId, "locucion.mp3", buf);
}
