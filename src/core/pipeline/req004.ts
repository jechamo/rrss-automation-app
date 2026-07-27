import { prisma } from "@/lib/prisma";
import { coerceDossier, type Dossier } from "@/core/dossier/types";
import {
  coerceVirales,
  DEFAULT_CRITERIO,
  type CriterioViral,
  type PatronViral,
  type Viral,
  type ViralCandidato,
  type ViralDiscovery,
  type ViralDiscoverySource,
  type ViralEnrichmentLevel,
  type Virales,
} from "@/core/virales/types";
import { discoverVirales } from "@/core/virales/discover";
import {
  discoverWithScrapeCreators,
  enrichWithAuthorBaselines,
} from "@/core/virales/scrape-creators";
import { mergeViralCandidates } from "@/core/virales/scrape-creators-contracts";
import { analyzeVirales, type AnalyzeInput } from "@/core/virales/analyze";
import type { PipelineDef, PipelineNode } from "./engine";

export const REQ004_NODES = [
  { id: "input", label: "Entrada" },
  { id: "discover", label: "Buscar virales (web)" },
  { id: "rank", label: "Ranking" },
  { id: "enrich", label: "Verificar ratio por autor" },
  { id: "analyze", label: "Análisis de patrones" },
] as const;

const DEFAULT_TOP = 20;
const DEFAULT_MAX_CREDITS = 20;

export type ReqMode = "reemplazar" | "ampliar";
export interface Req004Opts {
  ventanaDias?: number;
  modo?: ReqMode;
  cantidad?: number;
  fuente?: ViralDiscoverySource;
  nivel?: ViralEnrichmentLevel;
  maxCreditos?: number;
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
    sourceProvider: v.sourceProvider,
    metrics: v.metrics,
  };
}

