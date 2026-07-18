// Tipos de REQ-005 (generacion de contenido: clonado de viral por reinterpretacion).
// Una pieza (ContentPiece) = un video en produccion. Hay MUCHAS por proyecto.
// En BD, content/config/assets se guardan como String JSON; aqui se tipan y se
// normalizan con coerce* (los datos de IA/proveedores vienen poco estructurados).

export type Rama = "fal" | "heygen";
export type FalClipSeconds = 5 | 10 | 15; // duracion de corte fal que ofrece la UI
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

/** Modo de grabacion de la demo (REQ-006). */
export type GrabacionModo = "auto" | "manual" | "library";

/** Accion de navegacion ejecutable por Playwright (REQ-006 recorder v2). */
export type NavAction = "goto" | "tap" | "fill" | "wait" | "scroll";

export interface NavStep {
  action: NavAction;
  url?: string;
  selector?: string;
  value?: string;
  timeoutMs?: number;
  pixels?: number;
  pauseMs?: number;
}

/**
 * Config extra de REQ-006 (contenido propio de la app): que funcionalidad se
 * demuestra y como se graba. Vive dentro del blob `config` bajo `demo`.
 */
export interface DemoConfig {
  funcion: string; // nombre de la funcionalidad a mostrar
  funcionUrl: string; // ruta/URL concreta a navegar y grabar
  pasos: string[]; // pasos de navegacion (Playwright / guia manual)
  navSteps?: NavStep[]; // pasos ejecutables; opcional para compat con piezas antiguas
  videosPrevios?: number; // anti-repeticion: piezas anteriores de esta funcion
  usarLogin: boolean; // requiere login (credenciales cifradas por proyecto en el vault)
  grabacionModo: GrabacionModo;
  recordingAssetId?: string; // REQ-011: grabación reutilizable elegida de la mediateca
}

/** Como se narra un video de avatar HeyGen. */
export type HeygenNarracion = "voice" | "audio"; // voz del catalogo | audio propio subido

/**
 * Config de la rama HeyGen (avatar hablando). El avatar puede ser uno del
 * catalogo o un photo avatar creado a partir de una foto subida; la narracion
 * puede ser una voz del catalogo o un audio propio (asset subido a HeyGen).
 */
export interface HeygenConfig {
  avatarId: string; // look id de HeyGen (v3) a usar en el video
  avatarLabel: string; // nombre visible del avatar (para la UI)
  narracion: HeygenNarracion;
  voiceId: string; // narracion="voice": id de la voz elegida
  audioAssetId: string; // narracion="audio": asset_id del audio subido a HeyGen
  audioLabel: string; // nombre del audio subido (para la UI)
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
  // duracion del CORTE fal (no del montaje). 5/10/15; el modelo la ajusta a su esquema.
  falClipSeconds: FalClipSeconds;
  // comprension del viral fuente
  usarGemini: boolean; // true = analizar el video con Gemini; false = reusar datos REQ-004
  // rama="heygen": avatar/narracion. Opcional para compat con piezas antiguas.
  heygen?: HeygenConfig;
  // REQ-006 (solo piezas origin="own"): demo de la propia app
  demo?: DemoConfig;
}

/** El blob `assets`: rutas/urls de lo generado. */
export interface PieceAssets {
  videoPath: string; // ruta local en data/media/<id>/ (rama fal: montaje; heygen: avatar)
  presenterPath: string; // original HeyGen antes del montaje con el screencast
  audioPath: string; // locucion (rama fal)
  clips: string[]; // cortes de fal por plano
  recordingPath: string; // screencast de la app (REQ-006: Playwright o subido a mano)
  externalUrl: string; // url del proveedor si no se descargo
  logs: string[]; // trazas de generacion
  publishedTo: string; // REQ-010: red donde se marco publicado ("" si no)
  publishedAt: string; // REQ-010: ISO de la marca de publicacion ("" si no)
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
  falClipSeconds: 5,
  usarGemini: false,
};

/** Normaliza la duracion de corte a uno de los valores validos (default 5). */
export function coerceFalClipSeconds(v: unknown): FalClipSeconds {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  return n === 10 ? 10 : n === 15 ? 15 : 5;
}

export const EMPTY_HEYGEN: HeygenConfig = {
  avatarId: "",
  avatarLabel: "",
  narracion: "voice",
  voiceId: "",
  audioAssetId: "",
  audioLabel: "",
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
  presenterPath: "",
  audioPath: "",
  clips: [],
  recordingPath: "",
  externalUrl: "",
  logs: [],
  publishedTo: "",
  publishedAt: "",
};

