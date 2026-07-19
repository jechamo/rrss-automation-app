import { prisma } from "@/lib/prisma";
import { crawlSite, type CrawlResult } from "@/core/crawler";
import { analyzeRepo, type RepoSummary } from "@/core/repo";
import { generateDossier } from "@/core/dossier/generate";
import {
  generateNavigationMap,
  navigationMapFromCrawl,
} from "@/core/navigation/generate";
import type { NavigationMap } from "@/core/navigation/types";
import type { PipelineDef, PipelineNode } from "./engine";

export const REQ001_NODES = [
  { id: "input", label: "Entrada" },
  { id: "crawl", label: "Crawl web" },
  { id: "repo", label: "Analisis codigo" },
  { id: "navigation", label: "Mapa funcional" },
  { id: "dossier", label: "Fusion IA -> Dossier" },
] as const;

export function buildReq001Pipeline(codeType?: string | null): PipelineDef {
  const hasCode = codeType != null && codeType !== "none";

  const input: PipelineNode = {
    id: "input",
    label: "Entrada",
    run: async (ctx) => {
      if (!ctx.project.url) throw new Error("Falta la URL de la appweb.");
      ctx.log(`Analizando ${ctx.project.url}`);
    },
  };

  const navigation: PipelineNode = {
    id: "navigation",
    label: "Mapa funcional",
    run: async (ctx) => {
      const crawl = ctx.artifacts.crawl as CrawlResult;
      const repo = (ctx.artifacts.repo as RepoSummary | null) ?? null;
      let navigationMap: NavigationMap;
      try {
        navigationMap = await generateNavigationMap({
          appUrl: ctx.project.url,
          crawl,
          repo,
          context: ctx.project.context,
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        ctx.log(`Mapa funcional degradado a web: ${detail}`);
        navigationMap = navigationMapFromCrawl(
          crawl,
          ctx.project.context ?? "",
          `No se pudo completar el análisis del código: ${detail}`,
        );
      }
      await prisma.navigationMap.upsert({
        where: { projectId: ctx.project.id },
        create: {
          projectId: ctx.project.id,
          content: JSON.stringify(navigationMap),
          status: "draft",
        },
        update: {
          content: JSON.stringify(navigationMap),
          status: "draft",
          verifiedAt: null,
          version: { increment: 1 },
        },
      });
      ctx.artifacts.navigationMap = navigationMap;
      ctx.log(`Mapa funcional generado (${navigationMap.roots.length} secciones principales).`);
    },
  };

  const crawl: PipelineNode = {
    id: "crawl",
    label: "Crawl web",
    run: async (ctx) => {
      const crawl = await crawlSite(ctx.project.url, 4, ctx.project.context ?? "");
      if (crawl.pages.length === 0) {
        throw new Error("No se pudo leer la web (sin paginas accesibles).");
      }
      ctx.artifacts.crawl = crawl;
      ctx.log(`Paginas leidas: ${crawl.pages.length}`);
    },
  };

  const repo: PipelineNode = {
    id: "repo",
    label: "Analisis codigo",
    run: async (ctx) => {
      const repo = await analyzeRepo(
        ctx.project.codeType,
        ctx.project.codePath,
        ctx.project.context ?? "",
      );
      ctx.artifacts.repo = repo;
      ctx.log(repo ? `Codigo analizado (${repo.source})` : "Sin codigo (solo web).");
    },
  };

  const dossier: PipelineNode = {
    id: "dossier",
    label: "Fusion IA -> Dossier",
    run: async (ctx) => {
      const crawl = ctx.artifacts.crawl as CrawlResult;
      const repo = (ctx.artifacts.repo as RepoSummary | null) ?? null;
      const navigationMap = ctx.artifacts.navigationMap as NavigationMap;
      const dossier = await generateDossier({
        url: ctx.project.url,
        crawl,
        repo,
        context: ctx.project.context,
        navigationMap,
      });
      await prisma.dossier.upsert({
        where: { projectId: ctx.project.id },
        create: {
          projectId: ctx.project.id,
          content: JSON.stringify(dossier),
          status: "draft",
        },
        update: {
          content: JSON.stringify(dossier),
          status: "draft",
          version: { increment: 1 },
        },
      });
      ctx.artifacts.dossier = dossier;
      ctx.log("Dossier generado.");
    },
  };

  const nodes: PipelineNode[] = hasCode
    ? [input, crawl, repo, navigation, dossier]
    : [input, crawl, navigation, dossier];

  const edges: [string, string][] = hasCode
    ? [
        ["input", "crawl"],
        ["crawl", "repo"],
        ["repo", "navigation"],
        ["navigation", "dossier"],
      ]
    : [
        ["input", "crawl"],
        ["crawl", "navigation"],
        ["navigation", "dossier"],
      ];

  return { requisito: "REQ-001", nodes, edges };
}
