import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { systemToolPath } from "@/core/media/bintools";
import { writeTimedAssSubtitles } from "@/core/media/subtitles";
import {
  subtitleCuesForMoment,
  type ClipMoment,
  type ClipSelection,
  type TranscriptCue,
} from "./contracts";
import { transcribeLocalAudio } from "./local-transcription";

const execFileAsync = promisify(execFile);

export async function renderClipMoment(args: {
  sourcePath: string;
  outputDir: string;
  selection: ClipSelection;
  moment: ClipMoment;
}): Promise<{
  outputName: string;
  thumbnailName: string;
  subtitleSource: NonNullable<ClipMoment["subtitleSource"]>;
  alignedTranscript: string;
  evidence: string;
}> {
  const ffmpeg = systemToolPath("ffmpeg");
  if (!ffmpeg) throw new Error("FFmpeg no está instalado o no se puede ejecutar.");
  const safeId = args.moment.id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const assName = `subs-${safeId}.ass`;
  const outputName = `clip-${safeId}.mp4`;
  const thumbnailName = `clip-${safeId}.jpg`;
  const renderToken = `${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
  const temporaryOutput = `render-${safeId}-${renderToken}.mp4`;
  const temporaryThumbnail = `render-${safeId}-${renderToken}.jpg`;
  const trustedSource = args.moment.subtitleSource === "synced_json"
    || args.moment.subtitleSource === "youtube_cc"
    || args.moment.subtitleSource === "gemini";
  let subtitleSource: NonNullable<ClipMoment["subtitleSource"]>;
  let cues: TranscriptCue[];
  if (trustedSource) {
    subtitleSource = args.moment.subtitleSource as NonNullable<ClipMoment["subtitleSource"]>;
    cues = subtitleCuesForMoment(args.selection, args.moment);
  } else {
    const audioName = `audio-${safeId}.wav`;
    const audioPath = path.join(args.outputDir, audioName);
    try {
      await execFileAsync(
        ffmpeg,
        [
          "-y",
          "-ss", args.moment.start.toFixed(3),
          "-t", args.moment.duration.toFixed(3),
          "-i", path.basename(args.sourcePath),
          "-vn",
          "-ac", "1",
          "-ar", "16000",
          "-c:a", "pcm_s16le",
          audioName,
        ],
        {
          cwd: args.outputDir,
          timeout: 5 * 60_000,
          maxBuffer: 8 * 1024 * 1024,
          windowsHide: true,
        },
      );
      const transcription = await transcribeLocalAudio(audioPath, args.selection.language);
      cues = transcription.cues;
      subtitleSource = "local_whisper";
    } finally {
      fs.rmSync(audioPath, { force: true });
    }
  }
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

  try {
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
        temporaryOutput,
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
        "-i", temporaryOutput,
        "-frames:v", "1",
        "-q:v", "3",
        temporaryThumbnail,
      ],
      {
        cwd: args.outputDir,
        timeout: 90_000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      },
    );
    replaceGeneratedFile(
      path.join(args.outputDir, temporaryOutput),
      path.join(args.outputDir, outputName),
    );
    replaceGeneratedFile(
      path.join(args.outputDir, temporaryThumbnail),
      path.join(args.outputDir, thumbnailName),
    );
  } finally {
    fs.rmSync(path.join(args.outputDir, temporaryOutput), { force: true });
    fs.rmSync(path.join(args.outputDir, temporaryThumbnail), { force: true });
  }

  const alignedTranscript = cues.map((cue) => cue.text).join(" ");
  return {
    outputName,
    thumbnailName,
    subtitleSource,
    alignedTranscript,
    evidence: alignedTranscript.slice(0, 500),
  };
}

function replaceGeneratedFile(temporary: string, target: string): void {
  const backup = `${target}.${crypto.randomUUID().slice(0, 8)}.bak`;
  const hadTarget = fs.existsSync(target);
  if (hadTarget) fs.renameSync(target, backup);
  try {
    fs.renameSync(temporary, target);
    if (hadTarget) fs.rmSync(backup, { force: true });
  } catch (error) {
    if (hadTarget && fs.existsSync(backup) && !fs.existsSync(target)) {
      fs.renameSync(backup, target);
    }
    throw error;
  }
}
