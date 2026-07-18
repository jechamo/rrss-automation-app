import { getSecret } from "@/core/secrets/vault";
import { getEngine } from "@/core/ai";
import type { AiEngineId } from "@/core/ai";

export type ProviderId =
  | "ai-engine"
  | "gemini"
  | "elevenlabs"
  | "heygen"
  | "fal"
  | "github";

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  description: string;
  /** true si necesita una API key en el vault (ai-engine no). */
  needsKey: boolean;
  docsUrl?: string;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "ai-engine",
    name: "Motor de IA (Claude)",
    description: "Claude Code CLI / Agent SDK. Analisis, guiones y dossier sin coste de API.",
    needsKey: false,
  },
  {
    id: "gemini",
    name: "Gemini",
    description: "Comprension de video. Pago por uso.",
    needsKey: true,
    docsUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "Voz por ID para la locucion.",
    needsKey: true,
    docsUrl: "https://elevenlabs.io/app/settings/api-keys",
  },
  {
    id: "heygen",
    name: "HeyGen",
    description: "Avatares con foto + voz.",
    needsKey: true,
    docsUrl: "https://app.heygen.com/settings",
  },
  {
    id: "fal",
    name: "fal.ai",
    description: "Generacion de videos/cortes por API.",
    needsKey: true,
    docsUrl: "https://fal.ai/dashboard/keys",
  },
  {
    id: "github",
    name: "GitHub Token",
    description: "Clonar repos privados para analizar codigo.",
    needsKey: true,
    docsUrl: "https://github.com/settings/tokens",
  },
];

export interface TestResult {
  ok: boolean;
  detail: string;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function testProvider(id: ProviderId, engineId?: AiEngineId): Promise<TestResult> {
  if (id === "ai-engine") {
    return getEngine(engineId).test();
  }

  const key = getSecret(id);
  if (!key) return { ok: false, detail: "Falta la API key. Pegala y guardala primero." };

  try {
    switch (id) {
      case "gemini": {
        const r = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
        );
        return r.ok
          ? { ok: true, detail: "Gemini OK." }
          : { ok: false, detail: `Gemini respondio ${r.status}.` };
      }
      case "elevenlabs": {
        const r = await fetchWithTimeout("https://api.elevenlabs.io/v1/user", {
          headers: { "xi-api-key": key },
        });
        return r.ok
          ? { ok: true, detail: "ElevenLabs OK." }
          : { ok: false, detail: `ElevenLabs respondio ${r.status}.` };
      }
      case "heygen": {
        const r = await fetchWithTimeout("https://api.heygen.com/v3/voices?limit=1", {
          headers: { "X-Api-Key": key },
        });
        return r.ok
          ? { ok: true, detail: "HeyGen OK." }
          : { ok: false, detail: `HeyGen respondio ${r.status}.` };
      }
      case "github": {
        const r = await fetchWithTimeout("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${key}`, "User-Agent": "rrss-automation-app" },
        });
        if (r.ok) {
          const u = (await r.json()) as { login?: string };
          return { ok: true, detail: `GitHub OK (${u.login ?? "usuario"}).` };
        }
        return { ok: false, detail: `GitHub respondio ${r.status}.` };
      }
      case "fal": {
        // fal.ai no tiene un endpoint de validacion simple universal;
        // comprobacion basica de formato + intento ligero.
        const looksValid = key.includes(":") || key.length > 20;
        return looksValid
          ? { ok: true, detail: "fal.ai: key guardada (validacion completa al primer uso)." }
          : { ok: false, detail: "El formato de la key de fal.ai no parece correcto." };
      }
      default:
        return { ok: false, detail: "Proveedor desconocido." };
    }
  } catch (e) {
    return { ok: false, detail: `Error de red: ${(e as Error).message}` };
  }
}
