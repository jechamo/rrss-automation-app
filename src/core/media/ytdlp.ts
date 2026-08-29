import fs from "node:fs";
import path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { systemToolPath } from "./bintools";
import { ffprobeHasAudio, ffprobeHasVideo } from "./ffmpeg";
import {
  clipDownloadFormatSelector,
  isClipDownloadArtifact,
  isClipDownloadCandidate,
} from "./ytdlp-contracts";
import { getDataDir } from "../runtime/e2e-profile";
import { isMockE2E } from "../runtime/e2e-profile";
import { recordMockProviderUse, simulateMockProvider } from "../testing/mock-runtime";

export {
  clipDownloadFormatSelector,
  isClipDownloadCandidate,
} from "./ytdlp-contracts";

// yt-dlp: binario del sistema OPCIONAL (como ffmpeg) para descargar videos de
// TikTok/Instagram/etc. y analizarlos con Gemini (Files API). Degradacion:
// si no esta instalado, hasYtDlp() = false y el llamador sigue con datos REQ-004.

const TMP_DIR = path.join(getDataDir(), "tmp");
const execFileAsync = promisify(execFile);
const CLIP_MAX_FILESIZE_MB = 2_048;

/** ¿Esta yt-dlp disponible en PATH, override o WinGet? */
export function hasYtDlp(): boolean {
  if (isMockE2E()) return true;
  return Boolean(systemToolPath("yt-dlp"));
}

/**
 * Descarga un video a data/tmp/ y devuelve la ruta absoluta del fichero.
 * Acota el tamaño y el tiempo para no colgar el run. Lanza si yt-dlp falla.
 * El llamador es responsable de borrar el fichero (idealmente en finally).
 */
export function downloadVideo(url: string, maxFilesizeMb = 200): string {
  if (isMockE2E()) {
    recordMockProviderUse("yt-dlp");
    fs.mkdirSync(TMP_DIR, { recursive: true });
    const file = path.join(TMP_DIR, "viral-e2e.mp4");
    fs.writeFileSync(file, Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex"));
    return file;
  }
  if (!hasYtDlp()) throw new Error("yt-dlp no esta instalado.");
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

  const base = path.join(TMP_DIR, `viral_${Date.now()}`);
  // Plantilla de salida fija (base + extension real que decida yt-dlp).
  execFileSync(
    systemToolPath("yt-dlp")!,
    [
      "--no-playlist",
      "--max-filesize",
      `${maxFilesizeMb}M`,
      "-f",
      "mp4/best",
      "-o",
      `${base}.%(ext)s`,
      url,
    ],
    { stdio: "ignore", timeout: 180_000 },
  );

  // Localiza el fichero recien creado (yt-dlp elige la extension).
  const dir = fs.readdirSync(TMP_DIR);
  const created = dir
    .filter((f) => f.startsWith(path.basename(base)))
    .map((f) => path.join(TMP_DIR, f));
  if (created.length === 0) throw new Error("yt-dlp no produjo ningun fichero (¿video privado?).");
  return created[0];
}

function cleanupPreviousClipDownload(outputDir: string): void {
  for (const name of fs.readdirSync(outputDir)) {
    if (!isClipDownloadArtifact(name)) continue;
    fs.rmSync(path.join(outputDir, name), { force: true });
  }
}

function partialDownloadBytes(outputDir: string): number {
  return fs.readdirSync(outputDir)
    .filter((name) => name.endsWith(".part") && isClipDownloadArtifact(name))
    .reduce((total, name) => total + fs.statSync(path.join(outputDir, name)).size, 0);
}

/** Descarga asíncrona a un directorio concreto para procesos largos como REQ-018. */
export async function downloadVideoTo(
  url: string,
  outputDir: string,
  maxFilesizeMb = CLIP_MAX_FILESIZE_MB,
): Promise<string> {
  if (isMockE2E()) {
    await simulateMockProvider("yt-dlp");
    fs.mkdirSync(outputDir, { recursive: true });
    const file = path.join(outputDir, "source.mp4");
    fs.writeFileSync(file, Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex"));
    return file;
  }
  const binary = systemToolPath("yt-dlp");
  if (!binary) throw new Error("yt-dlp no está instalado.");
  fs.mkdirSync(outputDir, { recursive: true });
  cleanupPreviousClipDownload(outputDir);
  const template = path.join(outputDir, "source.%(ext)s");
  let stderr = "";
  try {
    const result = await execFileAsync(
      binary,
      [
        "--no-playlist",
        "--no-progress",
        "--max-filesize", `${maxFilesizeMb}M`,
        "--merge-output-format", "mp4",
        "-f", clipDownloadFormatSelector(maxFilesizeMb),
        "-o", template,
        url,
      ],
      {
        timeout: 30 * 60_000,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        encoding: "utf8",
      },
    );
    stderr = result.stderr;
  } catch (error) {
    const detail = error && typeof error === "object" && "stderr" in error
      ? String((error as { stderr?: unknown }).stderr ?? "")
      : "";
    const concise = detail.trim().split(/\r?\n/).filter(Boolean).at(-1);
    throw new Error(
      concise
        ? `yt-dlp no pudo completar la descarga: ${concise}`
        : "yt-dlp no pudo completar la descarga de YouTube.",
    );
  }
  const created = fs.readdirSync(outputDir)
    .filter(isClipDownloadCandidate)
    .map((name) => path.join(outputDir, name))
    .filter((file) => ffprobeHasVideo(file) && ffprobeHasAudio(file));
  if (created.length === 0) {
    const partialMb = Math.round(partialDownloadBytes(outputDir) / (1024 * 1024));
    if (partialMb > 0) {
      throw new Error(
        `La descarga de YouTube quedó incompleta (${partialMb} MB parciales). `
        + `El formato disponible supera el límite operativo de ${maxFilesizeMb} MB.`,
      );
    }
    const lastDetail = stderr.trim().split(/\r?\n/).filter(Boolean).at(-1);
    throw new Error(
      "yt-dlp terminó sin generar un archivo final con vídeo y audio"
      + (lastDetail ? `: ${lastDetail}` : "."),
    );
  }
  return created.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
}
