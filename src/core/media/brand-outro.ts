import fs from "node:fs";
import path from "node:path";
import { assetAbsPath, pieceDir } from "./storage";
import { ffprobeDuration, ffprobeHasAudio, hasFfmpeg, hasFfprobe, runFfmpeg } from "./ffmpeg";
import type { PieceAssets } from "@/core/content/types";

const DATA_DIR = path.join(process.cwd(), "data");
const OUTRO_SECONDS = 3;
const VIDEO_FILTER = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,format=yuv420p";

export interface BrandOutroResult {
  path: string;
  outroPath: string;
  seconds: number | null;
}

function relativeInput(abs: string, cwd: string): string {
  return path.relative(cwd, abs).replace(/\\/g, "/");
}

/**
 * Crea un cierre vertical de marca de 3 s y lo añade después del vídeo. El logo
 * se conserva exacto: la animación local evita deformaciones de modelos generativos.
 */
export function appendBrandOutro(args: {
  pieceId: string;
  videoPath: string;
  logoPath: string;
}): BrandOutroResult | null {
  // ffprobe es necesario para no arriesgarnos a eliminar una locucion existente.
  if (!hasFfmpeg() || !hasFfprobe() || !args.videoPath || !args.logoPath) return null;
  const video = assetAbsPath(args.videoPath);
  const logo = assetAbsPath(args.logoPath);
  if (!fs.existsSync(video) || !fs.existsSync(logo)) return null;
  const mainSeconds = ffprobeDuration(video);
  if (!mainSeconds || mainSeconds <= 0) return null;
  const totalSeconds = mainSeconds + OUTRO_SECONDS;

  const dir = pieceDir(args.pieceId);
  const stamp = Date.now();
  const outroName = `brand-outro-${stamp}.mp4`;
  const finalName = `final-branded-${stamp}.mp4`;
  const logoInput = relativeInput(logo, dir);

  runFfmpeg([
    "-y",
    "-f", "lavfi",
    "-i", `color=c=0x070912:s=1080x1920:r=30:d=${OUTRO_SECONDS}`,
    "-loop", "1",
    "-framerate", "30",
    "-t", String(OUTRO_SECONDS),
    "-i", logoInput,
    "-filter_complex",
    "[1:v]scale=620:620:force_original_aspect_ratio=decrease,format=rgba,fade=t=in:st=0:d=0.45:alpha=1,fade=t=out:st=2.45:d=0.45:alpha=1[mark];[0:v][mark]overlay=x=(W-w)/2:y='(H-h)/2+24-24*min(t/0.8,1)':shortest=1,format=yuv420p[v]",
    "-map", "[v]",
    "-t", String(OUTRO_SECONDS),
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "20",
    "-movflags", "+faststart",
    outroName,
  ], dir);

  const videoInput = relativeInput(video, dir);
  const hasAudio = ffprobeHasAudio(video);
  runFfmpeg([
    "-y",
    "-i", videoInput,
    "-i", outroName,
    "-filter_complex",
    `[0:v]${VIDEO_FILTER}[main];[1:v]${VIDEO_FILTER}[outro];[main][outro]concat=n=2:v=1:a=0[v]`,
    "-map", "[v]",
    ...(hasAudio ? ["-map", "0:a:0", "-af", "apad", "-c:a", "aac"] : []),
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "20",
    "-t", totalSeconds.toFixed(3),
    "-movflags", "+faststart",
    finalName,
  ], dir);

  const finalAbs = path.join(dir, finalName);
  const outroAbs = path.join(dir, outroName);
  if (!fs.existsSync(finalAbs) || !fs.existsSync(outroAbs)) {
    throw new Error("FFmpeg no generó el cierre animado de marca.");
  }
  return {
    path: path.relative(DATA_DIR, finalAbs).replace(/\\/g, "/"),
    outroPath: path.relative(DATA_DIR, outroAbs).replace(/\\/g, "/"),
    seconds: ffprobeDuration(finalAbs),
  };
}

export function applyBrandOutro(args: {
  pieceId: string;
  logoPath?: string | null;
  assets: PieceAssets;
  log: (message: string) => void;
}): void {
  if (!args.logoPath) {
    const message = "Cierre de marca omitido: sube el logo del proyecto para añadir su animación final.";
    args.assets.logs.push(message);
    args.log(message);
    return;
  }
  try {
    const result = appendBrandOutro({
      pieceId: args.pieceId,
      videoPath: args.assets.videoPath,
      logoPath: args.logoPath,
    });
    if (!result) {
      const message = "Cierre de marca omitido: comprueba logo, vídeo final, FFmpeg y ffprobe.";
      args.assets.logs.push(message);
      args.log(message);
      return;
    }
    args.assets.videoPath = result.path;
    args.assets.brandOutroPath = result.outroPath;
    const message = "Cierre animado de marca añadido al final (3 s, sin consumir créditos).";
    args.assets.logs.push(message);
    args.log(message);
  } catch (error) {
    const message = `No se pudo añadir el cierre de marca: ${error instanceof Error ? error.message : String(error)}. Se conserva el montaje sin logo.`;
    args.assets.logs.push(message);
    args.log(message);
  }
}
