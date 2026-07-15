/** Estructura del Top de virales del nicho (REQ-004). Ver docs/01-requisitos.md §REQ-004. */

export type Plataforma = "youtube" | "tiktok" | "instagram";

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
    virales: Array.isArray(o.virales) ? o.virales.map(coerceViral) : [],
    patronesRecurrentes: Array.isArray(o.patronesRecurrentes)
      ? o.patronesRecurrentes.map(coercePatron)
      : [],
  };
}
