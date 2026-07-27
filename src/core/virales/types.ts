/** Estructura del Top de virales del nicho (REQ-004). Ver docs/01-requisitos.md §REQ-004. */

export type Plataforma = "youtube" | "tiktok" | "instagram";
export type ViralDiscoverySource = "web" | "scrapecreators" | "hybrid";
export type ViralSourceProvider = "web" | "scrapecreators";
export type RatioConfidence = "unverified" | "estimated" | "verified";
export type ViralEnrichmentLevel = "rapido" | "preciso";

/** Un bloque temporal de la estructura del video (hook, contexto, ...). */
export interface Bloque {
  bloque: string; // hook | contexto | desarrollo | giro | cta | ...
  desde: number; // segundo de inicio (aprox.)
  hasta: number; // segundo de fin (aprox.)
  nota: string;
}

export interface Hook {
  tipo: string; // pregunta | dato | promesa | conflicto | negacion | ...
  texto: string;
  segundos: number;
}

/** Metricas estructuradas cuando la fuente las facilita. */
export interface ViralMetrics {
  platformId?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  followers?: number;
  durationSeconds?: number;
  publishedAt?: string;
  thumbnailUrl?: string;
  authorId?: string;
  authorHandle?: string;
  engagementRate?: number;
  ratioConfidence?: RatioConfidence;
  authorMedianViews?: number;
  authorSampleSize?: number;
  baselineFetchedAt?: string;
  baselineCacheHit?: boolean;
  fetchedAt?: string;
}

export interface ViralDiscovery {
  source: ViralDiscoverySource;
  queries?: Partial<Record<Plataforma, string>>;
  platformCounts?: Partial<Record<Plataforma, number>>;
  creditsCharged?: number;
  creditsRemaining?: number;
  enrichmentLevel?: ViralEnrichmentLevel;
  maxCredits?: number;
  enrichmentCreditsCharged?: number;
  enrichmentRequests?: number;
  cacheHits?: number;
  authorsVerified?: number;
  authorsEstimated?: number;
  authorsUnverified?: number;
  authorsSkippedBudget?: number;
  warnings?: string[];
  searchedAt?: string;
}

/** Un video viral del nicho. */
export interface Viral {
  url: string;
  plataforma: Plataforma;
  titulo: string;
  autor: string;
  vistas: string; // texto tal cual (p. ej. "1.2M") — dato aproximado de la web
  fecha: string; // fecha o antiguedad aproximada
  ratioAutor: number; // ~cuantas veces supera la mediana del autor (>=1)
  viralScore: number; // 0-100, para ordenar el Top
  formato: string; // educativo | storytelling | tutorial | POV | listicle | ...
  hook: Hook;
  estructura: Bloque[];
  shareTrigger: string; // por que se comparte/guarda
  porQueFunciona: string;
  patronTransferible: string; // concepto reutilizable (no copia) para REQ-005/006
  origen?: "ia" | "manual"; // "manual" => se conserva al regenerar
  sourceProvider?: ViralSourceProvider;
  metrics?: ViralMetrics;
}

/** Candidato previo al analisis profundo por IA. */
export interface ViralCandidato {
  url: string;
  plataforma: Plataforma;
  titulo: string;
  autor: string;
  vistas: string;
  fecha: string;
  ratioAutor: number;
  viralScore: number;
  formato: string;
  motivo: string;
  sourceProvider?: ViralSourceProvider;
  metrics?: ViralMetrics;
}

/** Un patron recurrente detectado en >= varias piezas. */
export interface PatronViral {
  patron: string;
  frecuencia: string;
  comoAplicar: string;
}

export interface CriterioViral {
  metrica: string; // p. ej. "vistas relativas a la mediana del autor"
  umbral: string; // p. ej. ">= 5x la mediana"
  ventanaDias: number; // 7 | 14 | 30 | 0 (0 = sin limite)
}

export interface Virales {
  nicho: string;
  criterio: CriterioViral;
  discovery?: ViralDiscovery;
  virales: Viral[]; // Top ordenado por viralScore desc
  patronesRecurrentes: PatronViral[];
}

export const DEFAULT_CRITERIO: CriterioViral = {
  metrica: "vistas relativas a la mediana del autor",
  umbral: ">= 5x la mediana",
  ventanaDias: 30,
};

export const EMPTY_VIRAL: Viral = {
  url: "",
  plataforma: "youtube",
  titulo: "",
  autor: "",
  vistas: "",
  fecha: "",
  ratioAutor: 1,
  viralScore: 0,
  formato: "",
  hook: { tipo: "", texto: "", segundos: 0 },
  estructura: [],
  shareTrigger: "",
  porQueFunciona: "",
  patronTransferible: "",
  origen: "manual",
};

