import fs from "node:fs";
import { getSecret } from "@/core/secrets/vault";
import { fetchJson, fetchWithTimeout, sleep } from "./http";
import { hasYtDlp, downloadVideo } from "./ytdlp";
import { isMockE2E } from "@/core/runtime/e2e-profile";
import { simulateMockProvider } from "@/core/testing/mock-runtime";

// Conector Gemini: comprension MULTIMODAL del viral fuente (opcion de REQ-005).
// - YouTube publico: se pasa la URL por file_data.file_uri (ingesta nativa, sin binario).
// - Otras redes (TikTok/IG): se descarga con yt-dlp y se sube por Files API.
// Degradacion: si no hay yt-dlp o algo falla, el llamador (extract.ts) sigue con REQ-004.

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD = "https://generativelanguage.googleapis.com/upload/v1beta/files";
// Modelo vigente con comprensión de vídeo. El override permite migrarlo sin tocar código
// cuando Google anuncie otra sustitución.
const MODEL = process.env.GEMINI_VIDEO_MODEL?.trim() || "gemini-3.6-flash";
const ANALYZE_TIMEOUT = 300_000; // el analisis de video es lento

function apiKey(): string {
  const key = getSecret("gemini");
  if (!key) throw new Error("Falta la API key de Gemini (Ajustes).");
  return key;
}

function isYouTube(url: string): boolean {
  return /(?:^|\.)(youtube\.com|youtu\.be)/i.test(url);
}

function buildPrompt(contexto: string): string {
  return `Analiza este VIDEO (imagen + audio) y describe su estructura temporal, ritmo de montaje,
recursos visuales, hook inicial, y por que funciona, para reinterpretar el CONCEPTO (no copiar) en
otro nicho. Presta atencion a lo que se ve, no solo a los metadatos.
Datos ya conocidos: ${contexto}
Responde en espanol, conciso y accionable (5-8 frases).`;
}

interface GenResp {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

function textFrom(data: GenResp): string {
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/** Analiza un viral de YouTube pasando la URL nativa (sin descarga). */
async function analyzeYouTube(url: string, prompt: string, key: string): Promise<string> {
  const data = await fetchJson<GenResp>(
    `${BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ file_data: { file_uri: url } }, { text: prompt }] }],
      }),
    },
    ANALYZE_TIMEOUT,
  );
  return textFrom(data);
}

interface UploadedFile {
  name: string; // "files/abc123"
  uri: string;
  mimeType?: string;
  state?: string;
}

/** Sube un fichero local por la Files API (resumable) y devuelve su referencia. */
async function uploadFile(absPath: string, key: string): Promise<UploadedFile> {
  const bytes = fs.readFileSync(absPath);
  const lower = absPath.toLowerCase();
  const mime = lower.endsWith(".webm")
    ? "video/webm"
    : lower.endsWith(".mov")
      ? "video/quicktime"
      : "video/mp4";

  // 1) Iniciar subida resumable: la respuesta trae la URL de subida en un header.
  const start = await fetchWithTimeout(`${UPLOAD}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.length),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "viral" } }),
  });
  if (!start.ok) throw new Error(`Gemini Files API respondio ${start.status} al iniciar la subida.`);
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini no devolvio URL de subida.");

  // 2) Subir los bytes y finalizar.
  const finalize = await fetchWithTimeout(
    uploadUrl,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Command": "upload, finalize",
        "X-Goog-Upload-Offset": "0",
        "Content-Length": String(bytes.length),
      },
      body: bytes,
    },
    ANALYZE_TIMEOUT,
  );
  if (!finalize.ok) throw new Error(`Gemini Files API respondio ${finalize.status} al subir el video.`);
  const parsed = (await finalize.json()) as { file?: UploadedFile };
  if (!parsed.file?.name) throw new Error("Gemini no devolvio la referencia del fichero subido.");
  return parsed.file;
}

