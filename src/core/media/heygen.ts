import { randomUUID } from "node:crypto";
import { getSecret } from "@/core/secrets/vault";
import { fetchWithTimeout, sleep } from "./http";
import { downloadTo, saveBytes } from "./storage";
import { isMockE2E } from "@/core/runtime/e2e-profile";
import { mockProviderAsset, mockProviderOptions } from "@/core/testing/mock-providers";
import { simulateMockProvider } from "@/core/testing/mock-runtime";
import type { MediaOption } from "./types";
import {
  buildHeygenVideoBody,
  classifyPollStatus,
  isRetriableStatus,
  providerHttpError,
  retryDelayMs,
} from "./contracts";

// Conector HeyGen (API v3 oficial, revisada 2026-07-18):
//   - listado paginado de voces (/v3/voices) y avatar looks (/v3/avatars/looks);
//   - subida de foto/audio (/v3/assets, multipart) -> asset_id;
//   - creacion de Photo Avatar (/v3/avatars) -> avatar_id (look id);
//   - generacion de video (/v3/videos) con voz de catalogo (script+voice_id) o
//     audio propio (audio_asset_id), y polling (/v3/videos/:id) hasta completar.
// Docs: https://developers.heygen.com/reference/create-video ,
//       https://developers.heygen.com/photo-avatar

const BASE = "https://api.heygen.com";
const LONG_TIMEOUT = 120_000; // subidas/creaciones pueden tardar

function key(): string {
  const k = getSecret("heygen");
  if (!k) throw new Error("Falta la API key de HeyGen (Ajustes).");
  return k;
}

/**
 * fetch a HeyGen con reintentos en 429/5xx (respeta Retry-After) y parsing del
 * error del proveedor. Nunca incluye la API key en el mensaje de error.
 */
async function heygenFetch(
  path: string,
  init: RequestInit = {},
  { retries = 3, timeout = 60_000 }: { retries?: number; timeout?: number } = {},
): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("X-Api-Key", key());
  let lastErr = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetchWithTimeout(`${BASE}${path}`, { ...init, headers }, timeout);
    if (res.ok) {
      const text = await res.text();
      return text ? JSON.parse(text) : {};
    }
    const body = await res.text().catch(() => "");
    lastErr = providerHttpError("HeyGen", res.status, body);
    const retriable = isRetriableStatus(res.status);
    if (!retriable || attempt === retries) throw new Error(lastErr);
    await sleep(retryDelayMs(res.headers.get("Retry-After"), attempt));
  }
  throw new Error(lastErr || "HeyGen: error desconocido.");
}

interface Paginated<T> {
  data?: T[];
  has_more?: boolean;
  next_token?: string | null;
}

