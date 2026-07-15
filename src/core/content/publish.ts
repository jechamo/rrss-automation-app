// REQ-010 — Publicación asistida (opción A, D-06): sin APIs oficiales ni tokens.
// El flujo deja el vídeo descargable + el copy en el portapapeles y abre la red
// destino en el navegador para que el usuario pegue y publique en un par de clics.
import type { ContentPiece, Plataforma } from "./types";

export interface PublishTarget {
  id: Plataforma;
  label: string;
  uploadUrl: string; // página de subida en el navegador
  hint: string;
}

// URLs de subida web (no APIs): abren el estudio/creador de cada red.
export const PUBLISH_TARGETS: Record<Plataforma, PublishTarget> = {
  youtube: {
    id: "youtube",
    label: "YouTube",
    uploadUrl: "https://www.youtube.com/upload",
    hint: "Abre YouTube Studio → Subir. Vertical = Short.",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    uploadUrl: "https://www.tiktok.com/upload",
    hint: "Subir vídeo desde el navegador y pegar el copy.",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    uploadUrl: "https://www.instagram.com/",
    hint: "Instagram web → Crear → Reel/Publicación.",
  },
};

export const PUBLISH_TARGET_LIST: PublishTarget[] = [
  PUBLISH_TARGETS.youtube,
  PUBLISH_TARGETS.tiktok,
  PUBLISH_TARGETS.instagram,
];

/** Copy sugerido para la caption del post: gancho + CTA + hashtags. */
export function composeCaption(piece: ContentPiece): string {
  const g = piece.content.guion;
  const titulo = piece.titulo || g.gancho;
  const cuerpo = [titulo, g.cta].map((s) => s.trim()).filter(Boolean).join("\n\n");
  const tags = g.hashtags.filter(Boolean).join(" ");
  return [cuerpo, tags].filter(Boolean).join("\n\n");
}

/** Ruta relativa del vídeo final a publicar (montaje > grabación de la app). */
export function finalVideoPath(piece: ContentPiece): string {
  return piece.assets.videoPath || piece.assets.recordingPath || "";
}
