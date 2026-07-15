import { getEngine } from "@/core/ai";
import { getSettings } from "@/core/settings";
import type { Dossier } from "@/core/dossier/types";
import type { Competencia } from "@/core/competencia/types";
import { coercePersona, type Persona } from "./types";

/** Perfil objetivo de captacion derivado del dossier + competencia (REQ-003, paso 1). */
export interface LeadResearch {
  resumen: string;
  zona: string;
  personas: Persona[];
  perfilObjetivo: string; // que TIPO de negocio local es cliente potencial
  estrategiaGlobal: string[];
}

const SYSTEM = `Eres un estratega de captacion de clientes (lead generation) para negocios
SaaS/appweb. A partir del dossier de negocio y su competencia defines a QUIEN vender y como.
Respondes SIEMPRE en espanol y SOLO con JSON valido, sin texto adicional ni markdown.`;

/**
 * Deriva el perfil de cliente potencial (buyer personas + tipo de negocio local objetivo)
 * a partir del dossier y (opcional) la competencia. No usa web: solo razona sobre el negocio.
 * `zonaHint` es una zona opcional indicada por el usuario; si esta vacia, la IA la infiere.
 */
export async function researchTarget(
  dossier: Dossier,
  competencia: Competencia | null,
  zonaHint = "",
): Promise<LeadResearch> {
  const compBlock = competencia
    ? `\n## Competencia (resumen)\n${competencia.resumen}\nVentajas nuestras: ${competencia.ventajas.join(
        ", ",
      )}\nOportunidades: ${competencia.oportunidades.join(", ")}`
    : "";

  const prompt = `Define el perfil de CLIENTE POTENCIAL para este negocio: negocios locales reales
que serian buenos clientes de la appweb. Deriva a quien vender y en que zona buscar.

## Dossier
- Negocio: ${dossier.negocio}
- Propuesta de valor: ${dossier.propuestaValor}
- Nicho/sector: ${dossier.nicho}
- Publico objetivo: ${dossier.publicoObjetivo}
- Funcionalidades: ${dossier.funcionalidades.join(", ")}
- Puntos de dolor que resuelve: ${dossier.puntosDolor.join(", ")}${compBlock}

## Zona objetivo
${zonaHint ? `El usuario indica esta zona: "${zonaHint}". Usala.` : "No se indico zona; infiere una zona verosimil (ciudad/area) a partir del publico objetivo, o usa 'Espana' si no hay pista."}

## Instruccion
Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma exacta:
{
  "resumen": "panorama de la oportunidad de captacion en 2-3 frases",
  "zona": "ciudad/area geografica objetivo",
  "perfilObjetivo": "descripcion concreta del TIPO de negocio local a buscar (ej. 'restaurantes de menu diario en Madrid centro')",
  "personas": [
    { "nombre": "nombre de la persona-tipo", "rol": "cargo/decisor", "dolores": ["dolor concreto"], "trigger": "que le hace buscar solucion" }
  ],
  "estrategiaGlobal": ["prioridades y quick wins de captacion transversales"]
}
No incluyas nada fuera del JSON.`;

  const settings = getSettings();
  const engine = getEngine(settings.aiEngine);
  const result = await engine.run({ system: SYSTEM, prompt, json: true, model: settings.aiModel });

  const data = (result.data ?? tryParse(result.text)) as Record<string, unknown> | null;
  const o = data ?? {};
  return {
    resumen: String(o.resumen ?? "").trim(),
    zona: String(o.zona ?? zonaHint ?? "").trim(),
    perfilObjetivo: String(o.perfilObjetivo ?? "").trim(),
    personas: Array.isArray(o.personas) ? o.personas.map(coercePersona) : [],
    estrategiaGlobal: Array.isArray(o.estrategiaGlobal)
      ? o.estrategiaGlobal.map((x) => String(x)).filter(Boolean)
      : [],
  };
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
