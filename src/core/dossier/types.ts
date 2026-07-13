/** Estructura del Dossier de negocio (Diseño §7.3, REQ-001). */
export interface Dossier {
  negocio: string;
  propuestaValor: string;
  marca: { tono: string; voz: string; identidad: string };
  ctas: string[];
  puntosDolor: string[];
  pros: string[];
  contras: string[];
  publicoObjetivo: string;
  funcionalidades: string[];
  nicho: string;
}

export const EMPTY_DOSSIER: Dossier = {
  negocio: "",
  propuestaValor: "",
  marca: { tono: "", voz: "", identidad: "" },
  ctas: [],
  puntosDolor: [],
  pros: [],
  contras: [],
  publicoObjetivo: "",
  funcionalidades: [],
  nicho: "",
};

export function coerceDossier(input: unknown): Dossier {
  const o = (input ?? {}) as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
  const marca = (o.marca ?? {}) as Record<string, unknown>;
  return {
    negocio: str(o.negocio),
    propuestaValor: str(o.propuestaValor),
    marca: { tono: str(marca.tono), voz: str(marca.voz), identidad: str(marca.identidad) },
    ctas: arr(o.ctas),
    puntosDolor: arr(o.puntosDolor),
    pros: arr(o.pros),
    contras: arr(o.contras),
    publicoObjetivo: str(o.publicoObjetivo),
    funcionalidades: arr(o.funcionalidades),
    nicho: str(o.nicho),
  };
}
