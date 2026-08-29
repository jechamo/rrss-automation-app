import { getEngine } from "@/core/ai";
import { getSettings } from "@/core/settings";
import { getSecret } from "@/core/secrets/vault";
import type { Dossier } from "@/core/dossier/types";
import { fetchWithTimeout } from "@/core/media/http";
import {
  applyAuthorBaseline,
  canonicalViralKey,
  mapWindowToProvider,
  mergeViralCandidates,
  normalizeAuthorHistory,
  normalizeInstagramResponse,
  normalizeTikTokResponse,
  normalizeYouTubeResponse,
  type NormalizedSearch,
} from "./scrape-creators-contracts";
import {
  getCachedAuthorHistory,
  setCachedAuthorHistory,
} from "./scrape-creators-cache";
import type {
  CriterioViral,
  Plataforma,
  ViralCandidato,
  ViralDiscovery,
} from "./types";
import { isMockE2E } from "@/core/runtime/e2e-profile";
import { simulateMockProvider } from "@/core/testing/mock-runtime";

const API_BASE = "https://api.scrapecreators.com";
const REQUEST_TIMEOUT_MS = 45_000;
const QUERY_TIMEOUT_MS = 90_000;

type QueryPlan = Record<Plataforma, string>;

export interface ScrapeCreatorsDiscovery {
  candidatos: ViralCandidato[];
  discovery: ViralDiscovery;
}

export interface ScrapeCreatorsEnrichmentReport {
  creditsCharged: number;
  requests: number;
  cacheHits: number;
  authorsVerified: number;
  authorsEstimated: number;
  authorsUnverified: number;
  authorsSkippedBudget: number;
  creditsRemaining?: number;
  warnings: string[];
}

export interface ScrapeCreatorsEnrichment {
  candidatos: ViralCandidato[];
  report: ScrapeCreatorsEnrichmentReport;
}

interface SearchJob {
  plataforma: Plataforma;
  path: string;
  params: Record<string, string>;
  normalize: (input: unknown) => NormalizedSearch;
}

const QUERY_SYSTEM = `Eres estratega de investigacion de contenido viral. Genera una consulta
breve y natural por plataforma para encontrar videos publicos del nicho. No inventes marcas ni
creadores. Devuelve solo JSON valido.`;

