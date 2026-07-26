import type {
  CriterioViral,
  Plataforma,
  ViralCandidato,
  ViralMetrics,
} from "./types.js";

export interface NormalizedSearch {
  candidatos: ViralCandidato[];
  creditsCharged: number;
  creditsRemaining?: number;
}

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function number(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined;
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (Array.isArray(value)) {
      const found = value.map(text).find(Boolean);
      if (found) return found;
      continue;
    }
    const found = text(value);
    if (found) return found;
  }
  return "";
}

function isoFromUnix(value: unknown): string | undefined {
  const seconds = number(value);
  if (!seconds) return undefined;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function humanDate(value: string | undefined, fallback = ""): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? fallback || value
    : new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(date);
}

export function formatMetric(value: number | undefined): string {
  if (value == null) return "";
  return new Intl.NumberFormat("es-ES", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function engagementRate(metrics: ViralMetrics): number | undefined {
  if (!metrics.views) return undefined;
  const weighted =
    (metrics.likes ?? 0) +
    (metrics.comments ?? 0) * 2 +
    (metrics.shares ?? 0) * 3 +
    (metrics.saves ?? 0) * 2;
  return Math.round((weighted / metrics.views) * 10_000) / 100;
}

function score(metrics: ViralMetrics): number {
  const views = metrics.views ?? 0;
  const reach = Math.max(0, Math.min(72, (Math.log10(views + 1) - 2) * 18));
  const rate = engagementRate(metrics) ?? 0;
  const engagement = Math.max(0, Math.min(23, rate * 2.3));
  let recency = 0;
  if (metrics.publishedAt) {
    const ageDays = (Date.now() - new Date(metrics.publishedAt).valueOf()) / 86_400_000;
    if (Number.isFinite(ageDays)) recency = ageDays <= 7 ? 5 : ageDays <= 30 ? 3 : ageDays <= 90 ? 1 : 0;
  }
  return Math.round(Math.max(0, Math.min(100, reach + engagement + recency)));
}

function motivo(metrics: ViralMetrics): string {
  const parts = [
    metrics.views != null ? `${formatMetric(metrics.views)} visualizaciones` : "",
    metrics.likes != null ? `${formatMetric(metrics.likes)} me gusta` : "",
    metrics.shares != null ? `${formatMetric(metrics.shares)} compartidos` : "",
    engagementRate(metrics) != null ? `${engagementRate(metrics)}% engagement ponderado` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "Resultado público estructurado de Scrape Creators";
}

function withDerived(metrics: ViralMetrics): ViralMetrics {
  return {
    ...metrics,
    engagementRate: engagementRate(metrics),
    ratioConfidence: "unverified",
    fetchedAt: new Date().toISOString(),
  };
}

function creditInfo(raw: Obj): Pick<NormalizedSearch, "creditsCharged" | "creditsRemaining"> {
  return {
    creditsCharged: number(raw.credits_charged) ?? 0,
    creditsRemaining: number(raw.credits_remaining),
  };
}

export function normalizeYouTubeResponse(rawInput: unknown): NormalizedSearch {
  const raw = obj(rawInput);
  const items = [...arr(raw.videos), ...arr(raw.shorts)];
  const candidatos = items.flatMap((input): ViralCandidato[] => {
    const item = obj(input);
    const channel = obj(item.channel);
    const id = firstText(item.id, item.videoId);
    const url = firstText(
      item.url,
      id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : "",
    );
    if (!url) return [];
    const publishedAt = firstText(item.publishedTime, item.publishedAt) || undefined;
    const views = number(item.viewCountInt ?? item.viewCount);
    const metrics = withDerived({
      platformId: id || undefined,
      views,
      durationSeconds: number(item.lengthSeconds),
      publishedAt,
      thumbnailUrl: firstText(item.thumbnail) || undefined,
      authorId: firstText(channel.id) || undefined,
      authorHandle: firstText(channel.handle) || undefined,
    });
    const duration = metrics.durationSeconds ?? 0;
    return [{
      url,
      plataforma: "youtube",
      titulo: firstText(item.title),
      autor: firstText(channel.title, channel.handle),
      vistas: firstText(item.viewCountText) || formatMetric(views),
      fecha: firstText(item.publishedTimeText) || humanDate(publishedAt),
      ratioAutor: 0,
      viralScore: score(metrics),
      formato: duration > 0 && duration <= 90 ? "short" : "video",
      motivo: motivo(metrics),
      sourceProvider: "scrapecreators",
      metrics,
    }];
  });
  return { candidatos, ...creditInfo(raw) };
}

export function normalizeTikTokResponse(rawInput: unknown): NormalizedSearch {
  const raw = obj(rawInput);
  const items = arr(raw.search_item_list ?? raw.videos);
  const candidatos = items.flatMap((input): ViralCandidato[] => {
    const wrapper = obj(input);
    const item = obj(wrapper.aweme_info ?? wrapper);
    const author = obj(item.author);
    const stats = obj(item.statistics ?? item.stats);
    const video = obj(item.video);
    const cover = obj(video.cover ?? video.origin_cover ?? video.dynamic_cover);
    const id = firstText(item.aweme_id, item.id);
    const handle = firstText(author.unique_id, author.uniqueId, author.username);
    const url = firstText(
      item.share_url,
      obj(item.share_info).share_url,
      handle && id ? `https://www.tiktok.com/@${handle}/video/${id}` : "",
    ).split("?")[0];
    if (!url) return [];
    const publishedAt = isoFromUnix(item.create_time);
    const durationRaw = number(video.duration ?? item.duration);
    const durationSeconds = durationRaw && durationRaw > 1000 ? durationRaw / 1000 : durationRaw;
    const views = number(stats.play_count ?? stats.playCount);
    const metrics = withDerived({
      platformId: id || undefined,
      views,
      likes: number(stats.digg_count ?? stats.like_count),
      comments: number(stats.comment_count),
      shares: number(stats.share_count),
      saves: number(stats.collect_count),
      durationSeconds,
      publishedAt,
      thumbnailUrl: firstText(cover.url_list, cover.urlList) || undefined,
      authorId: firstText(author.uid, author.id) || undefined,
      authorHandle: handle || undefined,
    });
    return [{
      url,
      plataforma: "tiktok",
      titulo: firstText(item.desc, item.search_desc, obj(item.share_info).share_desc),
      autor: firstText(author.nickname, handle),
      vistas: formatMetric(views),
      fecha: humanDate(publishedAt),
      ratioAutor: 0,
      viralScore: score(metrics),
      formato: "video corto",
      motivo: motivo(metrics),
      sourceProvider: "scrapecreators",
      metrics,
    }];
  });
  return { candidatos, ...creditInfo(raw) };
}

export function normalizeInstagramResponse(rawInput: unknown): NormalizedSearch {
  const raw = obj(rawInput);
  const candidatos = arr(raw.reels).flatMap((input): ViralCandidato[] => {
    const item = obj(input);
    const owner = obj(item.owner);
    const id = firstText(item.id, item.shortcode);
    const shortcode = firstText(item.shortcode);
    const url = firstText(
      item.url,
      shortcode ? `https://www.instagram.com/reel/${shortcode}/` : "",
    );
    if (!url) return [];
    const publishedAt = firstText(item.taken_at, item.takenAt) || undefined;
    const views = number(item.video_play_count ?? item.video_view_count ?? item.play_count);
    const metrics = withDerived({
      platformId: id || undefined,
      views,
      likes: number(item.like_count),
      comments: number(item.comment_count),
      shares: number(item.reshare_count ?? item.share_count),
      saves: number(item.save_count),
      followers: number(owner.follower_count),
      durationSeconds: number(item.video_duration),
      publishedAt,
      thumbnailUrl: firstText(item.thumbnail_src, item.display_url) || undefined,
      authorId: firstText(owner.id) || undefined,
      authorHandle: firstText(owner.username) || undefined,
    });
    return [{
      url,
      plataforma: "instagram",
      titulo: firstText(item.caption).slice(0, 180),
      autor: firstText(owner.full_name, owner.username),
      vistas: formatMetric(views),
      fecha: humanDate(publishedAt),
      ratioAutor: 0,
      viralScore: score(metrics),
      formato: "reel",
      motivo: motivo(metrics),
      sourceProvider: "scrapecreators",
      metrics,
    }];
  });
  return { candidatos, ...creditInfo(raw) };
}

export function canonicalViralKey(candidate: Pick<ViralCandidato, "url" | "plataforma" | "metrics">): string {
  const platformId = candidate.metrics?.platformId?.trim();
  if (platformId) return `${candidate.plataforma}:${platformId}`;
  try {
    const url = new URL(candidate.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (candidate.plataforma === "youtube") {
      const youtubeId =
        url.searchParams.get("v") ||
        (url.hostname.includes("youtu.be") ? pathParts[0] : undefined) ||
        (pathParts[0] === "shorts" ? pathParts[1] : undefined);
      if (youtubeId) return `youtube:${youtubeId}`;
    }
    if (candidate.plataforma === "tiktok") {
      const videoIndex = pathParts.indexOf("video");
      if (videoIndex >= 0 && pathParts[videoIndex + 1]) return `tiktok:${pathParts[videoIndex + 1]}`;
    }
    if (candidate.plataforma === "instagram") {
      const reelIndex = pathParts.findIndex((part) => part === "reel" || part === "reels");
      if (reelIndex >= 0 && pathParts[reelIndex + 1]) return `instagram:${pathParts[reelIndex + 1]}`;
    }
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || ["si", "igsh", "share", "feature"].includes(key)) {
        url.searchParams.delete(key);
      }
    }
    url.hash = "";
    return url.toString().replace(/\/+$/, "").toLowerCase();
  } catch {
    return candidate.url.trim().replace(/\/+$/, "").toLowerCase();
  }
}

export function mergeViralCandidates(...groups: ViralCandidato[][]): ViralCandidato[] {
  const seen = new Set<string>();
  const merged: ViralCandidato[] = [];
  for (const candidate of groups.flat()) {
    const key = canonicalViralKey(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(candidate);
  }
  return merged;
}

export function mapWindowToProvider(
  plataforma: Plataforma,
  criterio: CriterioViral,
): Record<string, string> {
  const days = criterio.ventanaDias;
  if (days === 0) return {};
  if (plataforma === "youtube") {
    return { uploadDate: days <= 7 ? "this_week" : days <= 30 ? "this_month" : "this_year" };
  }
  if (plataforma === "tiktok") {
    return {
      date_posted:
        days <= 1 ? "yesterday"
          : days <= 7 ? "this-week"
            : days <= 30 ? "this-month"
              : days <= 90 ? "last-3-months"
                : days <= 180 ? "last-6-months"
                  : "all-time",
    };
  }
  return {
    date_posted:
      days <= 1 ? "last-day"
        : days <= 7 ? "last-week"
          : days <= 30 ? "last-month"
            : "last-year",
  };
}
