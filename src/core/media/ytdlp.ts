import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

// yt-dlp: binario del sistema OPCIONAL (como ffmpeg) para descargar videos de
// TikTok/Instagram/etc. y analizarlos con Gemini (Files API). Degradacion:
// si no esta instalado, hasYtDlp() = false y el llamador sigue con datos REQ-004.

const TMP_DIR = path.join(process.cwd(), "data", "tmp");

let _hasYtDlp: boolean | null = null;

/** ¿Esta yt-dlp disponible en el PATH? (cacheado) */
export function hasYtDlp(): boolean {
  if (_hasYtDlp === null) {
    try {
      _hasYtDlp = spawnSync("yt-dlp", ["--version"], { stdio: "ignore" }).status === 0;
    } catch {
      _hasYtDlp = false;
    }
  }
  return _hasYtDlp;
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
    "yt-dlp",
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