/** Espera a que el fichero subido pase a ACTIVE (procesado). */
async function waitActive(name: string, key: string): Promise<UploadedFile> {
  for (let i = 0; i < 100; i++) {
    const file = await fetchJson<UploadedFile>(
      `${BASE}/${name}?key=${encodeURIComponent(key)}`,
    );
    if (file.state === "ACTIVE") return file;
    if (file.state === "FAILED") throw new Error("Gemini no pudo procesar el video subido.");
    await sleep(3000);
  }
  throw new Error("Gemini tardo demasiado en procesar el video.");
}

async function deleteFile(name: string, key: string): Promise<void> {
  try {
    await fetchWithTimeout(`${BASE}/${name}?key=${encodeURIComponent(key)}`, { method: "DELETE" });
  } catch {
    // Borrado best-effort: el fichero caduca solo en ~48h.
  }
}

/** Descarga con yt-dlp, sube por Files API, analiza y limpia (remoto + local). */
async function analyzeViaDownload(url: string, prompt: string, key: string): Promise<string> {
  if (!hasYtDlp()) {
    throw new Error(
      "yt-dlp no esta instalado: TikTok/Instagram requieren yt-dlp para el analisis de video.",
    );
  }
  let localPath = "";
  let remoteName = "";
  try {
    localPath = downloadVideo(url);
    const file = await uploadFile(localPath, key);
    remoteName = file.name;
    const active = await waitActive(file.name, key);
    const data = await fetchJson<GenResp>(
      `${BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { file_data: { mime_type: active.mimeType ?? "video/mp4", file_uri: active.uri } },
                { text: prompt },
              ],
            },
          ],
        }),
      },
      ANALYZE_TIMEOUT,
    );
    return textFrom(data);
  } finally {
    if (remoteName) await deleteFile(remoteName, key);
    if (localPath && fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch {
        /* limpieza best-effort */
      }
    }
  }
}

/**
 * Analiza el viral fuente con Gemini (multimodal). YouTube por URL nativa; el
 * resto por descarga + Files API. Lanza si falla (extract.ts degrada a REQ-004).
 */
export async function describeViral(sourceUrl: string, contexto: string): Promise<string> {
  if (isMockE2E()) {
    await simulateMockProvider("gemini");
    return "Análisis multimodal E2E local: hook de promesa y resultado visible.";
  }
  const key = apiKey();
  const prompt = buildPrompt(contexto);
  return isYouTube(sourceUrl)
    ? analyzeYouTube(sourceUrl, prompt, key)
    : analyzeViaDownload(sourceUrl, prompt, key);
}

/**
 * Analiza un vídeo local con una instrucción estructurada y devuelve el JSON de Gemini.
 * Comparte la misma subida temporal y limpieza remota que el análisis de virales.
 */
export async function analyzeLocalVideoJson(absPath: string, prompt: string): Promise<unknown> {
  if (isMockE2E()) {
    await simulateMockProvider("gemini");
    return { source: "fixture-local", duration: 12, clips: [], recovery: "resume-completed" };
  }
  const key = apiKey();
  let remoteName = "";
  try {
    const file = await uploadFile(absPath, key);
    remoteName = file.name;
    const active = await waitActive(file.name, key);
    const data = await fetchJson<GenResp>(
      `${BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { file_data: { mime_type: active.mimeType ?? "video/mp4", file_uri: active.uri } },
              { text: prompt },
            ],
          }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.25,
            maxOutputTokens: 32_768,
          },
        }),
      },
      ANALYZE_TIMEOUT,
    );
    const output = textFrom(data);
    if (!output.trim()) throw new Error("Gemini no devolvió el análisis temporal del vídeo.");
    try {
      return JSON.parse(output);
    } catch {
      const cleaned = output.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      return JSON.parse(cleaned);
    }
  } finally {
    if (remoteName) await deleteFile(remoteName, key);
  }
}