async function paginate<T>(path: string, limit = 100): Promise<T[]> {
  const out: T[] = [];
  let token: string | null = null;
  // Tope de seguridad para no iterar indefinidamente.
  for (let page = 0; page < 20; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${path}${sep}limit=${limit}${token ? `&token=${encodeURIComponent(token)}` : ""}`;
    const res = (await heygenFetch(url)) as Paginated<T>;
    if (Array.isArray(res.data)) out.push(...res.data);
    if (!res.has_more || !res.next_token) break;
    token = res.next_token;
  }
  return out;
}

interface VoiceItem {
  voice_id: string;
  name: string;
  language?: string;
  gender?: string;
  preview_audio_url?: string | null;
}

export async function listVoices(): Promise<MediaOption[]> {
  if (isMockE2E()) {
    await simulateMockProvider("heygen");
    return mockProviderOptions("heygen-voices");
  }
  const voices = await paginate<VoiceItem>("/v3/voices?type=public");
  return voices.map((v) => ({
    id: v.voice_id,
    label: v.name,
    hint: [v.language, v.gender].filter(Boolean).join(" · ") || undefined,
    preview: v.preview_audio_url || undefined,
  }));
}

interface LookItem {
  id: string;
  name: string;
  avatar_type?: string;
  preview_image_url?: string | null;
  preview_video_url?: string | null;
  gender?: string | null;
  status?: "processing" | "pending_consent" | "failed" | "completed" | null;
  error?: { message?: string } | null;
}

/** Lista avatar looks (el `id` del look es el `avatar_id` para generar video). */
export async function listAvatars(): Promise<MediaOption[]> {
  if (isMockE2E()) {
    await simulateMockProvider("heygen");
    return mockProviderOptions("heygen-avatars");
  }
  // Sin ownership devuelve presets publicos y avatares propios.
  const looks = await paginate<LookItem>("/v3/avatars/looks", 50);
  return looks.map((l) => ({
    id: l.id,
    label: l.name,
    hint: l.gender || undefined,
    preview: l.preview_image_url || l.preview_video_url || undefined,
  }));
}

export interface UploadedAsset {
  assetId: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

/** Sube un fichero (imagen/audio) a HeyGen y devuelve su asset_id. */
export async function uploadAsset(
  bytes: Buffer,
  filename: string,
  mime: string,
): Promise<UploadedAsset> {
  if (isMockE2E()) {
    await simulateMockProvider("heygen");
    return { assetId: "asset-e2e", url: "http://localhost/asset-e2e", mimeType: mime, sizeBytes: bytes.length };
  }
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), filename);
  const res = (await heygenFetch(
    "/v3/assets",
    { method: "POST", body: fd, headers: { "Idempotency-Key": randomUUID() } },
    { timeout: LONG_TIMEOUT },
  )) as { data?: { asset_id: string; url: string; mime_type: string; size_bytes: number } };
  const d = res.data;
  if (!d?.asset_id) throw new Error("HeyGen no devolvio asset_id al subir el fichero.");
  return { assetId: d.asset_id, url: d.url, mimeType: d.mime_type, sizeBytes: d.size_bytes };
}

/** Crea un Photo Avatar a partir de un asset de imagen ya subido. Devuelve avatar_id. */
export async function createPhotoAvatar(name: string, imageAssetId: string): Promise<string> {
  if (isMockE2E()) {
    await simulateMockProvider("heygen");
    return "avatar-e2e";
  }
  const res = (await heygenFetch(
    "/v3/avatars",
    {
      method: "POST",
      body: JSON.stringify({
        type: "photo",
        name: name || "RRSS Studio avatar",
        file: { type: "asset_id", asset_id: imageAssetId },
      }),
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
    },
    { timeout: LONG_TIMEOUT },
  )) as { data?: { avatar_item?: LookItem } };
  const avatar = res.data?.avatar_item;
  const id = avatar?.id;
  if (!id) throw new Error("HeyGen no devolvio el avatar creado.");
  if (avatar.status === "failed") {
    throw new Error(`HeyGen no pudo crear el avatar: ${avatar.error?.message ?? "sin detalle"}.`);
  }
  if (avatar.status === "processing") {
    // Los Photo Avatars pueden requerir un breve procesamiento antes de usarse.
    for (let attempt = 0; attempt < 60; attempt++) {
      await sleep(5000);
      const looks = await paginate<LookItem>("/v3/avatars/looks?ownership=private", 50);
      const current = looks.find((look) => look.id === id);
      if (current?.status === "completed" || (current && !current.status)) return id;
      if (current?.status === "failed") {
        throw new Error(
          `HeyGen no pudo procesar el avatar: ${current.error?.message ?? "sin detalle"}.`,
        );
      }
    }
    throw new Error("HeyGen: timeout esperando a que el avatar esté listo.");
  }
  return id;
}

export interface GenerateAvatarArgs {
  pieceId: string;
  avatarId: string;
  /** Nombre de fichero de salida (por defecto avatar.mp4). */
  outName?: string;
  /** Narracion con voz de catalogo. */
  texto?: string;
  voiceId?: string;
  /** O narracion con audio propio ya subido como asset. */
  audioAssetId?: string;
  aspectRatio?: "9:16" | "16:9" | "1:1" | "auto";
  resolution?: "720p" | "1080p";
}

/**
 * Genera un video de avatar hablando y lo descarga. Debe usarse exactamente una
 * fuente de audio: (texto + voiceId) o audioAssetId. Devuelve la ruta relativa.
 */
export async function generateAvatarVideo(args: GenerateAvatarArgs): Promise<string> {
  if (isMockE2E()) {
    await simulateMockProvider("heygen");
    const asset = mockProviderAsset("heygen-video", args.pieceId);
    return saveBytes(args.pieceId, args.outName ?? asset.name, asset.bytes);
  }
  const body = buildHeygenVideoBody(args);

  const gen = (await heygenFetch(
    "/v3/videos",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
    },
    { timeout: LONG_TIMEOUT },
  )) as { data?: { video_id?: string } };
  const videoId = gen.data?.video_id;
  if (!videoId) throw new Error("HeyGen no devolvio video_id.");

  // Polling hasta completed|failed (hasta ~10 min).
  for (let i = 0; i < 120; i++) {
    await sleep(5000);
    const st = (await heygenFetch(`/v3/videos/${videoId}`)) as {
      data?: { status?: string; video_url?: string; failure_message?: string };
    };
    const pollState = classifyPollStatus(st.data?.status);
    if (pollState === "completed" && st.data?.video_url) {
      return downloadTo(args.pieceId, args.outName ?? "avatar.mp4", st.data.video_url);
    }
    if (pollState === "failed") {
      throw new Error(`HeyGen fallo al generar el video: ${st.data?.failure_message ?? "sin detalle"}.`);
    }
  }
  throw new Error("HeyGen: timeout esperando el video.");
}
