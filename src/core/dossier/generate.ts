import { getEngine } from "@/core/ai";
import { getSettings } from "@/core/settings";
import type { CrawlResult } from "@/core/crawler";
import type { RepoSummary } from "@/core/repo";
import { coerceDossier, type Dossier } from "./types";

const SYSTEM = `Eres un analista de negocio y marketing experto. Analizas productos SaaS/appwebs
y produces dossiers accionables en espanol. Respondes SIEMPRE en espanol y SOLO con JSON valido,
sin texto adicional ni markdown.`;

function buildCrawlBlock(crawl: CrawlResult): string {
  const parts = crawl.pages.map((p) => {
    return [
      `URL: ${p.url}`,
      p.title && `Titulo: ${p.title}`,
      p.description && `Meta: ${p.description}`,
      p.headings.length && `Titulares: ${p.headings.join(" | ")}`,
      p.ctas.length && `CTAs detectados: ${p.ctas.join(" | ")}`,
      p.text && `Texto: ${p.text}`,
    ]
      .filter(Boolean)
      .join("\n");
  });
  return parts.join("\n\n---\n\n");
}

function buildRepoBlock(repo: RepoSummary | null): string {
  if (!repo) return "No se aporto codigo fuente.";
  const files = repo.keyFiles.map((f) => `### ${f.path}\n${f.content}`).join("\n\n");
  return `Fuente: ${repo.source}\n\nEstructura (parcial):\n${repo.tree}\n\nFicheros clave:\n${files}`;
}

export async function generateDossier(args: {
  url: string;
  crawl: CrawlResult;
  repo: RepoSummary | null;
}): Promise<Dossier> {
  const prompt = `Analiza esta appweb y devuelve un dossier de negocio.

## Web (${args.url})
${buildCrawlBlock(args.crawl)}

## Codigo fuente
${buildRepoBlock(args.repo)}

## Instruccion
Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma exacta (en espanol, conciso y accionable):
{
  "negocio": "que es y a que se dedica",
  "propuestaValor": "propuesta de valor principal",
  "marca": { "tono": "", "voz": "", "identidad": "" },
  "ctas": ["llamadas a la accion detectadas o recomendadas"],
  "puntosDolor": ["problemas del usuario que resuelve"],
  "pros": ["puntos fuertes"],
  "contras": ["debilidades o riesgos"],
  "publicoObjetivo": "buyer persona / publico objetivo",
  "funcionalidades": ["funcionalidades clave del producto"],
  "nicho": "sector/nicho"
}
No incluyas nada fuera del JSON.`;

  const settings = getSettings();
  const engine = getEngine(settings.aiEngine);
  const result = await engine.run({ system: SYSTEM, prompt, json: true, model: settings.aiModel });

  const data = result.data ?? tryParse(result.text);
  if (!data) {
    throw new Error("El motor de IA no devolvio un JSON valido. Revisa el motor en Ajustes.");
  }
  return coerceDossier(data);
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
