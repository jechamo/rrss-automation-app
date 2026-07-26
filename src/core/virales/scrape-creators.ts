import { getEngine } from "@/core/ai";
import { getSettings } from "@/core/settings";
import { getSecret } from "@/core/secrets/vault";
import type { Dossier } from "@/core/dossier/types";
import { fetchWithTimeout } from "@/core/media/http";
import {
  canonicalViralKey,
  mapWindowToProvider,
  mergeViralCandidates,
  normalizeInstagramResponse,
  normalizeTikTokResponse,
  normalizeYouTubeResponse,
  type NormalizedSearch,
} from "./scrape-creators-contracts";
import type {
  CriterioViral,
  Plataforma,
  ViralCandidato,
  ViralDiscovery,
} from "./types";

const API_BASE = "https://api.scrapecreators.com";
const REQUEST_TIMEOUT_MS = 45_000;
const QUERY_TIMEOUT_MS = 90_000;

type QueryPlan = Record<Plataforma, string>;

export interface ScrapeCreatorsDiscovery {
  candidatos: ViralCandidato[];
  discovery: ViralDiscovery;
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
