import { getEngine } from "@/core/ai";
import { getSettings } from "@/core/settings";
import type { Dossier } from "@/core/dossier/types";

export interface CompetidorSemilla {
  nombre: string;
  url: string;
  motivo: string;
}

const MAX_COMPETIDORES = 5;

const SYSTEM = `Eres un analista de mercado experto en descubrir competidores directos de
productos SaaS/appwebs. Respondes SIEMPRE en espanol y SOLO con JSON valido, sin texto
adicional ni markdown.`;

/**
 * Propone competidores directos a partir del dossier (REQ-002, descubrimiento IA).
 * `seedUrls` son URLs que deben conservarse siempre (p. ej. competidores anadidos a mano).
 */
export async function discoverCompetidores(
  dossier: Dossier,
  seedUrls: string[] = [],
): Promise<CompetidorSemilla[]> {
  const prompt = `A partir de este dossier de negocio, identifica hasta ${MAX_COMPETIDORES}
COMPETIDORES DIRECTOS reales (empresas/productos que compiten por el mismo publico y nicho).

## Dossier
- Negocio: ${dossier.negocio}
- Propuesta de valor: ${dossier.propuestaValor}
- Nicho/sector: ${dossier.nicho}
- Publico objetivo: ${dossier.publicoObjetivo}
- Funcionalidades: ${dossier.funcionalidades.join(", ")}

## Instruccion
Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma exacta:
{
  "competidores": [
    { "nombre": "nombre del competidor", "url": "https://dominio-oficial.com", "motivo": "por que compite directamente" }
  ]
}
Usa URLs de sitios oficiales reales y verosimiles. No incluyas al propio proyecto analizado.
No incluyas nada fuera del JSON.`;

  const settings = getSettings();
  const engine = getEngine(settings.aiEngine);
  const result = await engine.run({ system: SYSTEM, prompt, json: true, model: settings.aiModel });

  const data = (result.data ?? tryParse(result.text)) as { competidores?: unknown } | null;
  const rawList = data?.competidores;
  const propuestos: CompetidorSemilla[] = Array.isArray(rawList)
    ? rawList.map((c) => {
        const o = (c ?? {}) as Record<string, unknown>;
        return {
          nombre: String(o.nombre ?? "").trim(),
          url: String(o.url ?? "").trim(),
          motivo: String(o.motivo ?? "").trim(),
        };
      })
    : [];

  // Las semillas (manuales) van primero y siempre se conservan.
  const semillas: CompetidorSemilla[] = seedUrls
    .filter(Boolean)
    .map((url) => ({ nombre: "", url: url.trim(), motivo: "Anadido manualmente" }));

  const merged = dedupeByDomain([...semillas, ...propuestos]).filter((c) => c.url);
  return merged.slice(0, MAX_COMPETIDORES);
}

function domainOf(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url.toLowerCase();
  }
}

function dedupeByDomain(list: CompetidorSemilla[]): CompetidorSemilla[] {
  const seen = new Set<string>();
  const out: CompetidorSemilla[] = [];
  for (const c of list) {
    const key = domainOf(c.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
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