export async function discoverWithScrapeCreators(args: {
  dossier: Dossier;
  criterio: CriterioViral;
  cantidad: number;
  excluir?: string[];
}): Promise<ScrapeCreatorsDiscovery> {
  if (isMockE2E()) {
    await simulateMockProvider("scrapecreators");
    const localUrl = process.env.RRSS_E2E_FIXTURE_URL ?? "http://localhost/fixture";
    return {
      candidatos: [{
        url: `${localUrl}/scrape-viral`,
        plataforma: "youtube",
        titulo: "Viral Scrape Creators Fixture",
        autor: "Autor Fixture",
        vistas: "25000",
        fecha: "2026-08-01",
        ratioAutor: 2.5,
        viralScore: 82,
        formato: "tutorial corto",
        motivo: "Respuesta estructurada local",
        sourceProvider: "scrapecreators",
      }],
      discovery: {
        source: "scrapecreators",
        queries: { youtube: "fixture", tiktok: "fixture", instagram: "fixture" },
        platformCounts: { youtube: 1 },
        creditsCharged: 0,
        creditsRemaining: 999,
        warnings: [],
        searchedAt: "2026-08-27T00:00:00.000Z",
      },
    };
  }
  const key = getSecret("scrapecreators");
  if (!key) {
    throw new Error("Scrape Creators no esta configurado. Guarda su API key en Ajustes.");
  }

  const { queries, warning: queryWarning } = await planQueries(args.dossier);
  const jobs: SearchJob[] = [
    {
      plataforma: "youtube",
      path: "/v1/youtube/search",
      params: {
        query: queries.youtube,
        sortBy: "popular",
        type: "shorts",
        ...mapWindowToProvider("youtube", args.criterio),
      },
      normalize: normalizeYouTubeResponse,
    },
    {
      plataforma: "tiktok",
      path: "/v1/tiktok/search/keyword",
      params: {
        query: queries.tiktok,
        sort_by: "most-liked",
        ...mapWindowToProvider("tiktok", args.criterio),
      },
      normalize: normalizeTikTokResponse,
    },
    {
      plataforma: "instagram",
      path: "/v2/instagram/reels/search",
      params: {
        query: queries.instagram,
        ...mapWindowToProvider("instagram", args.criterio),
      },
      normalize: normalizeInstagramResponse,
    },
  ];

  const settled = await Promise.allSettled(
    jobs.map(async (job) => ({
      plataforma: job.plataforma,
      result: job.normalize(await request(job.path, job.params, key)),
    })),
  );

  const warnings = queryWarning ? [queryWarning] : [];
  const successes: Array<{ plataforma: Plataforma; result: NormalizedSearch }> = [];
  const failures: Error[] = [];
  settled.forEach((entry, index) => {
    if (entry.status === "fulfilled") {
      successes.push(entry.value);
    } else {
      const error = entry.reason instanceof Error ? entry.reason : new Error(String(entry.reason));
      failures.push(error);
      warnings.push(`${platformLabel(jobs[index].plataforma)}: ${error.message}`);
    }
  });

  if (successes.length === 0) {
    throw failures[0] ?? new Error("Scrape Creators no devolvio resultados.");
  }

  const excluded = new Set((args.excluir ?? []).map(canonicalUrl).filter(Boolean));
  const merged = mergeViralCandidates(...successes.map((entry) => entry.result.candidatos))
    .filter((candidate) => !excluded.has(canonicalUrl(candidate.url)))
    .sort((a, b) => b.viralScore - a.viralScore);
  const maxCandidates = Math.max(30, Math.min(100, args.cantidad * 2));
  const candidatos = merged.slice(0, maxCandidates);
  if (candidatos.length === 0) {
    throw new Error(
      "Scrape Creators respondio correctamente, pero no encontro videos nuevos con estas consultas.",
    );
  }

  const creditsRemaining = successes
    .map((entry) => entry.result.creditsRemaining)
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b)[0];
  const platformCounts = Object.fromEntries(
    successes.map((entry) => [entry.plataforma, entry.result.candidatos.length]),
  ) as Partial<Record<Plataforma, number>>;

  return {
    candidatos,
    discovery: {
      source: "scrapecreators",
      queries,
      platformCounts,
      creditsCharged: successes.reduce((sum, entry) => sum + entry.result.creditsCharged, 0),
      creditsRemaining,
      warnings,
      searchedAt: new Date().toISOString(),
    },
  };
}

