import { getEngine } from "@/core/ai";
import { getSettings } from "@/core/settings";
import type { LeadResearch } from "./research";

/** Negocio local encontrado por la IA (solo datos publicos de empresa). */
export interface LeadDescubierto {
  nombre: string;
  tipo: string;
  direccion: string;
  web: string;
  telefono: string;
  email: string;
  motivo: string;
}

const MAX_LEADS = 10;
// La busqueda web es lenta: damos mas margen que el timeout por defecto (180s).
const TIMEOUT_MS = 300_000;

const SYSTEM = `Eres un investigador de mercado que localiza negocios locales reales usando
busqueda web. SOLO recoges datos PUBLICOS de empresa (nombre comercial, direccion, web,
telefono/email publicos). NUNCA datos personales de individuos (PII). Respetas los terminos
de uso de las fuentes. Respondes SIEMPRE en espanol y, al final, SOLO con JSON valido.`;

/**
 * Localiza negocios locales reales que encajan con el perfil objetivo, usando WebSearch.
 * `seed` son leads a conservar siempre (p. ej. anadidos a mano). Devuelve datos publicos.
 */
export async function discoverLeads(
  research: LeadResearch,
  seed: LeadDescubierto[] = [],
  excluir: string[] = [],
): Promise<LeadDescubierto[]> {
  const exclusion = excluir.filter(Boolean).slice(0, 60);
  const bloqueExcluir = exclusion.length
    ? `\n## NO repitas (ya los tengo)\nEXCLUYE estos negocios ya encontrados; busca OTROS distintos:\n${exclusion.map((u) => `- ${u}`).join("\n")}\n`
    : "";
  const prompt = `Busca en la web hasta ${MAX_LEADS} NEGOCIOS LOCALES REALES que encajen con
este perfil de cliente potencial. Usa la herramienta de busqueda web para encontrarlos y
extraer sus datos PUBLICOS de empresa.

## Perfil objetivo
- Tipo de negocio a buscar: ${research.perfilObjetivo}
- Zona: ${research.zona}
- Personas/decisores: ${research.personas.map((p) => p.rol).filter(Boolean).join(", ") || "n/d"}
${bloqueExcluir}
## Reglas
- Negocios REALES y verificables (no inventes). Si no encuentras el dato, dejalo vacio "".
- SOLO datos publicos de empresa: nombre, tipo, direccion, web, telefono/email publicos.
- PROHIBIDO recoger datos personales de individuos (nombres de personas, moviles personales, etc.).
- "motivo": por que ese negocio es buen cliente potencial (senal de encaje/intencion).

## Instruccion (salida)
Tras la busqueda, responde EXCLUSIVAMENTE con un objeto JSON con esta forma exacta:
{
  "leads": [
    { "nombre": "", "tipo": "", "direccion": "", "web": "", "telefono": "", "email": "", "motivo": "" }
  ]
}
No incluyas nada fuera del JSON final.`;

  const settings = getSettings();
  const engine = getEngine(settings.aiEngine);
  const result = await engine.run({
    system: SYSTEM,
    prompt,
    json: true,
    model: settings.aiModel,
    allowedTools: ["WebSearch", "WebFetch"],
    timeoutMs: TIMEOUT_MS,
  });

  const data = (result.data ?? tryParse(result.text)) as { leads?: unknown } | null;
  const rawList = data?.leads;
  const encontrados: LeadDescubierto[] = Array.isArray(rawList)
    ? rawList.map((l) => {
        const o = (l ?? {}) as Record<string, unknown>;
        return {
          nombre: String(o.nombre ?? "").trim(),
          tipo: String(o.tipo ?? "").trim(),
          direccion: String(o.direccion ?? "").trim(),
          web: String(o.web ?? "").trim(),
          telefono: String(o.telefono ?? "").trim(),
          email: String(o.email ?? "").trim(),
          motivo: String(o.motivo ?? "").trim(),
        };
      })
    : [];

  // Semillas manuales primero; dedupe por nombre+web.
  const merged = dedupe([...seed, ...encontrados]).filter((l) => l.nombre || l.web);
  return merged.slice(0, MAX_LEADS + seed.length);
}

function keyOf(l: LeadDescubierto): string {
  const web = l.web
    ? l.web.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase()
    : "";
  return web || l.nombre.toLowerCase().trim();
}

function dedupe(list: LeadDescubierto[]): LeadDescubierto[] {
  const seen = new Set<string>();
  const out: LeadDescubierto[] = [];
  for (const l of list) {
    const k = keyOf(l);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  return out;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
