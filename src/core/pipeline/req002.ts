import { prisma } from "@/lib/prisma";
import { crawlSite, type CrawlResult } from "@/core/crawler";
import { coerceDossier, type Dossier } from "@/core/dossier/types";
import { coerceCompetencia, type Competencia, type Competidor } from "@/core/competencia/types";
import { discoverCompetidores, type CompetidorSemilla } from "@/core/competencia/discover";
import { generateCompetencia, type CompetidorInput } from "@/core/competencia/generate";
import type { PipelineDef, PipelineNode } from "./engine";

export const REQ002_NODES = [
  { id: "input", label: "Entrada" },
  { id: "discover", label: "Descubrir competidores" },
  { id: "crawl", label: "Crawl competidores" },
  { id: "compare", label: "Comparativa IA" },
] as const;

function domainOf(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url.toLowerCase().trim();
  }
}

export type ReqMode = "reemplazar" | "ampliar";
export interface Req002Opts {
  modo?: ReqMode;
}

export function buildReq002Pipeline(opts: Req002Opts = {}): PipelineDef {
  const modo: ReqMode = opts.modo === "ampliar" ? "ampliar" : "reemplazar";

  const input: PipelineNode = {
    id: "input",
    label: "Entrada",
    run: async (ctx) => {
      const dossierRow = await prisma.dossier.findUnique({
        where: { projectId: ctx.project.id },
      });
      if (!dossierRow) {
        throw new Error("Genera primero el dossier (REQ-001) antes de analizar la competencia.");
      }
      const dossier = coerceDossier(JSON.parse(dossierRow.content));
      ctx.artifacts.dossier = dossier;

      const prev = await prisma.competencia.findUnique({ where: { projectId: ctx.project.id } });
      const prevComp = prev ? coerceCompetencia(JSON.parse(prev.content)) : null;
      const todos: Competidor[] = prevComp?.competidores ?? [];
      const manual = todos.filter((c) => c.origen === "manual");
      ctx.artifacts.manual = manual;
      ctx.artifacts.prevComp = prevComp;
      ctx.artifacts.existentesUrls = todos.map((c) => c.url).filter(Boolean);
      ctx.log(
        modo === "ampliar"
          ? `Modo ampliar: se conservan ${todos.length} competidores y se buscan otros nuevos.`
          : `Dossier cargado. Competidores manuales conservados: ${manual.length}.`,
      );
    },
  };

  const discover: PipelineNode = {
    id: "discover",
    label: "Descubrir competidores",
    run: async (ctx) => {
      const dossier = ctx.artifacts.dossier as Dossier;
      const manual = (ctx.artifacts.manual as Competidor[]) ?? [];
      const existentesUrls = (ctx.artifacts.existentesUrls as string[]) ?? [];
      // ampliar: manual ya conservado → no re-sembrar; excluir TODO lo existente.
      const seedUrls = modo === "ampliar" ? [] : manual.map((c) => c.url).filter(Boolean);
      const excluir = modo === "ampliar" ? existentesUrls : [];
      const semillas = await discoverCompetidores(dossier, seedUrls, excluir);
      ctx.artifacts.semillas = semillas;
      ctx.log(`Competidores identificados: ${semillas.length}.`);
    },
  };

  const crawl: PipelineNode = {
    id: "crawl",
    label: "Crawl competidores",
    run: async (ctx) => {
      const semillas = (ctx.artifacts.semillas as CompetidorSemilla[]) ?? [];
      const manual = (ctx.artifacts.manual as Competidor[]) ?? [];
      const existentesUrls = (ctx.artifacts.existentesUrls as string[]) ?? [];
      const manualDomains = new Set(manual.map((c) => domainOf(c.url)));
      const nameByDomain = new Map(manual.map((c) => [domainOf(c.url), c.nombre]));
      // En ampliar, evita recrawlear competidores ya existentes.
      const existentesDomains = new Set(existentesUrls.map(domainOf));
      const aProcesar =
        modo === "ampliar" ? semillas.filter((s) => !existentesDomains.has(domainOf(s.url))) : semillas;

      const inputs: CompetidorInput[] = [];
      for (const s of aProcesar) {
        let crawlResult: CrawlResult | null = null;
        try {
          crawlResult = await crawlSite(s.url, 3);
          if (crawlResult.pages.length === 0) crawlResult = null;
        } catch {
          crawlResult = null;
        }
        const dom = domainOf(s.url);
        inputs.push({
          nombre: s.nombre || nameByDomain.get(dom) || "",
          url: s.url,
          origen: manualDomains.has(dom) ? "manual" : "ia",
          crawl: crawlResult,
        });
        ctx.log(`${crawlResult ? "Leido" : "Sin web"}: ${s.url}`);
      }
      ctx.artifacts.competidorInputs = inputs;
    },
  };

  const compare: PipelineNode = {
    id: "compare",
    label: "Comparativa IA",
    run: async (ctx) => {
      const dossier = ctx.artifacts.dossier as Dossier;
      const competidores = (ctx.artifacts.competidorInputs as CompetidorInput[]) ?? [];
      const generada = await generateCompetencia({ dossier, competidores });

      let competencia = generada;
      if (modo === "ampliar") {
        const prevComp = ctx.artifacts.prevComp as Competencia | null;
        if (prevComp) {
          const seen = new Set(prevComp.competidores.map((c) => domainOf(c.url)));
          const nuevos = generada.competidores.filter((c) => !seen.has(domainOf(c.url)));
          competencia = { ...prevComp, competidores: [...prevComp.competidores, ...nuevos] };
        }
      }

      await prisma.competencia.upsert({
        where: { projectId: ctx.project.id },
        create: {
          projectId: ctx.project.id,
          content: JSON.stringify(competencia),
          status: "draft",
        },
        update: {
          content: JSON.stringify(competencia),
          status: "draft",
          version: { increment: 1 },
        },
      });
      ctx.artifacts.competencia = competencia;
      ctx.log(`Ficha comparativa generada (${competencia.competidores.length} competidores).`);
    },
  };

  return {
    requisito: "REQ-002",
    nodes: [input, discover, crawl, compare],
    edges: [
      ["input", "discover"],
      ["discover", "crawl"],
      ["crawl", "compare"],
    ],
  };
}