export const EMPTY_DEMO: DemoConfig = {
  funcion: "",
  funcionUrl: "",
  pasos: [],
  usarLogin: false,
  grabacionModo: "auto",
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

export function coerceNavStep(raw: unknown): NavStep | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const action = str(o.action).toLowerCase();
  if (!["goto", "tap", "fill", "wait", "scroll"].includes(action)) return null;

  const step: NavStep = { action: action as NavAction };
  const url = str(o.url);
  const selector = str(o.selector);
  const value = str(o.value);
  if (url) step.url = url;
  if (selector) step.selector = selector;
  if (value) step.value = value;

  const optionalNumber = (value: unknown): number | undefined => {
    const parsed = typeof value === "number" ? value : parseFloat(String(value ?? ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const timeoutMs = optionalNumber(o.timeoutMs ?? o.timeout_ms);
  const pixels = optionalNumber(o.pixels);
  const pauseMs = optionalNumber(o.pauseMs ?? o.pause_ms);
  if (timeoutMs !== undefined) step.timeoutMs = Math.max(0, timeoutMs);
  if (pixels !== undefined) step.pixels = pixels;
  if (pauseMs !== undefined) step.pauseMs = Math.max(0, pauseMs);
  return step;
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

export function coerceDemo(raw: unknown): DemoConfig {
  const o = (raw ?? {}) as Record<string, unknown>;
  const rawMode = str(o.grabacionModo);
  const demo: DemoConfig = {
    funcion: str(o.funcion),
    funcionUrl: str(o.funcionUrl),
    pasos: strArr(o.pasos),
    usarLogin: bool(o.usarLogin, false),
    grabacionModo: rawMode === "manual" || rawMode === "library" ? rawMode : "auto",
  };
  const recordingAssetId = str(o.recordingAssetId);
  if (recordingAssetId) demo.recordingAssetId = recordingAssetId;
  const navSteps = arr(o.navSteps ?? o.nav_steps)
    .map(coerceNavStep)
    .filter((step): step is NavStep => step !== null);
  if (navSteps.length > 0) demo.navSteps = navSteps;
  const videosPrevios = num(o.videosPrevios, 0);
  if (videosPrevios > 0) demo.videosPrevios = Math.floor(videosPrevios);
  return demo;
}

export function coerceHeygen(raw: unknown, legacy?: Record<string, unknown>): HeygenConfig {
  const o = (raw ?? {}) as Record<string, unknown>;
  const narracion: HeygenNarracion = str(o.narracion) === "audio" ? "audio" : "voice";
  const heygen: HeygenConfig = {
    // Compat: piezas antiguas guardaban el avatar en config.videoModelo.
    avatarId: str(o.avatarId) || str(legacy?.videoModelo),
    avatarLabel: str(o.avatarLabel),
    narracion,
    // Compat: la voz venia en config.vozId (vacio si vozAuto).
    voiceId: str(o.voiceId) || (bool(legacy?.vozAuto, true) ? "" : str(legacy?.vozId)),
    audioAssetId: str(o.audioAssetId),
    audioLabel: str(o.audioLabel),
  };
  return heygen;
}

export function coerceConfig(raw: unknown): MediaConfig {
  const o = (raw ?? {}) as Record<string, unknown>;
  const rama: Rama = str(o.rama) === "heygen" ? "heygen" : "fal";
  const vozProveedor: VozProveedor = str(o.vozProveedor) === "heygen" ? "heygen" : "elevenlabs";
  const config: MediaConfig = {
    rama,
    videoAuto: bool(o.videoAuto, true),
    videoModelo: str(o.videoModelo),
    vozProveedor,
    vozAuto: bool(o.vozAuto, true),
    vozId: str(o.vozId),
    falClipSeconds: coerceFalClipSeconds(o.falClipSeconds),
    usarGemini: bool(o.usarGemini, false),
  };
  // Reconstruye la config HeyGen desde el objeto nuevo o desde los campos legacy.
  if (rama === "heygen" || (o.heygen && typeof o.heygen === "object")) {
    config.heygen = coerceHeygen(o.heygen, o);
  }
  if (o.demo && typeof o.demo === "object") config.demo = coerceDemo(o.demo);
  return config;
}

/** Validacion compartida antes de crear una pieza o consumir un proveedor. */
export function validateMediaConfig(config: MediaConfig): string {
  if (config.rama === "fal") {
    if (!config.videoAuto && !config.videoModelo) return "Elige un modelo de vídeo o activa Auto.";
    if (!config.vozAuto && !config.vozId) return "Elige una voz o activa Auto.";
    return "";
  }

  const heygen = config.heygen;
  if (!heygen?.avatarId) return "Elige un avatar o sube una foto.";
  if (heygen.narracion === "voice") {
    if (!heygen.voiceId) return "Elige una voz para el avatar.";
    if (heygen.audioAssetId) return "La narración debe usar una sola fuente de audio.";
  } else {
    if (!heygen.audioAssetId) return "Sube un audio para la narración.";
    if (heygen.voiceId) return "La narración debe usar una sola fuente de audio.";
  }
  return "";
}

export function coerceAssets(raw: unknown): PieceAssets {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    videoPath: str(o.videoPath),
    presenterPath: str(o.presenterPath),
    audioPath: str(o.audioPath),
    clips: strArr(o.clips),
    recordingPath: str(o.recordingPath),
    externalUrl: str(o.externalUrl),
    logs: strArr(o.logs),
    publishedTo: str(o.publishedTo),
    publishedAt: str(o.publishedAt),
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
