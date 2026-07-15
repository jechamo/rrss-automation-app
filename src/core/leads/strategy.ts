import { getEngine } from "@/core/ai";
import { getSettings } from "@/core/settings";
import type { Dossier } from "@/core/dossier/types";
import type { LeadResearch } from "./research";
import type { LeadDescubierto } from "./discover";
import { coerceLeads, type Lead, type Leads } from "./types";

/** Lead descubierto + su origen (para conservar los manuales al regenerar). */
export interface StrategyLeadInput extends LeadDescubierto {
  origen: "ia" | "manual";
}

const SYSTEM = `Eres un experto en captacion comercial de clientes locales. Para cada negocio
propones el canal (correo o visita al local) y redactas un borrador listo para revisar,
adaptado al tono de marca. Respondes SIEMPRE en espanol y SOLO con JSON valido, sin markdown.`;

const MAX_LEADS_PROMPT = 12;

function buildLeadsBlock(leads: StrategyLeadInput[]): string {
  return leads
    .map((l, i) => {
      const datos = [
        l.tipo && `tipo: ${l.tipo}`,
        l.direccion && `direccion: ${l.direccion}`,
        l.web && `web: ${l.web}`,
        l.telefono && `tel: ${l.telefono}`,
        l.email && `email: ${l.email}`,
        l.motivo && `motivo: ${l.motivo}`,
      ]
        .filter(Boolean)
        .join(" | ");
      return `${i + 1}. ${l.nombre || l.web || "(sin nombre)"} — ${datos}`;
    })
    .join("\n");
}

/**
 * Genera la estrategia de captacion por lead (canal + borrador + scores) y arma el objeto
 * Leads completo (REQ-003, paso 3). Conserva el origen ia/manual de cada lead.
 */
export async function generateStrategy(args: {
  dossier: Dossier;
  research: LeadResearch;
  leads: StrategyLeadInput[];
}): Promise<Leads> {
  const { dossier, research } = args;
  const leadsIn = args.leads.slice(0, MAX_LEADS_PROMPT);

  const prompt = `Para cada negocio local de la lista, define la estrategia de captacion y
redacta un borrador (correo o guion de visita) en el tono de la marca.

## Nuestro negocio
- Negocio: ${dossier.negocio}
- Propuesta de valor: ${dossier.propuestaValor}
- Tono de marca: ${dossier.marca.tono} / voz: ${dossier.marca.voz}
- CTAs habituales: ${dossier.ctas.join(", ")}

## Perfil de captacion
- Resumen: ${research.resumen}
- Zona: ${research.zona}

## Negocios (clientes potenciales)
${buildLeadsBlock(leadsIn)}

## Instruccion
Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma exacta (respeta el orden y el nombre de
cada negocio; conciso y accionable):
{
  "resumen": "${research.resumen ? "usa este resumen o mejoralo" : "panorama de captacion"}",
  "zona": "${research.zona}",
  "personas": ${JSON.stringify(research.personas)},
  "estrategiaGlobal": ${JSON.stringify(research.estrategiaGlobal)},
  "leads": [
    {
      "nombre": "", "tipo": "", "direccion": "", "web": "", "telefono": "", "email": "",
      "motivo": "",
      "temperatura": "caliente|templado|frio",
      "canalRecomendado": "correo|visita|otro",
      "estrategia": "como abordar a este negocio en 1-2 frases",
      "borrador": { "asunto": "(solo si es correo)", "cuerpo": "correo o guion de visita" },
      "fitScore": 1,
      "intentScore": 1
    }
  ]
}
Incluye TODOS los negocios de la lista, con sus datos. No incluyas nada fuera del JSON.`;

  const settings = getSettings();
  const engine = getEngine(settings.aiEngine);
  const result = await engine.run({ system: SYSTEM, prompt, json: true, model: settings.aiModel });

  const data = result.data ?? tryParse(result.text);
  if (!data) {
    throw new Error("El motor de IA no devolvio un JSON valido. Revisa el motor en Ajustes.");
  }

  const leads = coerceLeads(data);
  // Rellenar zona/personas/estrategia global si el modelo las omitio.
  if (!leads.zona) leads.zona = research.zona;
  if (leads.personas.length === 0) leads.personas = research.personas;
  if (leads.estrategiaGlobal.length === 0) leads.estrategiaGlobal = research.estrategiaGlobal;
  if (!leads.resumen) leads.resumen = research.resumen;

  // Preservar el origen (ia/manual) segun nombre/web aportados al motor.
  const origenPorKey = new Map(args.leads.map((l) => [keyOf(l.nombre, l.web), l.origen]));
  leads.leads = leads.leads.map((l: Lead) => ({
    ...l,
    origen: origenPorKey.get(keyOf(l.nombre, l.web)) ?? l.origen ?? "ia",
  }));
  return leads;
}

function keyOf(nombre: string, web: string): string {
  const w = web
    ? web.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase()
    : "";
  return w || nombre.toLowerCase().trim();
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
