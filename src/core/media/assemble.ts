import fs from "node:fs";
import path from "node:path";
import type { PieceAssets, Shot } from "@/core/content/types";
import { assetAbsPath, pieceDir } from "./storage";
import { ffprobeDuration, hasFfmpeg, runFfmpeg } from "./ffmpeg";

const DATA_DIR = path.join(process.cwd(), "data");
const VIDEO_FILTER =
  "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,format=yuv420p";
const HOOK_SECONDS = 3;
const CLOSING_SECONDS = 3;
const MARGIN_PRE = 0.5;
const MARGIN_POST = 1;

interface Segment {
  start: number;
  end: number;
}

interface VideoSource {
  input: number;
  start?: number;
  end?: number;
  duration?: number;
  padAfter?: number;
}

export interface AssembleResult {
  path: string;
  seconds: number | null;
  subtitlesBurned: boolean;
  qcFrames: boolean;
}

export interface AssembleArgs {
  pieceId: string;
  assets: PieceAssets;
  locucionText: string;
  shots: Shot[];
}

export interface PresenterDemoArgs {
  pieceId: string;
  presenterPath: string;
  recordingPath: string;
  locucionText: string;
  burnSubtitles: boolean;
}

function existingAsset(rel: string): string | null {
  if (!rel) return null;
  try {
    const abs = assetAbsPath(rel);
    return fs.existsSync(abs) ? abs : null;
  } catch {
    return null;
  }
}

function inputPath(abs: string, cwd: string): string {
  return path.relative(cwd, abs).replace(/\\/g, "/");
}

function readNavSegments(dir: string, recordingDuration: number | null): Segment[] {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, "nav_log.json"), "utf8")) as {
      duracion?: number;
      pasos?: Array<{ action?: string; t_inicio?: number; t_fin?: number }>;
    };
    const limit =
      recordingDuration ??
      (typeof raw.duracion === "number" && Number.isFinite(raw.duracion) ? raw.duracion : Infinity);
    const segments = (Array.isArray(raw.pasos) ? raw.pasos : [])
      .filter((step) => step.action !== "final")
      .map((step) => {
        const start = typeof step.t_inicio === "number" ? step.t_inicio : NaN;
        const end = typeof step.t_fin === "number" ? step.t_fin : NaN;
        return {
          start: Math.max(0, start - MARGIN_PRE),
          end: Math.min(limit, end + MARGIN_POST),
        };
      })
      .filter((segment) => Number.isFinite(segment.start) && segment.end > segment.start)
      .sort((a, b) => a.start - b.start);

    return segments.reduce<Segment[]>((merged, segment) => {
      const previous = merged.at(-1);
      if (previous && segment.start <= previous.end) {
        previous.end = Math.max(previous.end, segment.end);
      } else {
        merged.push({ ...segment });
      }
      return merged;
    }, []);
  } catch {
    return [];
  }
}

function capSegments(segments: Segment[], targetSeconds: number): Segment[] {
  const capped = segments.map((segment) => ({ ...segment }));
  let duration = capped.reduce((sum, segment) => sum + segment.end - segment.start, 0);
  while (duration > targetSeconds && capped.length > 0) {
    const excess = duration - targetSeconds;
    const last = capped.at(-1)!;
    const length = last.end - last.start;
    if (length <= excess + 1) {
      capped.pop();
      duration -= length;
    } else {
      last.end -= excess;
      duration -= excess;
    }
  }
  return capped;
}

