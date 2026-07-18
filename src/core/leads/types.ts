/** Estructura de leads + estrategia de captacion (REQ-003). Ver docs/01-requisitos.md §REQ-003. */

export type Temperatura = "caliente" | "templado" | "frio";
export type Canal = "correo" | "visita" | "otro";

/** Borrador generado por la IA: correo (con asunto) o guion de visita. */
export interface Borrador {
  asunto: string; // vacio si el canal es "visita"
  cuerpo: string; // texto del correo o guion de la visita
}

/** Un cliente potencial: negocio local real, solo datos publicos de empresa. */
export interface Lead {
  nombre: string; // nombre comercial del negocio
  tipo: string; // tipo de negocio / sector
  direccion: string; // direccion o zona (dato publico)
  web: string;
  telefono: string; // telefono publico de empresa
  email: string; // email publico de empresa
  motivo: string; // por que encaja (senal de intencion / fuente)
  temperatura: Temperatura;
  canalRecomendado: Canal;
  estrategia: string; // estrategia de captacion recomendada
  borrador: Borrador; // correo o guion de visita listo para revisar
  fitScore: number; // 1-5 encaje con la propuesta de valor
  intentScore: number; // 1-5 intencion/senal observable
  scoreRazon: string; // evidencia breve que justifica ambos scores
  origen?: "ia" | "manual"; // "manual" => se conserva al regenerar
}

/** Una buyer persona / segmento tipo (sin PII de personas reales). */
export interface Persona {
  nombre: string;
  rol: string;
  dolores: string[];
  trigger: string;
}

export interface Leads {
  resumen: string; // panorama de la oportunidad de captacion
  zona: string; // zona geografica objetivo (ciudad/area)
  personas: Persona[]; // buyer personas / segmentos
  leads: Lead[]; // clientes potenciales concretos
  estrategiaGlobal: string[]; // prioridades / quick wins transversales
}

export const EMPTY_BORRADOR: Borrador = { asunto: "", cuerpo: "" };

export const EMPTY_LEAD: Lead = {
  nombre: "",
  tipo: "",
  direccion: "",
  web: "",
  telefono: "",
  email: "",
  motivo: "",
  temperatura: "frio",
  canalRecomendado: "correo",
  estrategia: "",
  borrador: { ...EMPTY_BORRADOR },
  fitScore: 3,
  intentScore: 3,
  scoreRazon: "",
  origen: "manual",
};

export const EMPTY_LEADS: Leads = {
  resumen: "",
  zona: "",
  personas: [],
  leads: [],
  estrategiaGlobal: [],
};

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
}

function score(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, Math.round(n)));
}

function temperatura(v: unknown): Temperatura {
  return v === "caliente" || v === "templado" || v === "frio" ? v : "frio";
}

function canal(v: unknown): Canal {
  return v === "correo" || v === "visita" || v === "otro" ? v : "otro";
}

function coerceBorrador(input: unknown): Borrador {
  const o = (input ?? {}) as Record<string, unknown>;
  return { asunto: str(o.asunto), cuerpo: str(o.cuerpo) };
}

export function coercePersona(input: unknown): Persona {
  const o = (input ?? {}) as Record<string, unknown>;
  return {
    nombre: str(o.nombre),
    rol: str(o.rol),
    dolores: arr(o.dolores),
    trigger: str(o.trigger),
  };
}

export function coerceLead(input: unknown): Lead {
  const o = (input ?? {}) as Record<string, unknown>;
  const origen = o.origen === "manual" ? "manual" : "ia";
  return {
    nombre: str(o.nombre),
    tipo: str(o.tipo),
    direccion: str(o.direccion),
    web: str(o.web),
    telefono: str(o.telefono),
    email: str(o.email),
    motivo: str(o.motivo),
    temperatura: temperatura(o.temperatura),
    canalRecomendado: canal(o.canalRecomendado),
    estrategia: str(o.estrategia),
    borrador: coerceBorrador(o.borrador),
    fitScore: score(o.fitScore),
    intentScore: score(o.intentScore),
    scoreRazon: str(o.scoreRazon),
    origen,
  };
}

export function coerceLeads(input: unknown): Leads {
  const o = (input ?? {}) as Record<string, unknown>;
  return {
    resumen: str(o.resumen),
    zona: str(o.zona),
    personas: Array.isArray(o.personas) ? o.personas.map(coercePersona) : [],
    leads: Array.isArray(o.leads) ? o.leads.map(coerceLead) : [],
    estrategiaGlobal: arr(o.estrategiaGlobal),
  };
}
