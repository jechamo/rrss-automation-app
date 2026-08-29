import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuthorVideoMetric } from "./scrape-creators-contracts";
import { getDataDir } from "../runtime/e2e-profile";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_DIR = path.join(getDataDir(), "cache");
const CACHE_PATH = path.join(CACHE_DIR, "scrape-creators-authors.json");

interface CacheEntry {
  fetchedAt: string;
  videos: AuthorVideoMetric[];
}

interface CacheFile {
  version: 1;
  authors: Record<string, CacheEntry>;
}

export async function getCachedAuthorHistory(
  key: string,
  now = Date.now(),
): Promise<CacheEntry | null> {
  const cache = await readCache();
  const entry = cache.authors[key];
  if (!entry) return null;
  const age = now - new Date(entry.fetchedAt).valueOf();
  if (!Number.isFinite(age) || age < 0 || age > CACHE_TTL_MS) return null;
  return entry;
}

export async function setCachedAuthorHistory(key: string, entry: CacheEntry): Promise<void> {
  const cache = await readCache();
  cache.authors[key] = entry;
  await mkdir(CACHE_DIR, { recursive: true });
  const temporaryPath = `${CACHE_PATH}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(cache), "utf8");
  await rename(temporaryPath, CACHE_PATH);
}

async function readCache(): Promise<CacheFile> {
  try {
    const parsed = JSON.parse(await readFile(CACHE_PATH, "utf8")) as Partial<CacheFile>;
    if (!parsed.authors || typeof parsed.authors !== "object") return emptyCache();
    return { version: 1, authors: parsed.authors };
  } catch {
    return emptyCache();
  }
}

function emptyCache(): CacheFile {
  return { version: 1, authors: {} };
}
