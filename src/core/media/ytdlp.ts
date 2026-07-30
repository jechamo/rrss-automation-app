import fs from "node:fs";
import path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { systemToolPath } from "./bintools";

// yt-dlp: binario del sistema OPCIONAL (como ffmpeg) para descargar videos de
// TikTok/Instagram/etc. y analizarlos con Gemini (Files API). Degradacion:
// si no esta instalado, hasYtDlp() = false y el llamador sigue con datos REQ-004.

const TMP_DIR = path.join(process.cwd(), "data", "tmp");
const execFileAsync = promisify(execFile);

/** ¿Esta yt-dlp disponible en PATH, override o WinGet? */
export function hasYtDlp(): boolean {
  return Boolean(systemToolPath("yt-dlp"));
}

/**
 * Descarga un video a data/tmp/ y devuelve la ruta absoluta del fichero.
 * Acota el tamaño y el tiempo para no colgar el run. Lanza si yt-dlp falla.
 * El llamador es responsable de borrar el fichero (idealmente en finally).
 */
export function downloadVideo(url: string, maxFilesizeMb = 200): string {
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

/** Descarga asíncrona a un directorio concreto para procesos largos como REQ-017. */
export async function downloadVideoTo(
  url: string,
  outputDir: string,
  maxFilesizeMb = 500,
): Promise<string> {
  const binary = systemToolPath("yt-dlp");
  if (!binary) throw new Error("yt-dlp no está instalado.");
  fs.mkdirSync(outputDir, { recursive: true });
  const template = path.join(outputDir, "source.%(ext)s");
  await execFileAsync(
    binary,
    [
      "--no-playlist",
      "--max-filesize", `${maxFilesizeMb}M`,
      "--merge-output-format", "mp4",
      "-f", "bv*+ba/b",
      "-o", template,
      url,
    ],
    {
      timeout: 12 * 60_000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    },
  );
  const created = fs.readdirSync(outputDir)
    .filter((name) => /^source\.(?:mp4|webm|mov|mkv|m4v)$/i.test(name))
    .map((name) => path.join(outputDir, name));
  if (created.length === 0) {
    throw new Error("yt-dlp no produjo un vídeo utilizable. Comprueba que sea público.");
  }
  return created[0];
}