/** REQ-004: Top de virales del nicho (YT/TikTok/IG via IA+web) + patrones. */
export function buildReq004Pipeline(opts: Req004Opts = {}): PipelineDef {
  const ventanaDias = opts.ventanaDias ?? DEFAULT_CRITERIO.ventanaDias;
  const modo: ReqMode = opts.modo === "ampliar" ? "ampliar" : "reemplazar";
  const cantidad = opts.cantidad && opts.cantidad > 0 ? Math.min(50, opts.cantidad) : DEFAULT_TOP;
  const fuente: ViralDiscoverySource =
    opts.fuente === "scrapecreators" || opts.fuente === "hybrid" ? opts.fuente : "web";
  const nivel: ViralEnrichmentLevel =
    fuente !== "web" && opts.nivel === "preciso" ? "preciso" : "rapido";
  const maxCreditos = Math.max(
    3,
    Math.min(100, Math.floor(opts.maxCreditos ?? DEFAULT_MAX_CREDITS)),
  );
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
          ? `Modo ampliar: se conservan ${conservar.length} virales y se buscan ${cantidad} nuevos con ${sourceLabel(fuente)}.`
          : `Dossier cargado. Fuente: ${sourceLabel(fuente)}. Virales manuales conservados: ${conservar.length}.`,
      );
      if (fuente !== "web") {
        ctx.log(
          nivel === "preciso"
            ? `Precisión: histórico por autor · presupuesto máximo ${maxCreditos} créditos.`
            : "Precisión rápida: solo las 3 consultas base, sin histórico adicional por autor.",
        );
      }
    },
  };

  const discover: PipelineNode = {
    id: "discover",
    label: `Buscar virales (${sourceShortLabel(fuente)})`,
    run: async (ctx) => {
      const dossier = ctx.artifacts.dossier as Dossier;
      const conservar = (ctx.artifacts.conservar as Viral[]) ?? [];
      // En ampliar, las semillas (manual) se pasan; el resto se excluye para no repetir.
      const seed = conservar.filter((v) => v.origen === "manual").map(toCandidato);
      const excluir = conservar.map((v) => v.url).filter(Boolean);
      let candidatos: ViralCandidato[];
      let discovery: ViralDiscovery;

      if (fuente === "web") {
        candidatos = await discoverVirales(dossier, criterio, seed, excluir);
        discovery = {
          source: "web",
          platformCounts: countByPlatform(candidatos),
          searchedAt: new Date().toISOString(),
        };
      } else if (fuente === "scrapecreators") {
        const result = await discoverWithScrapeCreators({
          dossier,
          criterio,
          cantidad,
          excluir,
        });
        candidatos = mergeViralCandidates(seed, result.candidatos);
        discovery = result.discovery;
      } else {
        const [webResult, scrapeResult] = await Promise.allSettled([
          discoverVirales(dossier, criterio, seed, excluir),
          discoverWithScrapeCreators({ dossier, criterio, cantidad, excluir }),
        ]);
        if (webResult.status === "rejected" && scrapeResult.status === "rejected") {
          throw new Error(
            `Fallaron las dos fuentes del modo hibrido. Web: ${errorMessage(webResult.reason)} · ` +
              `Scrape Creators: ${errorMessage(scrapeResult.reason)}`,
          );
        }
        const web = webResult.status === "fulfilled" ? webResult.value : [];
        const scrape = scrapeResult.status === "fulfilled" ? scrapeResult.value : null;
        const scrapeFailure =
          scrapeResult.status === "rejected" ? errorMessage(scrapeResult.reason) : "";
        candidatos = mergeViralCandidates(seed, scrape?.candidatos ?? [], web);
        discovery = scrape
          ? { ...scrape.discovery, source: "hybrid" }
          : {
              source: "hybrid",
              platformCounts: countByPlatform(web),
              searchedAt: new Date().toISOString(),
              warnings: [`Scrape Creators no estuvo disponible: ${scrapeFailure}`],
            };
        if (webResult.status === "rejected") {
          discovery.warnings = [
            ...(discovery.warnings ?? []),
            `IA + web no estuvo disponible: ${errorMessage(webResult.reason)}`,
          ];
        }
      }

      ctx.artifacts.candidatos = candidatos;
      discovery.enrichmentLevel = nivel;
      discovery.maxCredits = fuente === "web" ? 0 : maxCreditos;
      ctx.artifacts.discovery = discovery;
      if (discovery.queries) {
        ctx.log(
          `Consultas API: YouTube «${discovery.queries.youtube ?? ""}» · TikTok «${discovery.queries.tiktok ?? ""}» · Instagram «${discovery.queries.instagram ?? ""}».`,
        );
      }
      if (discovery.creditsCharged != null) {
        ctx.log(
          `Scrape Creators: ${discovery.creditsCharged} credito(s) consumido(s)` +
            `${discovery.creditsRemaining != null ? ` · saldo ${discovery.creditsRemaining}` : ""}.`,
        );
      }
      discovery.warnings?.forEach((warning) => ctx.log(`Aviso de recopilacion: ${warning}`));
      ctx.log(
        `Candidatos virales localizados: ${candidatos.length} (${formatPlatformCounts(countByPlatform(candidatos))}).`,
      );
    },
  };

  const rank: PipelineNode = {
    id: "rank",
    label: modo === "ampliar" ? `Ranking +${cantidad} nuevos` : `Ranking Top ${cantidad}`,
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

  const enrich: PipelineNode = {
    id: "enrich",
    label: nivel === "preciso" ? "Verificar ratio por autor" : "Métricas rápidas",
    run: async (ctx) => {
      const top = (ctx.artifacts.top as AnalyzeInput[]) ?? [];
      const discovery = ctx.artifacts.discovery as ViralDiscovery;
      if (fuente === "web") {
        ctx.log("Fuente web: se conservan los ratios aproximados declarados por la investigación.");
        return;
      }
      if (nivel !== "preciso") {
        ctx.log("Modo rápido: no se consultan históricos de autores.");
        return;
      }

      const baseCredits = discovery.creditsCharged ?? 0;
      // Las tres búsquedas de plataforma cuestan un crédito cada una. Reservarlas aunque una
      // respuesta omita credits_charged garantiza que el tope elegido nunca se sobrepase.
      const reservedBaseCredits = Math.max(3, baseCredits);
      const availableRequests = Math.max(0, maxCreditos - reservedBaseCredits);
      const enrichableTop = top.slice(0, 20);
      const result = await enrichWithAuthorBaselines({
        candidatos: enrichableTop,
        maxRequests: availableRequests,
      });
      const untouched = top.slice(enrichableTop.length);
      const enriched = [...result.candidatos, ...untouched] as AnalyzeInput[];
      enriched.sort((a, b) => {
        if (a.origen !== b.origen) return a.origen === "manual" ? -1 : 1;
        return b.viralScore - a.viralScore;
      });
      ctx.artifacts.top = enriched;

      discovery.enrichmentCreditsCharged = result.report.creditsCharged;
      discovery.enrichmentRequests = result.report.requests;
      discovery.cacheHits = result.report.cacheHits;
      discovery.authorsVerified = result.report.authorsVerified;
      discovery.authorsEstimated = result.report.authorsEstimated;
      discovery.authorsUnverified = result.report.authorsUnverified;
      discovery.authorsSkippedBudget = result.report.authorsSkippedBudget;
      discovery.creditsCharged = baseCredits + result.report.creditsCharged;
      if (result.report.creditsRemaining != null) {
        discovery.creditsRemaining = result.report.creditsRemaining;
      }
      discovery.warnings = [...(discovery.warnings ?? []), ...result.report.warnings];

      ctx.log(
        `Históricos: ${result.report.authorsVerified} autor(es) verificados · ` +
          `${result.report.authorsEstimated} estimados · ${result.report.authorsUnverified} sin muestra suficiente.`,
      );
      ctx.log(
        `Enriquecimiento: ${result.report.requests} consulta(s), ${result.report.cacheHits} desde caché · ` +
          `${result.report.creditsCharged} crédito(s) adicional(es).`,
      );
      if (result.report.authorsSkippedBudget > 0) {
        ctx.log(
          `Límite respetado: ${result.report.authorsSkippedBudget} autor(es) quedaron pendientes por presupuesto.`,
        );
      }
      result.report.warnings.forEach((warning) => ctx.log(`Aviso de histórico: ${warning}`));
    },
  };

  const analyze: PipelineNode = {
    id: "analyze",
    label: "Análisis de patrones",
    run: async (ctx) => {
      const dossier = ctx.artifacts.dossier as Dossier;
      const top = (ctx.artifacts.top as AnalyzeInput[]) ?? [];
      const analizado = await analyzeVirales({ dossier, criterio, candidatos: top });
      analizado.discovery = ctx.artifacts.discovery as ViralDiscovery | undefined;

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
            discovery: analizado.discovery,
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
    nodes: [input, discover, rank, enrich, analyze],
    edges: [
      ["input", "discover"],
      ["discover", "rank"],
      ["rank", "enrich"],
      ["enrich", "analyze"],
    ],
  };
}

function sourceLabel(source: ViralDiscoverySource): string {
  if (source === "scrapecreators") return "Scrape Creators";
  if (source === "hybrid") return "Hibrido (IA + Scrape Creators)";
  return "IA + web";
}

function sourceShortLabel(source: ViralDiscoverySource): string {
  return source === "scrapecreators" ? "Scrape Creators" : source === "hybrid" ? "hibrido" : "web";
}

function countByPlatform(candidatos: ViralCandidato[]): Partial<Record<"youtube" | "tiktok" | "instagram", number>> {
  return candidatos.reduce<Partial<Record<"youtube" | "tiktok" | "instagram", number>>>(
    (counts, candidato) => {
      counts[candidato.plataforma] = (counts[candidato.plataforma] ?? 0) + 1;
      return counts;
    },
    {},
  );
}

function formatPlatformCounts(counts: Partial<Record<"youtube" | "tiktok" | "instagram", number>>): string {
  return `YouTube ${counts.youtube ?? 0} · TikTok ${counts.tiktok ?? 0} · Instagram ${counts.instagram ?? 0}`;
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason ?? "error desconocido");
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
