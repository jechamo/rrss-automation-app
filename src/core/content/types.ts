// Tipos de REQ-005 (generacion de contenido: clonado de viral por reinterpretacion).
// Una pieza (ContentPiece) = un video en produccion. Hay MUCHAS por proyecto.
// En BD, content/config/assets se guardan como String JSON; aqui se tipan y se
// normalizan con coerce* (los datos de IA/proveedores vienen poco estructurados).

export type Rama = "fal" | "heygen";
export type Plataforma = "youtube" | "tiktok" | "instagram";
export type PieceStatus = "borrador" | "generando" | "listo" | "publicado" | "error";
export type VozProveedor = "elevenlabs" | "heygen";

/** Un plano del storyboard/escaleta. */
export interface Shot {
  n: number;
  descripcion: string; // que se ve en el plano
  prompt: string; // prompt de video para fal.ai (rama fal)
  texto: string; // texto en pantalla / subtitulo del plano
  segundos: number;
}

export interface Guion {
  gancho: string; // hook original reinterpretado (no copia)
  desarrollo: string;
  cta: string;
  locucion: string; // texto completo para locucion (ElevenLabs / HeyGen)
  hashtags: string[];
  duracionTotal: number; // segundos estimados
}

/** El blob `content` de la pieza: el plan creativo (sin binarios). */
export interface PieceContent {
  plataforma: Plataforma;
  guion: Guion;
  escaleta: Shot[];
  patronAplicado: string; // que patron transferible del viral se reinterpreto
  notaLegal: string; // recordatorio: concepto reinterpretado, no copia
}

/** El blob `config`: eleccion de proveedores/atributos por pieza. */
export interface MediaConfig {
  rama: Rama; // fal (cortes generados) | heygen (avatar con foto+voz)
  // video
  videoAuto: boolean; // true = la IA elige el modelo; false = usa videoModelo
  videoModelo: string; // id de modelo fal / avatar id heygen ("" si auto)
  // voz
  vozProveedor: VozProveedor;
  vozAuto: boolean; // true = voz por defecto del proveedor
  vozId: string; // id de voz ("" si auto)
  // comprension del viral fuente
  usarGemini: boolean; // true = analizar el video con Gemini; false = reusar datos REQ-004
}

/** El blob `assets`: rutas/urls de lo generado. */
export interface PieceAssets {
  videoPath: string; // ruta local en data/media/<id>/ (rama fal: montaje; heygen: avatar)
  audioPath: string; // locucion (rama fal)
  clips: string[]; // cortes de fal por plano
  externalUrl: string; // url del proveedor si no se descargo
  logs: string[]; // trazas de generacion
}

export interface ContentPiece {
  id: string;
  origin: "viral" | "own";
  sourceUrl: string;
  titulo: string;
  plataforma: Plataforma;
  status: PieceStatus;
  content: PieceContent;
  config: MediaConfig;
  assets: PieceAssets;
  runId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const PLATAFORMAS: Plataforma[] = ["youtube", "tiktok", "instagram"];

export const DEFAULT_CONFIG: MediaConfig = {
  rama: "fal",
  videoAuto: true,
  videoModelo: "",
  vozProveedor: "elevenlabs",
  vozAuto: true,
  vozId: "",
  usarGemini: false,
};

export const EMPTY_GUION: Guion = {
  gancho: "",
  desarrollo: "",
  cta: "",
  locucion: "",
  hashtags: [],
  duracionTotal: 0,
};

export const EMPTY_CONTENT: PieceContent = {
  plataforma: "youtube",
  guion: { ...EMPTY_GUION },
  escaleta: [],
  patronAplicado: "",
  notaLegal: "Concepto reinterpretado para nuestra marca; no reproduce el video original.",
};

export const EMPTY_ASSETS: PieceAssets = {
  videoPath: "",
  audioPath: "",
  clips: [],
  externalUrl: "",
  logs: [],
};

// ---- coerce (defensivo) ----

function str(v: unknown, def = ""): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : def;
}
function num(v: unknown, def = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : def;
}
function bool(v: unknown, def = false): boolean {
  return typeof v === "boolean" ? v : def;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function strArr(v: unknown): string[] {
  return arr(v).map((x) => str(x)).filter(Boolean);
}

function coercePlataforma(v: unknown): Plataforma {
  const s = str(v).toLowerCase();
  return s === "tiktok" || s === "instagram" ? s : "youtube";
}

export function coerceShot(raw: unknown, i = 0): Shot {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    n: num(o.n, i + 1),
    descripcion: str(o.descripcion),
    prompt: str(o.prompt),
    texto: str(o.texto),
    segundos: num(o.segundos, 3),
  };
}

export function coerceGuion(raw: unknown): Guion {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    gancho: str(o.gancho),
    desarrollo: str(o.desarrollo),
    cta: str(o.cta),
    locucion: str(o.locucion),
    hashtags: strArr(o.hashtags),
    duracionTotal: num(o.duracionTotal),
  };
}

export function coerceContent(raw: unknown): PieceContent {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    plataforma: coercePlataforma(o.plataforma),
    guion: coerceGuion(o.guion),
    escaleta: arr(o.escaleta).map((s, i) => coerceShot(s, i)),
    patronAplicado: str(o.patronAplicado),
    notaLegal: str(o.notaLegal, EMPTY_CONTENT.notaLegal),
  };
}

export function coerceConfig(raw: unknown): MediaConfig {
  const o = (raw ?? {}) as Record<string, unknown>;
  const rama: Rama = str(o.rama) === "heygen" ? "heygen" : "fal";
  const vozProveedor: VozProveedor = str(o.vozProveedor) === "heygen" ? "heygen" : "elevenlabs";
  return {
    rama,
    videoAuto: bool(o.videoAuto, true),
    videoModelo: str(o.videoModelo),
    vozProveedor,
    vozAuto: bool(o.vozAuto, true),
    vozId: str(o.vozId),
    usarGemini: bool(o.usarGemini, false),
  };
}

export function coerceAssets(raw: unknown): PieceAssets {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    videoPath: str(o.videoPath),
    audioPath: str(o.audioPath),
    clips: strArr(o.clips),
    externalUrl: str(o.externalUrl),
    logs: strArr(o.logs),
  };
}

/** Fila Prisma (columnas escalares + blobs JSON) -> DTO ContentPiece tipado. */
export interface PieceRow {
  id: string;
  origin: string;
  sourceUrl: string | null;
  titulo: string;
  plataforma: string | null;
  content: string;
  config: string;
  assets: string;
  runId: string | null;
  status: string;
  version: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

export function rowToPiece(row: PieceRow): ContentPiece {
  const status = str(row.status, "borrador") as PieceStatus;
  return {
    id: row.id,
    origin: row.origin === "own" ? "own" : "viral",
    sourceUrl: str(row.sourceUrl),
    titulo: str(row.titulo),
    plataforma: coercePlataforma(row.plataforma),
    status: (["borrador", "generando", "listo", "publicado", "error"] as string[]).includes(status)
      ? status
      : "borrador",
    content: coerceContent(safeParse(row.content ?? "{}")),
    config: coerceConfig(safeParse(row.config ?? "{}")),
    assets: coerceAssets(safeParse(row.assets ?? "{}")),
    runId: row.runId ?? null,
    version: num(row.version, 1),
    createdAt: typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString(),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : row.updatedAt.toISOString(),
  };
}
