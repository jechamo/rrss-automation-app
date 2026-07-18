import { getEngine } from "@/core/ai";
import { getSettings } from "@/core/settings";
import type { Dossier } from "@/core/dossier/types";
import type { ViralCandidato } from "./discover";
import { coerceVirales, type CriterioViral, type Viral, type Virales } from "./types";

/** Candidato + origen (para conservar los manuales al regenerar). */
export interface AnalyzeInput extends ViralCandidato {
  origen: "ia" | "manual";
}

const SYSTEM = `Eres un analista experto en contenido viral. Descompones cada video en su hook,
estructura temporal y patron transferible, y destilas patrones recurrentes del nicho para
generar contenido propio SIN copiar (reinterpretar el concepto). Respondes SIEMPRE en espanol
y SOLO con JSON valido, sin markdown.`;

const MAX_ANALIZAR = 20;
// Descomponer el Top 20 supera de largo el timeout por defecto del motor (180s):
// no debe cortarse por tiempo. Margen amplio (10 min) para motores locales lentos.
const TIMEOUT_MS = 600_000;

function buildBlock(v: AnalyzeInput, i: number): string {
  const datos = [
    v.plataforma && `plataforma: ${v.plataforma}`,
    v.autor && `autor: ${v.autor}`,
    v.vistas && `vistas: ${v.vistas}`,
    v.formato && `formato: ${v.formato}`,
    v.motivo && `motivo: ${v.motivo}`,
  ]
    .filter(Boolean)
    .join(" | ");
  return `${i + 1}. ${v.titulo || v.url} — ${datos}\n   url: ${v.url}`;
}

/**
 * Analiza el Top de candidatos virales y arma el objeto Virales completo (REQ-004, paso final).
 * Conserva el orden (ya rankeado), los metadatos y el origen ia/manual de cada pieza.
 */
export async function analyzeVirales(args: {
  dossier: Dossier;
  criterio: CriterioViral;
  candidatos: AnalyzeInput[];
}): Promise<Virales> {
  const { dossier, criterio } = args;
  const top = args.candidatos.slice(0, MAX_ANALIZAR);

  const prompt = `Analiza estos videos virales del nicho y devuelve para cada uno su descomposicion,
mas los patrones recurrentes del conjunto para replicar en contenido propio (concepto, no copia).

## Nicho
- Sector: ${dossier.nicho}
- Publico objetivo: ${dossier.publicoObjetivo}

## Criterio de viral aplicado
- ${criterio.metrica} · ${criterio.umbral} · ventana ${criterio.ventanaDias > 0 ? `${criterio.ventanaDias} dias` : "historico"}

## Videos (ya ordenados por viralidad)
${top.map(buildBlock).join("\n\n")}

## Instruccion
Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma exacta (respeta el orden y los datos de
cada video; conciso y accionable):
{
  "nicho": "${dossier.nicho}",
  "criterio": { "metrica": "${criterio.metrica}", "umbral": "${criterio.umbral}", "ventanaDias": ${criterio.ventanaDias} },
  "virales": [
    {
      "url": "", "plataforma": "youtube|tiktok|instagram", "titulo": "", "autor": "",
      "vistas": "", "fecha": "", "ratioAutor": 1, "viralScore": 0, "formato": "",
      "hook": { "tipo": "pregunta|dato|promesa|conflicto|negacion", "texto": "", "segundos": 3 },
      "estructura": [ { "bloque": "hook", "desde": 0, "hasta": 3, "nota": "" } ],
      "shareTrigger": "emocion o utilidad que hace compartir/guardar",
      "porQueFunciona": "",
      "patronTransferible": "concepto/estructura reutilizable para nuestro nicho (no copia)"
    }
  ],
  "patronesRecurrentes": [
    { "patron": "", "frecuencia": "en cuantos videos aparece", "comoAplicar": "como usarlo en nuestro contenido" }
  ]
}
Incluye TODOS los videos de la lista con sus datos. Prioriza patrones que se repiten en >=3 piezas.
No incluyas nada fuera del JSON.`;

  const settings = getSettings();
  const engine = getEngine(settings.aiEngine);
  const result = await engine.run({
    system: SYSTEM,
    prompt,
    json: true,
    model: settings.aiModel,
    timeoutMs: TIMEOUT_MS,
  });

  const data = result.data ?? tryParse(result.text);
  if (!data) {
    throw new Error("El motor de IA no devolvio un JSON valido. Revisa el motor en Ajustes.");
  }

  const virales = coerceVirales(data);
  if (!virales.nicho) virales.nicho = dossier.nicho;

  // Preservar metadatos de descubrimiento (vistas/score/ratio) y origen por url.
  const metaPorUrl = new Map(args.candidatos.map((c) => [normUrl(c.url), c]));
  virales.virales = virales.virales.map((v: Viral) => {
    const meta = metaPorUrl.get(normUrl(v.url));
    return {
      ...v,
      vistas: v.vistas || meta?.vistas || "",
      fecha: v.fecha || meta?.fecha || "",
      autor: v.autor || meta?.autor || "",
      viralScore: v.viralScore || meta?.viralScore || 0,
      ratioAutor: v.ratioAutor || meta?.ratioAutor || 1,
      origen: meta?.origen ?? v.origen ?? "ia",
    };
  });

  // Reordenar por viralScore desc y recortar a Top 20 (garantia final).
  virales.virales.sort((a, b) => b.viralScore - a.viralScore);
  virales.virales = virales.virales.slice(0, MAX_ANALIZAR);
  return virales;
}

function normUrl(url: string): string {
  return url.toLowerCase().trim().replace(/\/+$/, "");
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