export const EMPTY_VIRALES: Virales = {
  nicho: "",
  criterio: { ...DEFAULT_CRITERIO },
  virales: [],
  patronesRecurrentes: [],
};

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function num(v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function plataforma(v: unknown): Plataforma {
  return v === "youtube" || v === "tiktok" || v === "instagram" ? v : "youtube";
}

function discoverySource(v: unknown): ViralDiscoverySource {
  return v === "scrapecreators" || v === "hybrid" ? v : "web";
}

function ratioConfidence(v: unknown): RatioConfidence | undefined {
  return v === "unverified" || v === "estimated" || v === "verified" ? v : undefined;
}

function enrichmentLevel(v: unknown): ViralEnrichmentLevel | undefined {
  return v === "rapido" || v === "preciso" ? v : undefined;
}

function optionalNum(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : undefined;
}

function optionalStr(v: unknown): string | undefined {
  const value = str(v).trim();
  return value || undefined;
}

function coerceMetrics(input: unknown): ViralMetrics | undefined {
  if (!input || typeof input !== "object") return undefined;
  const o = input as Record<string, unknown>;
  const metrics: ViralMetrics = {
    platformId: optionalStr(o.platformId),
    views: optionalNum(o.views),
    likes: optionalNum(o.likes),
    comments: optionalNum(o.comments),
    shares: optionalNum(o.shares),
    saves: optionalNum(o.saves),
    followers: optionalNum(o.followers),
    durationSeconds: optionalNum(o.durationSeconds),
    publishedAt: optionalStr(o.publishedAt),
    thumbnailUrl: optionalStr(o.thumbnailUrl),
    authorId: optionalStr(o.authorId),
    authorHandle: optionalStr(o.authorHandle),
    engagementRate: optionalNum(o.engagementRate),
    ratioConfidence: ratioConfidence(o.ratioConfidence),
    authorMedianViews: optionalNum(o.authorMedianViews),
    authorSampleSize: optionalNum(o.authorSampleSize),
    baselineFetchedAt: optionalStr(o.baselineFetchedAt),
    baselineCacheHit: typeof o.baselineCacheHit === "boolean" ? o.baselineCacheHit : undefined,
    fetchedAt: optionalStr(o.fetchedAt),
  };
  return Object.values(metrics).some((value) => value != null) ? metrics : undefined;
}

function coerceDiscovery(input: unknown): ViralDiscovery | undefined {
  if (!input || typeof input !== "object") return undefined;
  const o = input as Record<string, unknown>;
  const queries = (o.queries ?? {}) as Record<string, unknown>;
  const platformCounts = (o.platformCounts ?? {}) as Record<string, unknown>;
  return {
    source: discoverySource(o.source),
    queries: {
      youtube: optionalStr(queries.youtube),
      tiktok: optionalStr(queries.tiktok),
      instagram: optionalStr(queries.instagram),
    },
    platformCounts: {
      youtube: optionalNum(platformCounts.youtube),
      tiktok: optionalNum(platformCounts.tiktok),
      instagram: optionalNum(platformCounts.instagram),
    },
    creditsCharged: optionalNum(o.creditsCharged),
    creditsRemaining: optionalNum(o.creditsRemaining),
    enrichmentLevel: enrichmentLevel(o.enrichmentLevel),
    maxCredits: optionalNum(o.maxCredits),
    enrichmentCreditsCharged: optionalNum(o.enrichmentCreditsCharged),
    enrichmentRequests: optionalNum(o.enrichmentRequests),
    cacheHits: optionalNum(o.cacheHits),
    authorsVerified: optionalNum(o.authorsVerified),
    authorsEstimated: optionalNum(o.authorsEstimated),
    authorsUnverified: optionalNum(o.authorsUnverified),
    authorsSkippedBudget: optionalNum(o.authorsSkippedBudget),
    warnings: Array.isArray(o.warnings) ? o.warnings.map(str).filter(Boolean) : [],
    searchedAt: optionalStr(o.searchedAt),
  };
}

function coerceHook(input: unknown): Hook {
  const o = (input ?? {}) as Record<string, unknown>;
  return { tipo: str(o.tipo), texto: str(o.texto), segundos: num(o.segundos) };
}

function coerceBloque(input: unknown): Bloque {
  const o = (input ?? {}) as Record<string, unknown>;
  return { bloque: str(o.bloque), desde: num(o.desde), hasta: num(o.hasta), nota: str(o.nota) };
}

export function coercePatron(input: unknown): PatronViral {
  const o = (input ?? {}) as Record<string, unknown>;
  return { patron: str(o.patron), frecuencia: str(o.frecuencia), comoAplicar: str(o.comoAplicar) };
}

export function coerceViral(input: unknown): Viral {
  const o = (input ?? {}) as Record<string, unknown>;
  const origen = o.origen === "manual" ? "manual" : "ia";
  return {
    url: str(o.url),
    plataforma: plataforma(o.plataforma),
    titulo: str(o.titulo),
    autor: str(o.autor),
    vistas: str(o.vistas),
    fecha: str(o.fecha),
    ratioAutor: num(o.ratioAutor, 0),
    viralScore: num(o.viralScore, 0, 100),
    formato: str(o.formato),
    hook: coerceHook(o.hook),
    estructura: Array.isArray(o.estructura) ? o.estructura.map(coerceBloque) : [],
    shareTrigger: str(o.shareTrigger),
    porQueFunciona: str(o.porQueFunciona),
    patronTransferible: str(o.patronTransferible),
    origen,
    sourceProvider: o.sourceProvider === "scrapecreators" ? "scrapecreators" : o.sourceProvider === "web" ? "web" : undefined,
    metrics: coerceMetrics(o.metrics),
  };
}

function coerceCriterio(input: unknown): CriterioViral {
  const o = (input ?? {}) as Record<string, unknown>;
  return {
    metrica: str(o.metrica) || DEFAULT_CRITERIO.metrica,
    umbral: str(o.umbral) || DEFAULT_CRITERIO.umbral,
    ventanaDias: o.ventanaDias == null ? DEFAULT_CRITERIO.ventanaDias : num(o.ventanaDias, 0, 3650),
  };
}

export function coerceVirales(input: unknown): Virales {
  const o = (input ?? {}) as Record<string, unknown>;
  return {
    nicho: str(o.nicho),
    criterio: coerceCriterio(o.criterio),
    discovery: coerceDiscovery(o.discovery),
    virales: Array.isArray(o.virales) ? o.virales.map(coerceViral) : [],
    patronesRecurrentes: Array.isArray(o.patronesRecurrentes)
      ? o.patronesRecurrentes.map(coercePatron)
      : [],
  };
}
