import path from "node:path";
import { hasSecret } from "@/core/secrets/vault";
import { hasFfmpeg, hasFfprobe, ffprobeDuration } from "@/core/media/ffmpeg";
import { downloadVideoTo, hasYtDlp } from "@/core/media/ytdlp";
import { analyzeClipSource } from "./analyze";
import { alignImportedClipSelection } from "./align";
import {
  applyDirectImportedTranscript,
  selectClipMoments,
  selectionFromImportedPlan,
  type ClipSelection,
} from "./contracts";
import { renderClipMoment } from "./render";
import {
  appendClipLog,
  clipAssetPath,
  clipJobDir,
  readClipJob,
  updateClipJob,
} from "./storage";

const running = new Set<string>();

export function startClipProcessing(id: string): boolean {
  if (running.has(id)) return false;
  running.add(id);
  void processClipJob(id).finally(() => running.delete(id));
  return true;
}

export function isClipProcessing(id: string): boolean {
  return running.has(id);
}

export function clipToolsStatus(sourceType: "upload" | "youtube") {
  return {
    gemini: hasSecret("gemini"),
    ffmpeg: hasFfmpeg(),
    ffprobe: hasFfprobe(),
    ytdlp: sourceType === "youtube" ? hasYtDlp() : true,
  };
}

async function processClipJob(id: string): Promise<void> {
  try {
    const initial = readClipJob(id);
    const tools = clipToolsStatus(initial.sourceType);
    const needsGemini = (initial.selectionMode ?? "ai") === "ai"
      || initial.jsonTiming === "gemini";
    const missing = [
      needsGemini && !tools.gemini ? "Gemini en Ajustes" : "",
      !tools.ffmpeg ? "FFmpeg" : "",
      !tools.ffprobe ? "ffprobe" : "",
      !tools.ytdlp ? "yt-dlp" : "",
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new Error(`Faltan herramientas obligatorias: ${missing.join(", ")}.`);
    }

    updateClipJob(id, {
      status: "processing",
      stage: "source",
      progress: 8,
      error: undefined,
      selection: undefined,
      logs: ["Validando la fuente y preparando el vídeo…"],
    });

    let sourceFile = initial.sourceFile;
    if (initial.sourceType === "youtube" && !sourceFile) {
      appendClipLog(id, "Descargando el vídeo público de YouTube con yt-dlp…");
      const downloaded = await downloadVideoTo(initial.sourceUrl!, clipJobDir(id));
      sourceFile = path.basename(downloaded);
      updateClipJob(id, { sourceFile, progress: 18 });
    }
    if (!sourceFile) throw new Error("El trabajo no contiene un vídeo fuente.");
    const sourcePath = clipAssetPath(id, sourceFile);
    const duration = ffprobeDuration(sourcePath);
    if (!duration || duration < 15) {
      throw new Error("El vídeo debe durar al menos 15 segundos y ser legible por ffprobe.");
    }
    if (duration > 4 * 60 * 60) {
      throw new Error("El vídeo supera el máximo operativo de 4 horas.");
    }
    updateClipJob(id, { duration, stage: "understanding", progress: 24 });
    let selection: ClipSelection;
    if ((initial.selectionMode ?? "ai") === "json") {
      if (!initial.importedPlan) throw new Error("El trabajo no conserva el JSON editorial importado.");
      selection = selectionFromImportedPlan(initial.importedPlan, duration);
      updateClipJob(id, { selection, progress: 34 });
      if (initial.jsonTiming === "gemini") {
        appendClipLog(
          id,
          `Fuente validada: ${formatDuration(duration)}. Se respetan ${selection.moments.length} corte(s) del JSON; verificando texto y sincronía contra el audio…`,
        );
        selection = await alignImportedClipSelection(sourcePath, selection);
        appendClipLog(
          id,
          "Sincronía validada. Gemini no ha modificado cortes ni rankings; solo ha temporizado la transcripción literal.",
        );
      } else {
        appendClipLog(
          id,
          `Fuente validada: ${formatDuration(duration)}. Modo directo sin Gemini: se respetan ${selection.moments.length} corte(s) y el texto se temporiza localmente.`,
        );
        selection = applyDirectImportedTranscript(selection);
        appendClipLog(
          id,
          "JSON validado sin consumo de IA. La sincronía depende de los timecodes y la transcripción aportados.",
        );
      }
      updateClipJob(id, { selection, stage: "selection", progress: 52 });
    } else {
      appendClipLog(id, `Fuente validada: ${formatDuration(duration)}. Analizando imagen y audio…`);
      const raw = await analyzeClipSource({
        absPath: sourcePath,
        duration,
        title: initial.title,
      });
      updateClipJob(id, { stage: "selection", progress: 52 });
      appendClipLog(id, "Análisis temporal recibido. Validando calidad, contexto y solapamientos…");
      selection = selectClipMoments(raw, duration);
      if (selection.topViral.length === 0 && selection.topControversial.length === 0) {
        throw new Error(
          "El vídeo no contiene momentos que superen los umbrales de calidad y confianza. No se generaron cortes de relleno.",
        );
      }
    }
    updateClipJob(id, { selection, stage: "rendering", progress: 60 });
    appendClipLog(
      id,
      `Selección sólida: ${selection.topViral.length} viral(es), ${selection.topControversial.length} polémico(s), ${selection.rejectedCount} descartado(s).`,
    );

    const renderIds = [...new Set([...selection.topViral, ...selection.topControversial])];
    for (let index = 0; index < renderIds.length; index++) {
      const momentId = renderIds[index];
      const moment = selection.moments.find((candidate) => candidate.id === momentId);
      if (!moment) continue;
      appendClipLog(id, `Render ${index + 1}/${renderIds.length}: ${moment.title}`);
      try {
        const rendered = await renderClipMoment({
          sourcePath,
          outputDir: clipJobDir(id),
          selection,
          moment,
        });
        selection = patchMoment(selection, momentId, rendered);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        selection = patchMoment(selection, momentId, {
          renderError: message,
        });
        appendClipLog(id, `No se pudo renderizar «${moment.title}»: ${message}`);
      }
      updateClipJob(id, {
        selection,
        progress: Math.round(60 + ((index + 1) / renderIds.length) * 36),
      });
    }

    const successful = new Set(
      selection.moments.filter((moment) => moment.outputName).map((moment) => moment.id),
    );
    selection = {
      ...selection,
      topViral: selection.topViral.filter((momentId) => successful.has(momentId)),
      topControversial: selection.topControversial.filter((momentId) => successful.has(momentId)),
    };
    if (successful.size === 0) {
      throw new Error("FFmpeg no pudo generar ninguno de los cortes seleccionados.");
    }
    const failedCount = renderIds.length - successful.size;

    updateClipJob(id, {
      status: "ready",
      stage: "results",
      progress: 100,
      selection,
      error: undefined,
    });
    appendClipLog(
      id,
      failedCount > 0
        ? `${successful.size} clip(s) listos; ${failedCount} fallaron y se detallan en el registro.`
        : `${successful.size} clip(s) vertical(es) listos con subtítulos.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      updateClipJob(id, { status: "error", error: message });
      appendClipLog(id, `Error: ${message}`);
    } catch {
      // Si el manifiesto desaparece durante el proceso (eliminación del usuario), no se recrea.
    }
  }
}

function patchMoment(
  selection: ClipSelection,
  id: string,
  patch: Partial<ClipSelection["moments"][number]>,
): ClipSelection {
  return {
    ...selection,
    moments: selection.moments.map((moment) => moment.id === id ? { ...moment, ...patch } : moment),
  };
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
