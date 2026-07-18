import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { assetAbsPath, projectLibraryDir } from "./storage";
import { ffprobeDuration, hasFfmpeg, runFfmpeg } from "./ffmpeg";
import { writeAssSubtitles } from "./subtitles";

export interface MixRecipe {
  videoAssetIds: string[];
  voiceAssetId: string;
  musicAssetId: string;
  subtitleText: string;
  musicVolume: number;
}

export function coerceMixRecipe(raw: unknown): MixRecipe {
  const value = (raw ?? {}) as Record<string, unknown>;
  const ids = Array.isArray(value.videoAssetIds)
    ? value.videoAssetIds.filter((id): id is string => typeof id === "string" && Boolean(id))
    : [];
  const volume = Number(value.musicVolume);
  return {
    videoAssetIds: [...new Set(ids)].slice(0, 20),
    voiceAssetId: typeof value.voiceAssetId === "string" ? value.voiceAssetId : "",
    musicAssetId: typeof value.musicAssetId === "string" ? value.musicAssetId : "",
    subtitleText: typeof value.subtitleText === "string" ? value.subtitleText.trim() : "",
    musicVolume: Number.isFinite(volume) ? Math.min(0.5, Math.max(0.02, volume)) : 0.12,
  };
}

export async function assembleMix(projectId: string, mixId: string, recipe: MixRecipe): Promise<string> {
  if (!hasFfmpeg()) throw new Error("FFmpeg no está disponible. Revísalo en Ajustes.");
  if (recipe.videoAssetIds.length === 0) throw new Error("Selecciona al menos un vídeo.");
  if (!recipe.subtitleText) throw new Error("Los subtítulos son obligatorios para generar el MIX.");

  const ids = [...recipe.videoAssetIds, recipe.voiceAssetId, recipe.musicAssetId].filter(Boolean);
  const rows = await prisma.mediaAsset.findMany({ where: { projectId, id: { in: ids } } });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const videos = recipe.videoAssetIds.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (videos.length !== recipe.videoAssetIds.length) throw new Error("Uno de los vídeos ya no existe.");
  const voice = recipe.voiceAssetId ? byId.get(recipe.voiceAssetId) : null;
  const music = recipe.musicAssetId ? byId.get(recipe.musicAssetId) : null;

  const videoFiles = videos.map((asset) => assetAbsPath(asset.path));
  const durations = videoFiles.map((file) => ffprobeDuration(file) ?? 5);
  const voiceFile = voice ? assetAbsPath(voice.path) : null;
  const voiceDuration = voiceFile ? ffprobeDuration(voiceFile) : null;
  const visualDuration = durations.reduce((sum, duration) => sum + duration, 0);
  const targetDuration = voiceDuration ?? visualDuration;
  const padLast = Math.max(0, targetDuration - visualDuration);

  const dir = projectLibraryDir(projectId);
  if (!writeAssSubtitles(dir, recipe.subtitleText, targetDuration)) {
    throw new Error("No se pudieron preparar los subtítulos obligatorios.");
  }

  const inputs: string[] = [];
  for (const file of videoFiles) inputs.push("-i", file);
  const voiceIndex = voiceFile ? videoFiles.length : -1;
  if (voiceFile) inputs.push("-i", voiceFile);
  const musicIndex = music ? videoFiles.length + (voiceFile ? 1 : 0) : -1;
  if (music) inputs.push("-stream_loop", "-1", "-i", assetAbsPath(music.path));

  const videoFilters = videoFiles.map((_, index) => {
    const padding = index === videoFiles.length - 1 && padLast > 0
      ? `,tpad=stop_mode=clone:stop_duration=${padLast.toFixed(2)}`
      : "";
    return `[${index}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,setsar=1,setpts=PTS-STARTPTS${padding}[v${index}]`;
  });
  const labels = videoFiles.map((_, index) => `[v${index}]`).join("");
  videoFilters.push(`${labels}concat=n=${videoFiles.length}:v=1:a=0[vcat]`);
  videoFilters.push(`[vcat]ass=subs.ass[vout]`);

  let audioMap: string[] = [];
  if (voiceIndex >= 0 && musicIndex >= 0) {
    videoFilters.push(`[${voiceIndex}:a]volume=1[voice]`);
    videoFilters.push(`[${musicIndex}:a]volume=${recipe.musicVolume.toFixed(2)},atrim=duration=${targetDuration.toFixed(2)}[music]`);
    videoFilters.push(`[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]`);
    audioMap = ["-map", "[aout]", "-c:a", "aac"];
  } else if (voiceIndex >= 0) {
    audioMap = ["-map", `${voiceIndex}:a:0`, "-c:a", "aac"];
  } else if (musicIndex >= 0) {
    videoFilters.push(`[${musicIndex}:a]volume=${recipe.musicVolume.toFixed(2)},atrim=duration=${targetDuration.toFixed(2)}[aout]`);
    audioMap = ["-map", "[aout]", "-c:a", "aac"];
  } else {
    // Sin pista maestra externa, conserva el audio del primer vídeo si existe.
    audioMap = ["-map", "0:a:0?", "-c:a", "aac"];
  }

  const outputName = `mix-${mixId}.mp4`;
  try {
    runFfmpeg([
      "-y", ...inputs, "-filter_complex", videoFilters.join(";"), "-map", "[vout]", ...audioMap,
      "-t", targetDuration.toFixed(2), "-c:v", "libx264", "-preset", "medium", "-crf", "20",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputName,
    ], dir);
  } catch (error) {
    throw new Error(`MIX falló; se conserva todo lo anterior: ${(error as Error).message}`);
  }
  const output = path.join(dir, outputName);
  if (!fs.existsSync(output)) throw new Error("FFmpeg no generó el fichero MIX.");
  return path.relative(path.join(process.cwd(), "data"), output).replace(/\\/g, "/");
}