function srtTime(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function writeSrt(dir: string, text: string, duration: number): boolean {
  const phrases =
    text
      .match(/[^.!?¿¡]+[.!?]*/g)
      ?.map((phrase) => phrase.trim().replace(/\s+/g, " "))
      .filter(Boolean) ?? [];
  if (phrases.length === 0 || duration <= 0) return false;

  const totalChars = phrases.reduce((sum, phrase) => sum + phrase.length, 0);
  let cursor = 0;
  const blocks = phrases.map((phrase, index) => {
    const phraseDuration = (phrase.length / totalChars) * duration;
    const start = cursor;
    cursor += phraseDuration;
    return `${index + 1}\n${srtTime(start)} --> ${srtTime(cursor)}\n${phrase}`;
  });
  fs.writeFileSync(path.join(dir, "subs.srt"), `${blocks.join("\n\n")}\n`, "utf8");
  return true;
}

function filterGraph(sources: VideoSource[], withSubtitles: boolean): string {
  const filters = sources.map((source, index) => {
    let trim = "";
    if (source.start !== undefined && source.end !== undefined) {
      trim = `trim=start=${source.start.toFixed(2)}:end=${source.end.toFixed(2)},`;
    } else if (source.duration !== undefined) {
      trim = `trim=duration=${source.duration.toFixed(2)},`;
    }
    const pad =
      source.padAfter && source.padAfter > 0
        ? `,tpad=stop_mode=clone:stop_duration=${source.padAfter.toFixed(2)}`
        : "";
    return `[${source.input}:v]${trim}setpts=PTS-STARTPTS,${VIDEO_FILTER}${pad}[v${index}]`;
  });

  const labels = sources.map((_, index) => `[v${index}]`).join("");
  const baseLabel = sources.length === 1 ? "v0" : "vcat";
  if (sources.length > 1) {
    filters.push(`${labels}concat=n=${sources.length}:v=1:a=0[${baseLabel}]`);
  }

  if (withSubtitles) {
    filters.push(
      `[${baseLabel}]subtitles=subs.srt:force_style='FontSize=16,Bold=1,Alignment=2,MarginV=60,OutlineColour=&H80000000,Outline=2'[v]`,
    );
  } else {
    filters.push(`[${baseLabel}]null[v]`);
  }
  return filters.join(";");
}

/**
 * Monta una pieza vertical determinista. Devuelve null cuando no hay FFmpeg o
 * no existe ningun video util; los errores de render se dejan al llamador para
 * que pueda degradar al preview actual sin romper el pipeline.
 */
export function assemble(args: AssembleArgs): AssembleResult | null {
  if (!hasFfmpeg()) return null;

  const dir = pieceDir(args.pieceId);
  const clips = args.assets.clips.map(existingAsset).filter((clip): clip is string => Boolean(clip));
  const recording = existingAsset(args.assets.recordingPath);
  const audio = existingAsset(args.assets.audioPath);
  if (!recording && clips.length === 0) return null;

  const estimatedDuration = Math.max(
    1,
    args.shots.reduce((sum, shot) => sum + Math.max(0, shot.segundos || 0), 0),
  );
  const audioDuration = audio ? ffprobeDuration(audio) : null;
  const targetDuration = audioDuration ?? estimatedDuration;
  const recordingDuration = recording ? ffprobeDuration(recording) : null;

  const inputs: string[] = [];
  const addInput = (abs: string): number => {
    const normalized = inputPath(abs, dir);
    const existing = inputs.indexOf(normalized);
    if (existing >= 0) return existing;
    inputs.push(normalized);
    return inputs.length - 1;
  };
  const sources: VideoSource[] = [];

  if (recording && clips.length >= 2) {
    sources.push({ input: addInput(clips[0]), duration: HOOK_SECONDS });
    const demoTarget = Math.max(5, targetDuration - HOOK_SECONDS - CLOSING_SECONDS + 1);
    let segments = capSegments(readNavSegments(dir, recordingDuration), demoTarget);
    if (segments.length === 0 && recordingDuration) {
      segments = [{ start: 0, end: Math.min(recordingDuration, demoTarget) }];
    }
    if (segments.length > 0) {
      const recordingInput = addInput(recording);
      sources.push(
        ...segments.map((segment) => ({
          input: recordingInput,
          start: segment.start,
          end: segment.end,
        })),
      );
    } else {
      sources.push({ input: addInput(recording) });
    }
    sources.push({ input: addInput(clips.at(-1)!), duration: CLOSING_SECONDS });
  } else if (recording && clips.length === 1) {
    sources.push({ input: addInput(clips[0]), duration: HOOK_SECONDS });
    sources.push({ input: addInput(recording) });
  } else if (recording) {
    // Caso degradado: solo grabacion, se conserva entera.
    sources.push({ input: addInput(recording) });
  } else {
    // REQ-005 y caso degradado: concatena todos los clips disponibles.
    clips.forEach((clip, index) => {
      const seconds = args.shots[index]?.segundos;
      sources.push({
        input: addInput(clip),
        ...(seconds && seconds > 0 ? { duration: seconds } : {}),
      });
    });
  }

  if (sources.length === 0) return null;
  const audioInput = audio ? addInput(audio) : null;
  const hasSubtitles = writeSrt(dir, args.locucionText, targetDuration);

  const baseArgs = inputs.flatMap((input) => ["-i", input]);
  const outputArgs = [
    "-map",
    "[v]",
    ...(audioInput !== null ? ["-map", `${audioInput}:a:0`, "-shortest"] : []),
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    ...(audioInput !== null ? ["-c:a", "aac"] : []),
    "-movflags",
    "+faststart",
    "final.mp4",
  ];

  let subtitlesBurned = hasSubtitles;
  try {
    runFfmpeg(
      ["-y", ...baseArgs, "-filter_complex", filterGraph(sources, hasSubtitles), ...outputArgs],
      dir,
    );
  } catch (error) {
    if (!hasSubtitles) throw error;
    // Algunas instalaciones de FFmpeg no incluyen libass/subtitles. El video
    // sigue siendo util: se reintenta sin quemar subtitulos.
    subtitlesBurned = false;
    runFfmpeg(["-y", ...baseArgs, "-filter_complex", filterGraph(sources, false), ...outputArgs], dir);
  }

  const finalAbs = path.join(dir, "final.mp4");
  if (!fs.existsSync(finalAbs)) throw new Error("FFmpeg no genero final.mp4.");

  let qcFrames = false;
  try {
    runFfmpeg(["-y", "-i", "final.mp4", "-vf", "fps=1/10", "qc_%d.jpg"], dir);
    qcFrames = fs.readdirSync(dir).some((name) => /^qc_\d+\.jpg$/i.test(name));
  } catch {
    // QC es auxiliar: nunca invalida un montaje ya generado.
  }

  return {
    path: path.relative(DATA_DIR, finalAbs).replace(/\\/g, "/"),
    seconds: ffprobeDuration(finalAbs),
    subtitlesBurned,
    qcFrames,
  };
}

/**
 * Montaje para contenido propio con presentador HeyGen:
 * presentador al inicio y al final, screencast en el centro y el audio continuo
 * del video HeyGen como pista maestra. Si falta algun recurso o no se puede
 * medir el presentador devuelve null para conservar el original sin degradarlo.
 */
export function assemblePresenterDemo(args: PresenterDemoArgs): AssembleResult | null {
  if (!hasFfmpeg()) return null;

  const dir = pieceDir(args.pieceId);
  const presenter = existingAsset(args.presenterPath);
  const recording = existingAsset(args.recordingPath);
  if (!presenter || !recording) return null;

  const presenterDuration = ffprobeDuration(presenter);
  if (!presenterDuration || presenterDuration <= 6) return null;
  const recordingDuration = ffprobeDuration(recording);
  const hookSeconds = Math.min(HOOK_SECONDS, presenterDuration / 3);
  const closingSeconds = Math.min(CLOSING_SECONDS, presenterDuration / 3);
  const middleSeconds = presenterDuration - hookSeconds - closingSeconds;
  if (middleSeconds <= 0) return null;

  const inputs: string[] = [];
  const addInput = (abs: string): number => {
    const normalized = inputPath(abs, dir);
    const existing = inputs.indexOf(normalized);
    if (existing >= 0) return existing;
    inputs.push(normalized);
    return inputs.length - 1;
  };
  const presenterInput = addInput(presenter);
  const recordingInput = addInput(recording);
  const sources: VideoSource[] = [
    { input: presenterInput, start: 0, end: hookSeconds },
  ];

  let segments = capSegments(readNavSegments(dir, recordingDuration), middleSeconds);
  if (segments.length === 0) {
    const available = recordingDuration ? Math.min(recordingDuration, middleSeconds) : middleSeconds;
    sources.push({
      input: recordingInput,
      start: 0,
      end: available,
      padAfter: Math.max(0, middleSeconds - available),
    });
  } else {
    const used = segments.reduce((sum, segment) => sum + segment.end - segment.start, 0);
    const padding = Math.max(0, middleSeconds - used);
    segments.forEach((segment, index) => {
      sources.push({
        input: recordingInput,
        start: segment.start,
        end: segment.end,
        ...(index === segments.length - 1 && padding > 0 ? { padAfter: padding } : {}),
      });
    });
  }

  sources.push({
    input: presenterInput,
    start: presenterDuration - closingSeconds,
    end: presenterDuration,
  });

  const wantsSubtitles =
    args.burnSubtitles &&
    Boolean(args.locucionText.trim()) &&
    writeSrt(dir, args.locucionText, presenterDuration);
  const baseArgs = inputs.flatMap((input) => ["-i", input]);
  const outputArgs = [
    "-map",
    "[v]",
    "-map",
    `${presenterInput}:a:0`,
    "-shortest",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    "final.mp4",
  ];

  let subtitlesBurned = wantsSubtitles;
  try {
    runFfmpeg(
      ["-y", ...baseArgs, "-filter_complex", filterGraph(sources, wantsSubtitles), ...outputArgs],
      dir,
    );
  } catch (error) {
    if (!wantsSubtitles) throw error;
    subtitlesBurned = false;
    runFfmpeg(
      ["-y", ...baseArgs, "-filter_complex", filterGraph(sources, false), ...outputArgs],
      dir,
    );
  }

  const finalAbs = path.join(dir, "final.mp4");
  if (!fs.existsSync(finalAbs)) throw new Error("FFmpeg no genero final.mp4.");

  let qcFrames = false;
  try {
    runFfmpeg(["-y", "-i", "final.mp4", "-vf", "fps=1/10", "qc_%d.jpg"], dir);
    qcFrames = fs.readdirSync(dir).some((name) => /^qc_\d+\.jpg$/i.test(name));
  } catch {
    // El control visual no invalida un montaje ya generado.
  }

  return {
    path: path.relative(DATA_DIR, finalAbs).replace(/\\/g, "/"),
    seconds: ffprobeDuration(finalAbs),
    subtitlesBurned,
    qcFrames,
  };
}