export async function enrichWithAuthorBaselines(args: {
  candidatos: ViralCandidato[];
  maxRequests: number;
}): Promise<ScrapeCreatorsEnrichment> {
  if (isMockE2E()) {
    await simulateMockProvider("scrapecreators");
    return {
      candidatos: args.candidatos,
      report: {
        creditsCharged: 0,
        requests: Math.min(args.maxRequests, args.candidatos.length),
        cacheHits: 0,
        authorsVerified: args.candidatos.length,
        authorsEstimated: 0,
        authorsUnverified: 0,
        authorsSkippedBudget: 0,
        creditsRemaining: 999,
        warnings: [],
      },
    };
  }
  const key = getSecret("scrapecreators");
  if (!key) {
    throw new Error("Scrape Creators no esta configurado. Guarda su API key en Ajustes.");
  }

  const candidatos = args.candidatos.map((candidate) => ({ ...candidate }));
  const authorGroups = new Map<string, { candidate: ViralCandidato; indexes: number[] }>();
  candidatos.forEach((candidate, index) => {
    const groupKey = authorCacheKey(candidate);
    if (!groupKey || candidate.sourceProvider !== "scrapecreators") return;
    const current = authorGroups.get(groupKey);
    if (current) current.indexes.push(index);
    else authorGroups.set(groupKey, { candidate, indexes: [index] });
  });

  const report: ScrapeCreatorsEnrichmentReport = {
    creditsCharged: 0,
    requests: 0,
    cacheHits: 0,
    authorsVerified: 0,
    authorsEstimated: 0,
    authorsUnverified: 0,
    authorsSkippedBudget: 0,
    warnings: [],
  };
  const maxRequests = Math.max(0, Math.floor(args.maxRequests));

  for (const [cacheKey, group] of authorGroups) {
    let history: Awaited<ReturnType<typeof getCachedAuthorHistory>> = null;
    try {
      history = await getCachedAuthorHistory(cacheKey);
    } catch {
      // Una caché dañada o inaccesible no debe impedir el enriquecimiento en vivo.
    }

    let cacheHit = Boolean(history);
    if (history) {
      report.cacheHits += 1;
    } else {
      if (report.requests >= maxRequests) {
        report.authorsSkippedBudget += 1;
        continue;
      }
      report.requests += 1;
      try {
        const raw = await requestAuthorHistory(group.candidate, key);
        const normalized = normalizeAuthorHistory(group.candidate.plataforma, raw);
        report.creditsCharged += normalized.creditsCharged;
        if (
          normalized.creditsRemaining != null &&
          (report.creditsRemaining == null || normalized.creditsRemaining < report.creditsRemaining)
        ) {
          report.creditsRemaining = normalized.creditsRemaining;
        }
        history = { videos: normalized.videos, fetchedAt: new Date().toISOString() };
        try {
          await setCachedAuthorHistory(cacheKey, history);
        } catch {
          report.warnings.push(
            `${platformLabel(group.candidate.plataforma)} · ${group.candidate.autor || "autor"}: no se pudo guardar la caché local.`,
          );
        }
      } catch (error) {
        report.authorsUnverified += 1;
        report.warnings.push(
          `${platformLabel(group.candidate.plataforma)} · ${group.candidate.autor || "autor"}: ${errorMessage(error)}`,
        );
        continue;
      }
      cacheHit = false;
    }

    const fetchedAt = history.fetchedAt;
    group.indexes.forEach((index) => {
      candidatos[index] = applyAuthorBaseline(
        candidatos[index],
        { videos: history!.videos },
        { fetchedAt, cacheHit },
      );
    });
    const confidence = candidatos[group.indexes[0]].metrics?.ratioConfidence;
    if (confidence === "verified") report.authorsVerified += 1;
    else if (confidence === "estimated") report.authorsEstimated += 1;
    else report.authorsUnverified += 1;
  }

  return { candidatos, report };
}

async function requestAuthorHistory(candidate: ViralCandidato, key: string): Promise<unknown> {
  const authorId = candidate.metrics?.authorId?.trim();
  const handle = candidate.metrics?.authorHandle?.trim().replace(/^@/, "");
  if (candidate.plataforma === "youtube") {
    return request(
      "/v1/youtube/channel/shorts",
      authorId ? { channelId: authorId, sort: "newest" } : { handle: handle ?? "", sort: "newest" },
      key,
    );
  }
  if (candidate.plataforma === "tiktok") {
    return request(
      "/v3/tiktok/profile/videos",
      {
        handle: handle ?? "",
        ...(authorId ? { user_id: authorId } : {}),
        sort_by: "latest",
        trim: "true",
      },
      key,
    );
  }
  return request(
    "/v1/instagram/user/reels",
    authorId ? { user_id: authorId, trim: "true" } : { handle: handle ?? "", trim: "true" },
    key,
  );
}

function authorCacheKey(candidate: ViralCandidato): string {
  const handle = candidate.metrics?.authorHandle?.trim().replace(/^@/, "");
  // El endpoint de vídeos de TikTok exige handle incluso cuando también se aporta user_id.
  if (candidate.plataforma === "tiktok" && !handle) return "";
  const author = candidate.metrics?.authorId || handle;
  return author ? `${candidate.plataforma}:${author.trim().replace(/^@/, "").toLowerCase()}` : "";
}

