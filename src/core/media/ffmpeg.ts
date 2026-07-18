import { execFileSync, spawnSync } from "node:child_process";

// Utilidades FFmpeg/ffprobe para el montaje real (D-12).
// Degradacion obligatoria: si el binario no esta instalado, hasFfmpeg()/hasFfprobe()
// devuelven false y el llamador mantiene su comportamiento actual (nada se rompe).
// En Windows se usa execFileSync con array de args (NO string de shell) para evitar
// el infierno de quoting de cmd; el filtro `subtitles` se resuelve con cwd + rutas relativas.

let _hasFfmpeg: boolean | null = null;
let _hasFfprobe: boolean | null = null;

function probeBinary(bin: string): boolean {
  try {
    const r = spawnSync(bin, ["-version"], { stdio: "ignore" });
    return r.status === 0;
  } catch {
    return false;
  }
}

/** ¿Esta ffmpeg disponible en el PATH? (cacheado) */
export function hasFfmpeg(): boolean {
  if (_hasFfmpeg === null) _hasFfmpeg = probeBinary("ffmpeg");
  return _hasFfmpeg;
}

/** ¿Esta ffprobe disponible en el PATH? (cacheado) */
export function hasFfprobe(): boolean {
  if (_hasFfprobe === null) _hasFfprobe = probeBinary("ffprobe");
  return _hasFfprobe;
}

/**
 * Duracion en segundos de un fichero de audio/video via ffprobe.
 * Devuelve null si no hay ffprobe o el fichero no se puede leer.
 */
export function ffprobeDuration(absPath: string): number | null {
  if (!hasFfprobe()) return null;
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", absPath],
      { encoding: "utf8" },
    );
    const n = parseFloat(out.trim());
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Ejecuta ffmpeg con un array de argumentos (nunca string de shell).
 * Pasa `cwd` para poder usar rutas relativas (imprescindible para el filtro subtitles en Windows).
 * Lanza si ffmpeg devuelve un codigo != 0.
 */
export function runFfmpeg(args: string[], cwd?: string): void {
  execFileSync("ffmpeg", args, { cwd, stdio: "inherit" });
}
