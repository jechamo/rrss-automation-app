import { getEngine } from "@/core/ai";
import { getSettings } from "@/core/settings";
import type { Dossier } from "@/core/dossier/types";
import { type CriterioViral, type Plataforma } from "./types";

/** Candidato viral encontrado por la IA (metadatos aproximados de la web). */
export interface ViralCandidato {
  url: string;
  plataforma: Plataforma;
  titulo: string;
  autor: string;
  vistas: string;
  fecha: string;
  ratioAutor: number; // ~cuantas veces supera la mediana del autor
  viralScore: number; // 0-100
  formato: string;
  motivo: string; // por que destaca / senal de viralidad
}

// Buscamos mas candidatos de los que rankeamos, para tener margen al recortar a Top 20.
const MAX_CANDIDATOS = 30;
// La busqueda web es lenta: mas margen que el timeout por defecto (180s).
const TIMEOUT_MS = 300_000;

const SYSTEM = `Eres un analista de contenido viral de redes sociales. Usas busqueda web para
localizar videos virales REALES de un nicho en YouTube, TikTok e Instagram/Reels, y estimas su
viralidad relativa al autor. Respondes SIEMPRE en espanol y, al final, SOLO con JSON valido.`;

/**
 * Localiza candidatos virales del nicho en las 3 redes usando WebSearch (REQ-004).
 * `seed` son virales a conservar siempre (p. ej. anadidos a mano).
 */
export async function discoverVirales(
  dossier: Dossier,
  criterio: CriterioViral,
  seed: ViralCandidato[] = [],
  excluir: string[] = [],
): Promise<ViralCandidato[]> {
  const ventana = criterio.ventanaDias > 0 ? `${criterio.ventanaDias} dias` : "sin limite (historico)";
  const exclusion = excluir.filter(Boolean).slice(0, 60);
  const bloqueExcluir = exclusion.length
    ? `\n## NO repitas (ya los tengo)\nEXCLUYE estos videos ya encontrados; busca OTROS distintos:\n${exclusion.map((u) => `- ${u}`).join("\n")}\n`
    : "";

  const prompt = `Busca en la web hasta ${MAX_CANDIDATOS} VIDEOS VIRALES REALES del nicho, en
YouTube, TikTok e Instagram/Reels (creadores del sector en general, no solo de una marca).

## Nicho
- Sector/nicho: ${dossier.nicho}
- Publico objetivo: ${dossier.publicoObjetivo}
- Tematica del negocio: ${dossier.negocio}

## Criterio de "viral"
- Metrica: ${criterio.metrica}
- Umbral: ${criterio.umbral} (destacar sobre la mediana del propio autor, no en absoluto)
- Ventana temporal: ${ventana}

## Reglas
- Videos REALES y verificables (no inventes URLs). Si no encuentras un dato, dejalo vacio "".
- "vistas": texto tal cual lo veas (p. ej. "1.2M"). "fecha": fecha o antiguedad aproximada.
- "ratioAutor": estimacion de cuantas veces supera la mediana del autor (>=1). Si no puedes
  estimarlo, pon 1.
- "viralScore": 0-100, tu estimacion de viralidad para ordenar.
- Reparte entre las 3 plataformas si hay material.

${bloqueExcluir}
## Instruccion (salida)
Tras la busqueda, responde EXCLUSIVAMENTE con un objeto JSON con esta forma exacta:
{
  "virales": [
    { "url": "", "plataforma": "youtube|tiktok|instagram", "titulo": "", "autor": "",
      "vistas": "", "fecha": "", "ratioAutor": 1, "viralScore": 0, "formato": "", "motivo": "" }
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

  const data = (result.data ?? tryParse(result.text)) as { virales?: unknown } | null;
  const rawList = data?.virales;
  const encontrados: ViralCandidato[] = Array.isArray(rawList)
    ? rawList.map((v) => {
        const o = (v ?? {}) as Record<string, unknown>;
        return {
          url: String(o.url ?? "").trim(),
          plataforma: normPlataforma(o.plataforma),
          titulo: String(o.titulo ?? "").trim(),
          autor: String(o.autor ?? "").trim(),
          vistas: String(o.vistas ?? "").trim(),
          fecha: String(o.fecha ?? "").trim(),
          ratioAutor: toNum(o.ratioAutor, 1),
          viralScore: Math.min(100, Math.max(0, toNum(o.viralScore, 0))),
          formato: String(o.formato ?? "").trim(),
          motivo: String(o.motivo ?? "").trim(),
        };
      })
    : [];

  // Semillas manuales primero; dedupe por url.
  const merged = dedupe([...seed, ...encontrados]).filter((v) => v.url || v.titulo);
  return merged.slice(0, MAX_CANDIDATOS + seed.length);
}

function normPlataforma(v: unknown): Plataforma {
  return v === "youtube" || v === "tiktok" || v === "instagram" ? v : "youtube";
}

function toNum(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function keyOf(v: ViralCandidato): string {
  return (v.url || v.titulo).toLowerCase().trim();
}

function dedupe(list: ViralCandidato[]): ViralCandidato[] {
  const seen = new Set<string>();
  const out: ViralCandidato[] = [];
  for (const v of list) {
    const k = keyOf(v);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
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