async function planQueries(dossier: Dossier): Promise<{ queries: QueryPlan; warning?: string }> {
  const fallback = fallbackQueries(dossier);
  const prompt = `Genera una consulta de busqueda por plataforma para localizar videos virales
publicos, recientes y relevantes. Cada consulta debe tener entre 2 y 8 palabras y centrarse en
el problema o interes del publico, no en el nombre de nuestra marca.

Nicho: ${dossier.nicho}
Negocio: ${dossier.negocio}
Publico: ${dossier.publicoObjetivo}
Funciones relevantes: ${dossier.funcionalidades.slice(0, 6).join(", ")}

Devuelve exactamente:
{"youtube":"","tiktok":"","instagram":""}`;

  try {
    const settings = getSettings();
    const result = await getEngine(settings.aiEngine).run({
      system: QUERY_SYSTEM,
      prompt,
      json: true,
      model: settings.aiModel,
      timeoutMs: QUERY_TIMEOUT_MS,
    });
    const data = (result.data ?? tryParse(result.text)) as Partial<QueryPlan> | null;
    return {
      queries: {
        youtube: cleanQuery(data?.youtube) || fallback.youtube,
        tiktok: cleanQuery(data?.tiktok) || fallback.tiktok,
        instagram: cleanQuery(data?.instagram) || fallback.instagram,
      },
    };
  } catch {
    return {
      queries: fallback,
      warning: "La IA no pudo preparar consultas; se uso el nicho del dossier como alternativa.",
    };
  }
}

function fallbackQueries(dossier: Dossier): QueryPlan {
  const niche = cleanQuery(dossier.nicho || dossier.negocio || dossier.publicoObjetivo) || "tendencias";
  return {
    youtube: `${niche} consejos`,
    tiktok: niche,
    instagram: niche,
  };
}

function cleanQuery(value: unknown): string {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 120);
}

async function request(
  path: string,
  params: Record<string, string>,
  key: string,
): Promise<unknown> {
  const url = new URL(path, API_BASE);
  Object.entries(params).forEach(([name, value]) => {
    if (value) url.searchParams.set(name, value);
  });

  const response = await fetchWithTimeout(
    url.toString(),
    { headers: { "x-api-key": key, Accept: "application/json" } },
    REQUEST_TIMEOUT_MS,
  );
  if (!response.ok) throw new Error(providerError(response.status));
  const data = (await response.json()) as { success?: boolean; message?: unknown; error?: unknown };
  if (data.success === false) {
    throw new Error(
      `Scrape Creators rechazo la consulta: ${String(data.message ?? data.error ?? "sin detalle").slice(0, 180)}`,
    );
  }
  return data;
}

function providerError(status: number): string {
  if (status === 401) return "API key invalida. Revisala en Ajustes.";
  if (status === 402) return "creditos insuficientes. Revisa el saldo del proveedor.";
  if (status === 403) return "la plataforma bloqueo temporalmente esta fuente publica.";
  if (status === 404) return "el recurso publico ya no esta disponible.";
  if (status === 429) return "limite temporal de solicitudes alcanzado.";
  if (status >= 500) return `servicio no disponible temporalmente (HTTP ${status}).`;
  return `respuesta HTTP ${status}.`;
}

function platformLabel(platform: Plataforma): string {
  return platform === "youtube" ? "YouTube" : platform === "tiktok" ? "TikTok" : "Instagram";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "error desconocido");
}

function canonicalUrl(value: string): string {
  try {
    return canonicalViralKey({
      url: value,
      plataforma: value.includes("tiktok")
        ? "tiktok"
        : value.includes("instagram")
          ? "instagram"
          : "youtube",
    });
  } catch {
    return value.trim().toLowerCase().replace(/\/+$/, "");
  }
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
