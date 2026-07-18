import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { assetAbsPath, projectLibraryDir } from "./storage";
import { ffprobeDuration, hasFfmpeg, runFfmpeg } from "./ffmpeg";
import { writeAssSubtitles } from "./subtitles";
import { mixVideoCount, type MixRecipe } from "./mix-contracts";

export { coerceMixRecipe, mixVideoCount, mixVisualDuration } from "./mix-contracts";
export type { MixRecipe, MixSegment } from "./mix-contracts";

export async function assembleMix(projectId: string, mixId: string, recipe: MixRecipe): Promise<string> {
  if (!hasFfmpeg()) throw new Error("FFmpeg no está disponible. Revísalo en Ajustes.");
  if (mixVideoCount(recipe) === 0) throw new Error("Selecciona al menos un vídeo.");
  if (!recipe.subtitleText) throw new Error("Los subtítulos son obligatorios para generar el MIX.");

  const videoIds = recipe.version === 2
    ? recipe.segments.map((segment) => segment.assetId)
    : recipe.videoAssetIds;
  const ids = [...new Set([...videoIds, recipe.voiceAssetId, recipe.musicAssetId].filter(Boolean))];
  const rows = await prisma.mediaAsset.findMany({ where: { projectId, id: { in: ids } } });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const videos = videoIds.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (videos.length !== videoIds.length) throw new Error("Uno de los vídeos ya no existe.");
  const voice = recipe.voiceAssetId ? byId.get(recipe.voiceAssetId) : null;
  const music = recipe.musicAssetId ? byId.get(recipe.musicAssetId) : null;
  if (recipe.voiceAssetId && !voice) throw new Error("La locución seleccionada ya no existe.");
  if (recipe.musicAssetId && !music) throw new Error("La música seleccionada ya no existe.");

  const videoFiles = videos.map((asset) => assetAbsPath(asset.path));
  for (const file of videoFiles) {
    if (!fs.existsSync(file)) throw new Error(`Falta un recurso local del MIX: ${path.basename(file)}.`);
  }
  const sourceDurations = videoFiles.map((file) => ffprobeDuration(file));
  const durations = recipe.version === 2
    ? recipe.segments.map((segment, index) => {
        const sourceDuration = sourceDurations[index];
        if (sourceDuration && segment.sourceEnd > sourceDuration + 0.1) {
          throw new Error(`«${segment.label}» termina en ${segment.sourceEnd.toFixed(2)}s, pero su fuente dura ${sourceDuration.toFixed(2)}s.`);
        }
        return segment.sourceEnd - segment.sourceStart;
      })
    : sourceDurations.map((duration) => duration ?? 5);
  const voiceFile = voice ? assetAbsPath(voice.path) : null;
  const voiceDuration = voiceFile ? ffprobeDuration(voiceFile) : null;
  const visualDuration = durations.reduce((sum, duration) => sum + duration, 0);
  const targetDuration = voiceDuration ?? visualDuration;
  const delta = targetDuration - visualDuration;
  if (recipe.version === 2 && Math.abs(delta) > 0.25) {
    throw new Error(
      `La timeline dura ${visualDuration.toFixed(2)}s y la locución ${targetDuration.toFixed(2)}s ` +
      `(diferencia ${Math.abs(delta).toFixed(2)}s). Usa «Ajustar a locución» antes de renderizar.`,
    );
  }
  const padLast = recipe.version === 1 ? Math.max(0, targetDuration - visualDuration) : 0;

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
    const segment = recipe.version === 2 ? recipe.segments[index] : null;
    const trim = segment
      ? `trim=start=${segment.sourceStart.toFixed(3)}:end=${segment.sourceEnd.toFixed(3)},`
      : "";
    const padding = index === videoFiles.length - 1 && padLast > 0
      ? `,tpad=stop_mode=clone:stop_duration=${padLast.toFixed(2)}`
      : "";
    return `[${index}:v]${trim}scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,setsar=1,setpts=PTS-STARTPTS${padding}[v${index}]`;
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
