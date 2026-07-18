import { prisma } from "@/lib/prisma";
import { coerceDossier, type Dossier } from "@/core/dossier/types";
import {
  coerceVirales,
  DEFAULT_CRITERIO,
  type CriterioViral,
  type PatronViral,
  type Viral,
  type Virales,
} from "@/core/virales/types";
import { discoverVirales, type ViralCandidato } from "@/core/virales/discover";
import { analyzeVirales, type AnalyzeInput } from "@/core/virales/analyze";
import type { PipelineDef, PipelineNode } from "./engine";

export const REQ004_NODES = [
  { id: "input", label: "Entrada" },
  { id: "discover", label: "Buscar virales (web)" },
  { id: "rank", label: "Ranking" },
  { id: "analyze", label: "Análisis de patrones" },
] as const;

const DEFAULT_TOP = 20;

export type ReqMode = "reemplazar" | "ampliar";
export interface Req004Opts {
  ventanaDias?: number;
  modo?: ReqMode;
  cantidad?: number;
}

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
export function buildReq004Pipeline(opts: Req004Opts = {}): PipelineDef {
  const ventanaDias = opts.ventanaDias ?? DEFAULT_CRITERIO.ventanaDias;
  const modo: ReqMode = opts.modo === "ampliar" ? "ampliar" : "reemplazar";
  const cantidad = opts.cantidad && opts.cantidad > 0 ? Math.min(50, opts.cantidad) : DEFAULT_TOP;
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

      const prev = await prisma.virales.findUnique({ where: { projectId: ctx.project.id } });
      const prevVirales = prev ? coerceVirales(JSON.parse(prev.content)) : null;
      const todos: Viral[] = prevVirales?.virales ?? [];
      // reemplazar: sólo se conservan los manuales. ampliar: se conservan TODOS.
      const conservar = modo === "ampliar" ? todos : todos.filter((v) => v.origen === "manual");
      ctx.artifacts.conservar = conservar;
      ctx.artifacts.prevVirales = prevVirales;
      ctx.log(
        modo === "ampliar"
          ? `Modo ampliar: se conservan ${conservar.length} virales y se buscan ${cantidad} nuevos.`
          : `Dossier cargado. Virales manuales conservados: ${conservar.length}.`,
      );
    },
  };

  const discover: PipelineNode = {
    id: "discover",
    label: "Buscar virales (web)",
    run: async (ctx) => {
      const dossier = ctx.artifacts.dossier as Dossier;
      const conservar = (ctx.artifacts.conservar as Viral[]) ?? [];
      // En ampliar, las semillas (manual) se pasan; el resto se excluye para no repetir.
      const seed = conservar.filter((v) => v.origen === "manual").map(toCandidato);
      const excluir = conservar.map((v) => v.url).filter(Boolean);
      const candidatos = await discoverVirales(dossier, criterio, seed, excluir);
      ctx.artifacts.candidatos = candidatos;
      ctx.log(`Candidatos virales localizados: ${candidatos.length}.`);
    },
  };

  const rank: PipelineNode = {
    id: "rank",
    label: "Ranking",
    run: async (ctx) => {
      const candidatos = (ctx.artifacts.candidatos as ViralCandidato[]) ?? [];
      const conservar = (ctx.artifacts.conservar as Viral[]) ?? [];
      const conservarUrls = new Set(conservar.map((v) => normUrl(v.url)));
      const manualUrls = new Set(
        conservar.filter((v) => v.origen === "manual").map((v) => normUrl(v.url)),
      );

      if (modo === "ampliar") {
        // Sólo candidatos NUEVOS (no en lo conservado), ordenados por viralidad.
        const nuevos: AnalyzeInput[] = candidatos
          .filter((c) => !conservarUrls.has(normUrl(c.url)))
          .map((c) => ({ ...c, origen: "ia" as const }));
        nuevos.sort((a, b) => b.viralScore - a.viralScore);
        ctx.artifacts.top = nuevos.slice(0, cantidad);
        ctx.log(`Nuevos virales para analizar: ${Math.min(nuevos.length, cantidad)}.`);
        return;
      }

      const withOrigen: AnalyzeInput[] = candidatos.map((c) => ({
        ...c,
        origen: manualUrls.has(normUrl(c.url)) ? "manual" : "ia",
      }));
      withOrigen.sort((a, b) => {
        if (a.origen !== b.origen) return a.origen === "manual" ? -1 : 1;
        return b.viralScore - a.viralScore;
      });
      ctx.artifacts.top = withOrigen.slice(0, cantidad);
      ctx.log(`Top ${Math.min(withOrigen.length, cantidad)} seleccionado para análisis.`);
    },
  };

  const analyze: PipelineNode = {
    id: "analyze",
    label: "Análisis de patrones",
    run: async (ctx) => {
      const dossier = ctx.artifacts.dossier as Dossier;
      const top = (ctx.artifacts.top as AnalyzeInput[]) ?? [];
      const analizado = await analyzeVirales({ dossier, criterio, candidatos: top });

      let virales = analizado;
      if (modo === "ampliar") {
        // Añadir los nuevos analizados a lo existente (dedupe por url), conservando agregados.
        const prevVirales = ctx.artifacts.prevVirales as Virales | null;
        if (prevVirales) {
          const seen = new Set(prevVirales.virales.map((v) => normUrl(v.url)));
          const nuevos = analizado.virales.filter((v) => !seen.has(normUrl(v.url)));
          const patrones = mergePatrones(prevVirales.patronesRecurrentes, analizado.patronesRecurrentes);
          virales = {
            ...prevVirales,
            virales: [...prevVirales.virales, ...nuevos],
            patronesRecurrentes: patrones,
          };
        }
      }

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
      ctx.log(`Top de virales ${modo === "ampliar" ? "ampliado" : "generado"} (${virales.virales.length} piezas, ${virales.patronesRecurrentes.length} patrones).`);
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

/** Une patrones recurrentes previos + nuevos, sin duplicar por nombre de patrón. */
function mergePatrones(prev: PatronViral[], nuevos: PatronViral[]): PatronViral[] {
  const seen = new Set(prev.map((p) => p.patron.toLowerCase().trim()));
  const extra = nuevos.filter((p) => p.patron && !seen.has(p.patron.toLowerCase().trim()));
  return [...prev, ...extra];
}
