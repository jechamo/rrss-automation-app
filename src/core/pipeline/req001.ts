import { prisma } from "@/lib/prisma";
import { crawlSite, type CrawlResult } from "@/core/crawler";
import { analyzeRepo, type RepoSummary } from "@/core/repo";
import { generateDossier } from "@/core/dossier/generate";
import type { PipelineDef, PipelineNode } from "./engine";

export const REQ001_NODES = [
  { id: "input", label: "Entrada" },
  { id: "crawl", label: "Crawl web" },
  { id: "repo", label: "Analisis codigo" },
  { id: "dossier", label: "Fusion IA -> Dossier" },
] as const;

export function buildReq001Pipeline(): PipelineDef {
  const nodes: PipelineNode[] = [
    {
      id: "input",
      label: "Entrada",
      run: async (ctx) => {
        if (!ctx.project.url) throw new Error("Falta la URL de la appweb.");
        ctx.log(`Analizando ${ctx.project.url}`);
      },
    },
    {
      id: "crawl",
      label: "Crawl web",
      run: async (ctx) => {
        const crawl = await crawlSite(ctx.project.url);
        if (crawl.pages.length === 0) {
          throw new Error("No se pudo leer la web (sin paginas accesibles).");
        }
        ctx.artifacts.crawl = crawl;
        ctx.log(`Paginas leidas: ${crawl.pages.length}`);
      },
    },
    {
      id: "repo",
      label: "Analisis codigo",
      run: async (ctx) => {
        const repo = await analyzeRepo(ctx.project.codeType, ctx.project.codePath);
        ctx.artifacts.repo = repo;
        ctx.log(repo ? `Codigo analizado (${repo.source})` : "Sin codigo (solo web).");
      },
    },
    {
      id: "dossier",
      label: "Fusion IA -> Dossier",
      run: async (ctx) => {
        const crawl = ctx.artifacts.crawl as CrawlResult;
        const repo = (ctx.artifacts.repo as RepoSummary | null) ?? null;
        const dossier = await generateDossier({ url: ctx.project.url, crawl, repo });
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
    },
  ];

  return {
    requisito: "REQ-001",
    nodes,
    edges: [
      ["input", "crawl"],
      ["crawl", "repo"],
      ["repo", "dossier"],
    ],
  };
}
