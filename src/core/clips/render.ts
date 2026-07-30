import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { systemToolPath } from "@/core/media/bintools";
import { writeTimedAssSubtitles } from "@/core/media/subtitles";
import {
  subtitleCuesForMoment,
  type ClipMoment,
  type ClipSelection,
} from "./contracts";

const execFileAsync = promisify(execFile);

export async function renderClipMoment(args: {
  sourcePath: string;
  outputDir: string;
  selection: ClipSelection;
  moment: ClipMoment;
}): Promise<{ outputName: string; thumbnailName: string }> {
  const ffmpeg = systemToolPath("ffmpeg");
  if (!ffmpeg) throw new Error("FFmpeg no está instalado o no se puede ejecutar.");
  const safeId = args.moment.id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const assName = `subs-${safeId}.ass`;
  const outputName = `clip-${safeId}.mp4`;
  const thumbnailName = `clip-${safeId}.jpg`;
  const cues = subtitleCuesForMoment(args.selection, args.moment);
  if (!writeTimedAssSubtitles(args.outputDir, cues, args.moment.duration, assName)) {
    throw new Error("No existe transcripción suficiente para subtitular este corte.");
  }

  const sourceName = path.basename(args.sourcePath);
  const filter = [
    "[0:v]split=2[background][foreground]",
    "[background]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=28[bg]",
    "[foreground]scale=1000:1800:force_original_aspect_ratio=decrease[fg]",
    `[bg][fg]overlay=(W-w)/2:(H-h)/2,ass=${assName},fps=30,setsar=1,format=yuv420p[v]`,
  ].join(";");

  await execFileAsync(
    ffmpeg,
    [
      "-y",
      "-ss", args.moment.start.toFixed(3),
      "-t", args.moment.duration.toFixed(3),
      "-i", sourceName,
      "-filter_complex", filter,
      "-map", "[v]",
      "-map", "0:a:0?",
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "20",
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "+faststart",
      outputName,
    ],
    {
      cwd: args.outputDir,
      timeout: 15 * 60_000,
      maxBuffer: 24 * 1024 * 1024,
      windowsHide: true,
    },
  );

  await execFileAsync(
    ffmpeg,
    [
      "-y",
      "-ss", "1",
      "-i", outputName,
      "-frames:v", "1",
      "-q:v", "3",
      thumbnailName,
    ],
    {
      cwd: args.outputDir,
      timeout: 90_000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    },
  );

  return { outputName, thumbnailName };
}
