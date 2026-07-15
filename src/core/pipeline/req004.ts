import { prisma } from "@/lib/prisma";
import { coerceDossier, type Dossier } from "@/core/dossier/types";
import { coerceVirales, DEFAULT_CRITERIO, type CriterioViral, type Viral } from "@/core/virales/types";
import { discoverVirales, type ViralCandidato } from "@/core/virales/discover";
import { analyzeVirales, type AnalyzeInput } from "@/core/virales/analyze";
import type { PipelineDef, PipelineNode } from "./engine";

export const REQ004_NODES = [
  { id: "input", label: "Entrada" },
  { id: "discover", label: "Buscar virales (web)" },
  { id: "rank", label: "Ranking Top 20" },
  { id: "analyze", label: "Análisis de patrones" },
] as const;

const TOP_N = 20;

/** Pasa un Viral guardado a candidato (para conservar los manuales). */
function toCandidato(v: Viral): ViralCandidato {
  return {
    url: v.url,
    plataforma: v.plataforma,
    titulo: v.titulo,
    autor: v.autor,
    vistas: v.vistas,
    fecha: v.fecha,
    ratioAutor: v.ratioAutor,
    viralScore: v.viralScore,
    formato: v.formato,
    motivo: v.porQueFunciona,
  };
}

/** REQ-004: Top de virales del nicho (YT/TikTok/IG via IA+web) + patrones. */
export function buildReq004Pipeline(ventanaDias = DEFAULT_CRITERIO.ventanaDias): PipelineDef {
  const criterio: CriterioViral = { ...DEFAULT_CRITERIO, ventanaDias };

  const input: PipelineNode = {
    id: "input",
    label: "Entrada",
    run: async (ctx) => {
      const dossierRow = await prisma.dossier.findUnique({
        where: { projectId: ctx.project.id },
      });
      if (!dossierRow) {
        throw new Error("Genera primero el dossier (REQ-001) antes de buscar virales del nicho.");
      }
      ctx.artifacts.dossier = coerceDossier(JSON.parse(dossierRow.content));

      // Virales manuales previos: se conservan al regenerar.
      const prev = await prisma.virales.findUnique({ where: { projectId: ctx.project.id } });
      const manual: Viral[] = prev
        ? coerceVirales(JSON.parse(prev.content)).virales.filter((v) => v.origen === "manual")
        : [];
      ctx.artifacts.manual = manual;
      ctx.log(`Dossier cargado. Virales manuales conservados: ${manual.length}.`);
    },
  };

  const discover: PipelineNode = {
    id: "discover",
    label: "Buscar virales (web)",
    run: async (ctx) => {
      const dossier = ctx.artifacts.dossier as Dossier;
      const manual = (ctx.artifacts.manual as Viral[]) ?? [];
      const seed = manual.map(toCandidato);
      const candidatos = await discoverVirales(dossier, criterio, seed);
      ctx.artifacts.candidatos = candidatos;
      ctx.log(`Candidatos virales localizados: ${candidatos.length}.`);
    },
  };

  const rank: PipelineNode = {
    id: "rank",
    label: "Ranking Top 20",
    run: async (ctx) => {
      const candidatos = (ctx.artifacts.candidatos as ViralCandidato[]) ?? [];
      const manual = (ctx.artifacts.manual as Viral[]) ?? [];
      const manualUrls = new Set(manual.map((v) => normUrl(v.url)));

      const withOrigen: AnalyzeInput[] = candidatos.map((c) => ({
        ...c,
        origen: manualUrls.has(normUrl(c.url)) ? "manual" : "ia",
      }));
      // Ordena por viralidad; los manuales se conservan aunque puntuen bajo.
      withOrigen.sort((a, b) => {
        if (a.origen !== b.origen) return a.origen === "manual" ? -1 : 1;
        return b.viralScore - a.viralScore;
      });
      const top = withOrigen.slice(0, TOP_N);
      ctx.artifacts.top = top;
      ctx.log(`Top ${top.length} seleccionado para análisis.`);
    },
  };

  const analyze: PipelineNode = {
    id: "analyze",
    label: "Análisis de patrones",
    run: async (ctx) => {
      const dossier = ctx.artifacts.dossier as Dossier;
      const top = (ctx.artifacts.top as AnalyzeInput[]) ?? [];
      const virales = await analyzeVirales({ dossier, criterio, candidatos: top });
      await prisma.virales.upsert({
        where: { projectId: ctx.project.id },
        create: {
          projectId: ctx.project.id,
          content: JSON.stringify(virales),
          status: "draft",
        },
        update: {
          content: JSON.stringify(virales),
          status: "draft",
          version: { increment: 1 },
        },
      });
      ctx.artifacts.virales = virales;
      ctx.log(`Top de virales generado (${virales.virales.length} piezas, ${virales.patronesRecurrentes.length} patrones).`);
    },
  };

  return {
    requisito: "REQ-004",
    nodes: [input, discover, rank, analyze],
    edges: [
      ["input", "discover"],
      ["discover", "rank"],
      ["rank", "analyze"],
    ],
  };
}

function normUrl(url: string): string {
  return url.toLowerCase().trim().replace(/\/+$/, "");
}
