/** Estructura de la ficha de competencia (REQ-002). Ver docs/01-requisitos.md §4.2. */

export interface CompetidorScores {
  producto: number; // 1-5: madurez/fortaleza de producto
  presenciaRRSS: number; // 1-5: visibilidad y capacidad de distribucion
  amenaza: number; // 1-5: amenaza competitiva para nuestro proyecto
  justificacion: string; // evidencia breve que explica las notas
}

export interface Competidor {
  nombre: string;
  url: string;
  propuestaValor: string;
  precios: string;
  pros: string[];
  contras: string[];
  diferenciadores: string; // en que se diferencia de nuestro proyecto
  scores?: CompetidorScores; // ausente en analisis antiguos → fallback de UI
  origen?: "ia" | "manual"; // "manual" => lo conservamos al regenerar
}

export interface Competencia {
  resumen: string; // panorama competitivo general
  competidores: Competidor[];
  ventajas: string[]; // nuestras ventajas frente al conjunto
  amenazas: string[]; // riesgos / amenazas competitivas
  oportunidades: string[]; // huecos / oportunidades de posicionamiento
}

export const EMPTY_COMPETENCIA: Competencia = {
  resumen: "",
  competidores: [],
  ventajas: [],
  amenazas: [],
  oportunidades: [],
};

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
}

function score(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : null;
}

export function coerceCompetidor(input: unknown): Competidor {
  const o = (input ?? {}) as Record<string, unknown>;
  const origen = o.origen === "manual" ? "manual" : "ia";
  const competidor: Competidor = {
    nombre: str(o.nombre),
    url: str(o.url),
    propuestaValor: str(o.propuestaValor),
    precios: str(o.precios),
    pros: arr(o.pros),
    contras: arr(o.contras),
    diferenciadores: str(o.diferenciadores),
    origen,
  };
  if (o.scores && typeof o.scores === "object") {
    const rawScores = o.scores as Record<string, unknown>;
    const producto = score(rawScores.producto);
    const presenciaRRSS = score(rawScores.presenciaRRSS);
    const amenaza = score(rawScores.amenaza);
    if (producto !== null && presenciaRRSS !== null && amenaza !== null) {
      competidor.scores = {
        producto,
        presenciaRRSS,
        amenaza,
        justificacion: str(rawScores.justificacion),
      };
    }
  }
  return competidor;
}

export function coerceCompetencia(input: unknown): Competencia {
  const o = (input ?? {}) as Record<string, unknown>;
  const competidores = Array.isArray(o.competidores)
    ? o.competidores.map(coerceCompetidor)
    : [];
  return {
    resumen: str(o.resumen),
    competidores,
    ventajas: arr(o.ventajas),
    amenazas: arr(o.amenazas),
    oportunidades: arr(o.oportunidades),
  };
}
