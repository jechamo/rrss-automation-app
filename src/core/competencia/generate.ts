import { getEngine } from "@/core/ai";
import { getSettings } from "@/core/settings";
import type { Dossier } from "@/core/dossier/types";
import type { CrawlResult } from "@/core/crawler";
import { coerceCompetencia, type Competencia } from "./types";

export interface CompetidorInput {
  nombre: string;
  url: string;
  origen: "ia" | "manual";
  crawl: CrawlResult | null;
}

const SYSTEM = `Eres un analista competitivo experto. Comparas un proyecto con sus
competidores directos y produces fichas comparativas accionables en espanol. Respondes
SIEMPRE en espanol y SOLO con JSON valido, sin texto adicional ni markdown.`;

// Limite de texto por competidor para no desbordar el prompt.
const MAX_TEXT_POR_COMPETIDOR = 1500;

function buildDossierBlock(d: Dossier): string {
  return [
    `Negocio: ${d.negocio}`,
    `Propuesta de valor: ${d.propuestaValor}`,
    `Nicho/sector: ${d.nicho}`,
    `Publico objetivo: ${d.publicoObjetivo}`,
    `Funcionalidades: ${d.funcionalidades.join(", ")}`,
    `Pros: ${d.pros.join(", ")}`,
    `Contras: ${d.contras.join(", ")}`,
  ].join("\n");
}

function buildCompetidorBlock(c: CompetidorInput): string {
  const header = `### ${c.nombre || c.url} (${c.url})`;
  if (!c.crawl || c.crawl.pages.length === 0) {
    return `${header}\n(No se pudo leer la web; usa tu conocimiento general del competidor.)`;
  }
  const home = c.crawl.pages[0];
  let text = c.crawl.pages.map((p) => p.text).join(" ");
  if (text.length > MAX_TEXT_POR_COMPETIDOR) text = text.slice(0, MAX_TEXT_POR_COMPETIDOR);
  return [
    header,
    home.title && `Titulo: ${home.title}`,
    home.description && `Meta: ${home.description}`,
    c.crawl.pages.some((p) => p.headings.length) &&
      `Titulares: ${c.crawl.pages.flatMap((p) => p.headings).slice(0, 15).join(" | ")}`,
    c.crawl.pages.some((p) => p.ctas.length) &&
      `CTAs: ${c.crawl.pages.flatMap((p) => p.ctas).slice(0, 10).join(" | ")}`,
    text && `Texto: ${text}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Genera la ficha comparativa de competencia (REQ-002). */
export async function generateCompetencia(args: {
  dossier: Dossier;
  competidores: CompetidorInput[];
}): Promise<Competencia> {
  const competidoresBlock = args.competidores.map(buildCompetidorBlock).join("\n\n---\n\n");

  const prompt = `Compara NUESTRO proyecto con sus competidores directos y devuelve una ficha
comparativa de competencia.

## Nuestro proyecto (dossier)
${buildDossierBlock(args.dossier)}

## Competidores
${competidoresBlock}

## Instruccion
Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma exacta (en espanol, conciso y accionable):
{
  "resumen": "panorama competitivo general del nicho",
  "competidores": [
    {
      "nombre": "",
      "url": "",
      "propuestaValor": "propuesta de valor del competidor",
      "precios": "modelo de precios (o 'no disponible')",
      "pros": ["puntos fuertes del competidor"],
      "contras": ["debilidades del competidor"],
      "diferenciadores": "en que se diferencia respecto a nuestro proyecto"
    }
  ],
  "ventajas": ["nuestras ventajas frente al conjunto de competidores"],
  "amenazas": ["riesgos/amenazas competitivas para nuestro proyecto"],
  "oportunidades": ["huecos y oportunidades de posicionamiento a explotar"]
}
Incluye TODOS los competidores aportados, respetando su nombre y url. No incluyas nada fuera del JSON.`;

  const settings = getSettings();
  const engine = getEngine(settings.aiEngine);
  const result = await engine.run({ system: SYSTEM, prompt, json: true, model: settings.aiModel });

  const data = result.data ?? tryParse(result.text);
  if (!data) {
    throw new Error("El motor de IA no devolvio un JSON valido. Revisa el motor en Ajustes.");
  }

  const competencia = coerceCompetencia(data);
  // Preservamos el origen (ia/manual) segun la url aportada al motor.
  const origenPorUrl = new Map(args.competidores.map((c) => [normUrl(c.url), c.origen]));
  competencia.competidores = competencia.competidores.map((c) => ({
    ...c,
    origen: origenPorUrl.get(normUrl(c.url)) ?? c.origen ?? "ia",
  }));
  return competencia;
}

function normUrl(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url.toLowerCase().trim();
  }
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
