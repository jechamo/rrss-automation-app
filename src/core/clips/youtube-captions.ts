import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { systemToolPath } from "@/core/media/bintools";
import type { TranscriptCue } from "./contracts";
import { parseYouTubeJson3 } from "./youtube-captions-contracts";

export { applyYouTubeCaptions } from "./youtube-captions-contracts";

const execFileAsync = promisify(execFile);
const CACHE_NAME = "source-captions.json";

export async function loadYouTubeCaptions(
  url: string,
  outputDir: string,
  options: { forceRefresh?: boolean } = {},
): Promise<TranscriptCue[]> {
  const cachePath = path.join(outputDir, CACHE_NAME);
  if (!options.forceRefresh && fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf8")) as unknown;
      if (Array.isArray(cached) && cached.length > 0) return cached as TranscriptCue[];
      fs.rmSync(cachePath, { force: true });
    } catch {
      fs.rmSync(cachePath, { force: true });
    }
  }
  const binary = systemToolPath("yt-dlp");
  if (!binary) return [];

  // yt-dlp puede escribir el JSON3 completo y aun así terminar con código no cero
  // por otra pista solicitada. Aprovechamos cualquier pista válida antes de repetir red.
  const existing = readCaptionCandidates(outputDir);
  if (existing.cues.length > 0) {
    persistCaptionCache(cachePath, existing.cues, existing.names, outputDir);
    return existing.cues;
  }

  let commandError: unknown;
  try {
    await execFileAsync(
      binary,
      [
        "--no-playlist",
        "--no-progress",
        "--skip-download",
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs", "es.*,es,en.*,en",
        "--sub-format", "json3",
        "-o", path.join(outputDir, "captions"),
        url,
      ],
      {
        timeout: 3 * 60_000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
        encoding: "utf8",
      },
    );
  } catch (error) {
    commandError = error;
  }

  const downloaded = readCaptionCandidates(outputDir);
  if (downloaded.cues.length > 0) {
    persistCaptionCache(cachePath, downloaded.cues, downloaded.names, outputDir);
    return downloaded.cues;
  }
  if (commandError) {
    const detail = commandError && typeof commandError === "object" && "stderr" in commandError
      ? String((commandError as { stderr?: unknown }).stderr ?? "").trim().split(/\r?\n/).at(-1)
      : "";
    throw new Error(detail || "yt-dlp no pudo descargar una pista de subtítulos utilizable.");
  }
  if (downloaded.names.length > 0) {
    throw new Error("YouTube entregó pistas JSON3, pero no contenían texto temporizado utilizable.");
  }
  return [];
}

function readCaptionCandidates(outputDir: string): { cues: TranscriptCue[]; names: string[] } {
  const names = fs.readdirSync(outputDir)
    .filter((name) => /^captions\..+\.json3$/i.test(name))
    .sort((a, b) => captionPriority(a) - captionPriority(b));
  for (const name of names) {
    try {
      const raw = fs.readFileSync(path.join(outputDir, name), "utf8").replace(/^\uFEFF/, "");
      const cues = parseYouTubeJson3(JSON.parse(raw));
      if (cues.length > 0) return { cues, names };
    } catch {
      // Prueba la siguiente pista: una traducción puede estar incompleta aunque la original sea válida.
    }
  }
  return { cues: [], names };
}

function persistCaptionCache(
  cachePath: string,
  cues: TranscriptCue[],
  candidates: string[],
  outputDir: string,
): void {
  fs.writeFileSync(cachePath, JSON.stringify(cues), "utf8");
  for (const name of candidates) fs.rmSync(path.join(outputDir, name), { force: true });
}

function captionPriority(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes(".es-orig.")) return 0;
  if (lower.includes(".es.")) return 1;
  if (lower.includes(".en-orig.")) return 2;
  if (lower.includes(".en.")) return 3;
  return 9;
}
