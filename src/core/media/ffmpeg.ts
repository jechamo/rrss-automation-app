import { execFileSync } from "node:child_process";
import { systemToolPath } from "./bintools";

// Utilidades FFmpeg/ffprobe para el montaje real (D-12).
// Degradacion obligatoria: si el binario no esta instalado, hasFfmpeg()/hasFfprobe()
// devuelven false y el llamador mantiene su comportamiento actual (nada se rompe).
// En Windows se usa execFileSync con array de args (NO string de shell) para evitar
// el infierno de quoting de cmd; el filtro `subtitles` se resuelve con cwd + rutas relativas.

/** ¿Esta ffmpeg disponible en PATH, override o WinGet? (cacheado en bintools) */
export function hasFfmpeg(): boolean {
  return Boolean(systemToolPath("ffmpeg"));
}

/** ¿Esta ffprobe disponible en PATH, override o WinGet? */
export function hasFfprobe(): boolean {
  return Boolean(systemToolPath("ffprobe"));
}

/**
 * Duracion en segundos de un fichero de audio/video via ffprobe.
 * Devuelve null si no hay ffprobe o el fichero no se puede leer.
 */
export function ffprobeDuration(absPath: string): number | null {
  if (!hasFfprobe()) return null;
  const binary = systemToolPath("ffprobe")!;
  try {
    const out = execFileSync(
      binary,
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", absPath],
      { encoding: "utf8" },
    );
    const n = parseFloat(out.trim());
    if (Number.isFinite(n)) return n;
  } catch {
    // Algunos WebM de MediaRecorder no escriben format.duration.
  }
  try {
    const packets = execFileSync(
      binary,
      [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "packet=pts_time",
        "-of", "csv=p=0",
        absPath,
      ],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    const lastTimestamp = packets
      .split(/\r?\n/)
      .map((line) => parseFloat(line.trim()))
      .filter(Number.isFinite)
      .at(-1);
    return lastTimestamp && lastTimestamp > 0 ? lastTimestamp : null;
  } catch {
    return null;
  }
}

export function ffprobeHasAudio(absPath: string): boolean {
  if (!hasFfprobe()) return false;
  const binary = systemToolPath("ffprobe")!;
  try {
    const out = execFileSync(
      binary,
      ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=index", "-of", "csv=p=0", absPath],
      { encoding: "utf8" },
    );
    return Boolean(out.trim());
  } catch {
    return false;
  }
}

export function ffprobeHasVideo(absPath: string): boolean {
  if (!hasFfprobe()) return false;
  const binary = systemToolPath("ffprobe")!;
  try {
    const out = execFileSync(
      binary,
      ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=index", "-of", "csv=p=0", absPath],
      { encoding: "utf8" },
    );
    return Boolean(out.trim());
  } catch {
    return false;
  }
}

/**
 * Ejecuta ffmpeg con un array de argumentos (nunca string de shell).
 * Pasa `cwd` para poder usar rutas relativas (imprescindible para el filtro subtitles en Windows).
 * Lanza si ffmpeg devuelve un codigo != 0.
 */
export function runFfmpeg(args: string[], cwd?: string): void {
  const binary = systemToolPath("ffmpeg");
  if (!binary) throw new Error("FFmpeg no esta instalado o no se puede ejecutar.");
  execFileSync(binary, args, { cwd, stdio: "inherit" });
}
