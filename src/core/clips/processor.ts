import fs from "node:fs";
import path from "node:path";
import { hasSecret } from "@/core/secrets/vault";
import { hasFfmpeg, hasFfprobe, ffprobeDuration } from "@/core/media/ffmpeg";
import { downloadVideoTo, hasYtDlp } from "@/core/media/ytdlp";
import { analyzeClipSource } from "./analyze";
import { alignImportedClipSelection, alignSingleClipMoment } from "./align";
import {
  applyDirectImportedTranscript,
  selectClipMoments,
  selectionFromImportedPlan,
  type ClipSubtitleMode,
  type ClipJob,
  type ClipSelection,
  type TranscriptCue,
} from "./contracts";
import { renderClipMoment } from "./render";
import { hasLocalWhisper } from "./local-transcription";
import { applyYouTubeCaptions, loadYouTubeCaptions } from "./youtube-captions";
import {
  appendClipLog,
  clipAssetPath,
  clipJobDir,
  readClipJob,
  updateClipJob,
} from "./storage";
import { isMockE2E } from "@/core/runtime/e2e-profile";
import { simulateMockProvider } from "@/core/testing/mock-runtime";

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

export function recoverInterruptedClipJob(job: ClipJob): ClipJob {
  const inactiveForMs = Date.now() - new Date(job.updatedAt).getTime();
  if (
    (job.status === "pending" || job.status === "processing")
    && !isClipProcessing(job.id)
    && inactiveForMs > 30_000
  ) {
    return updateClipJob(job.id, {
      status: "error",
      error: "El proceso se interrumpió al cerrar o recompilar la app. Continúa solo los clips pendientes o reinicia desde cero.",
      activeOperation: undefined,
    });
  }
  return job;
}

export function startClipMomentRendering(
  id: string,
  momentId: string,
  subtitleMode: ClipSubtitleMode,
): boolean {
  if (running.has(id)) return false;
  running.add(id);
  void processSingleClipMoment(id, momentId, subtitleMode)
    .finally(() => running.delete(id));
  return true;
}

export function startClipResume(id: string): boolean {
  if (running.has(id)) return false;
  running.add(id);
  void processPendingClipMoments(id).finally(() => running.delete(id));
  return true;
}

export function clipToolsStatus(sourceType: "upload" | "youtube") {
  if (isMockE2E()) {
    return { gemini: true, ffmpeg: true, ffprobe: true, ytdlp: true, whisper: true };
  }
  return {
    gemini: hasSecret("gemini"),
    ffmpeg: hasFfmpeg(),
    ffprobe: hasFfprobe(),
    ytdlp: sourceType === "youtube" ? hasYtDlp() : true,
    whisper: hasLocalWhisper(),
  };
}

async function processClipJob(id: string): Promise<void> {
  try {
    if (isMockE2E()) {
      await processMockClipJob(id);
      return;
    }
    const initial = readClipJob(id);
    const tools = clipToolsStatus(initial.sourceType);
    const needsGemini = (initial.selectionMode ?? "ai") === "ai"
      || initial.jsonTiming === "gemini";
    const missing = [
      needsGemini && !tools.gemini ? "Gemini en Ajustes" : "",
      !tools.ffmpeg ? "FFmpeg" : "",
      !tools.ffprobe ? "ffprobe" : "",
      !tools.ytdlp ? "yt-dlp" : "",
      !tools.whisper ? "Whisper local" : "",
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new Error(`Faltan herramientas obligatorias: ${missing.join(", ")}.`);
    }

    updateClipJob(id, {
      status: "processing",
      stage: "source",
      progress: 8,
      error: undefined,
      activeOperation: { kind: "full", label: "Generación completa" },
      outputsDeletedAt: undefined,
      selection: undefined,
      logs: ["Validando la fuente y preparando el vídeo…"],
    });

    let sourceFile = initial.sourceFile;
    if (initial.sourceType === "youtube" && !sourceFile) {
      appendClipLog(
        id,
        "Descargando YouTube con calidad adaptable hasta 720p; si el vídeo es muy largo se reduce automáticamente para completar la fuente…",
      );
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
    let youtubeCaptions: TranscriptCue[] = [];
    if (initial.sourceType === "youtube" && initial.sourceUrl) {
      try {
        youtubeCaptions = await loadYouTubeCaptions(initial.sourceUrl, clipJobDir(id));
        appendClipLog(
          id,
          youtubeCaptions.length > 0
            ? `YouTube ofrece CC utilizables (${youtubeCaptions.length} cue(s)); tendrán prioridad sin coste.`
            : "YouTube no ofrece CC utilizables; los cortes se subtitularán con Whisper local.",
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        appendClipLog(
          id,
          `No se pudieron recuperar los CC de YouTube (${reason}); los cortes se subtitularán con Whisper local.`,
        );
      }
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
        const synchronizedCount = selection.moments.filter(
          (moment) => moment.sourceCues?.length,
        ).length;
        appendClipLog(
          id,
          `Fuente validada: ${formatDuration(duration)}. Modo directo sin Gemini: se respetan `
          + `${selection.moments.length} corte(s); ${synchronizedCount} incluyen subtítulos sincronizados en el JSON.`,
        );
        selection = applyDirectImportedTranscript(selection);
        appendClipLog(
          id,
          synchronizedCount === selection.moments.length
            ? "JSON validado sin consumo de IA. Se usarán exactamente los cues y timecodes de subtítulos aportados."
            : "JSON validado sin consumo de IA. Los cortes sin subtitulos_sincronizados se transcribirán desde su audio exacto con Whisper local.",
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
    if (youtubeCaptions.length > 0) {
      selection = applyYouTubeCaptions(selection, youtubeCaptions);
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
        selection = patchMoment(selection, momentId, { ...rendered, renderError: undefined });
        appendClipLog(
          id,
          rendered.subtitleSource === "local_whisper"
            ? "Subtítulos generados desde el audio exacto del corte con Whisper local (0 créditos)."
            : rendered.subtitleSource === "youtube_cc"
              ? "Subtítulos sincronizados desde CC de YouTube (0 créditos)."
              : rendered.subtitleSource === "synced_json"
                ? "Subtítulos sincronizados desde el JSON (0 créditos)."
                : "Subtítulos verificados previamente con Gemini.",
        );
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
      activeOperation: undefined,
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
      updateClipJob(id, { status: "error", error: message, activeOperation: undefined });
      appendClipLog(id, `Error: ${message}`);
    } catch {
      // Si el manifiesto desaparece durante el proceso (eliminación del usuario), no se recrea.
    }
  }
}

async function processPendingClipMoments(id: string): Promise<void> {
  try {
    if (isMockE2E()) {
      const job = readClipJob(id);
      if (!job.selection || !job.sourceFile) {
        throw new Error("Este historial no conserva una selección y una fuente que se puedan reanudar.");
      }
      updateClipJob(id, {
        status: "ready",
        stage: "results",
        progress: 100,
        activeOperation: undefined,
      });
      appendClipLog(id, "No había clips pendientes: los resultados fixture se conservaron sin regenerar.");
      return;
    }
    const job = readClipJob(id);
    if (!job.selection || !job.sourceFile) {
      throw new Error("Este historial no conserva una selección y una fuente que se puedan reanudar.");
    }
    const tools = clipToolsStatus(job.sourceType);
    const missing = [
      !tools.ffmpeg ? "FFmpeg" : "",
      !tools.ffprobe ? "ffprobe" : "",
      !tools.whisper ? "Whisper local" : "",
      job.sourceType === "youtube" && !tools.ytdlp ? "yt-dlp" : "",
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new Error(`Faltan herramientas obligatorias: ${missing.join(", ")}.`);
    }
    const sourcePath = clipAssetPath(id, job.sourceFile);
    const sourceDuration = ffprobeDuration(sourcePath);
    if (!sourceDuration || sourceDuration < 15) {
      throw new Error("La fuente conservada ya no es legible por ffprobe.");
    }

    let selection = clearInvalidOutputReferences(id, job.selection);
    const renderIds = expectedRenderIds(selection);
    let pendingIds = renderIds.filter((momentId) => !hasUsableMomentOutput(id, selection, momentId));
    if (pendingIds.length === 0) {
      updateClipJob(id, {
        status: "ready",
        stage: "results",
        progress: 100,
        selection,
        error: undefined,
        activeOperation: undefined,
      });
      appendClipLog(id, "No había clips pendientes: todos los resultados conservados son utilizables.");
      return;
    }

    const completedBefore = renderIds.length - pendingIds.length;
    updateClipJob(id, {
      status: "processing",
      stage: "rendering",
      progress: Math.round(60 + (completedBefore / Math.max(1, renderIds.length)) * 36),
      selection,
      error: undefined,
      activeOperation: {
        kind: "full",
        label: `Continuando ${pendingIds.length} clip(s) pendiente(s)`,
      },
    });
    appendClipLog(
      id,
      `Reanudación: ${completedBefore} clip(s) válidos se conservan y solo se procesarán ${pendingIds.length} pendiente(s).`,
    );

    if (job.sourceType === "youtube" && job.sourceUrl) {
      try {
        const captions = await loadYouTubeCaptions(job.sourceUrl, clipJobDir(id));
        if (captions.length > 0) {
          selection = applyCaptionsOnlyToMoments(selection, captions, new Set(pendingIds));
          appendClipLog(
            id,
            `CC de YouTube recuperados (${captions.length} cue(s)) para los clips pendientes; no se usa Gemini.`,
          );
        } else {
          appendClipLog(id, "YouTube no devolvió CC utilizables; los pendientes usarán Whisper local.");
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        appendClipLog(id, `No se pudieron recuperar los CC (${reason}); los pendientes usarán Whisper local.`);
      }
    }

    for (let index = 0; index < pendingIds.length; index++) {
      const momentId = pendingIds[index];
      const moment = selection.moments.find((candidate) => candidate.id === momentId);
      if (!moment) continue;
      appendClipLog(id, `Continuando ${index + 1}/${pendingIds.length}: ${moment.title}`);
      try {
        const rendered = await renderClipMoment({
          sourcePath,
          outputDir: clipJobDir(id),
          selection,
          moment,
        });
        selection = patchMoment(selection, momentId, { ...rendered, renderError: undefined });
        appendClipLog(id, `Clip pendiente completado con ${subtitleSourceLabel(rendered.subtitleSource)}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        selection = patchMoment(selection, momentId, { renderError: message });
        appendClipLog(id, `El clip pendiente «${moment.title}» sigue sin completarse: ${message}`);
      }
      const completedNow = renderIds.filter((candidateId) =>
        hasUsableMomentOutput(id, selection, candidateId)
      ).length;
      updateClipJob(id, {
        selection,
        progress: Math.round(60 + (completedNow / Math.max(1, renderIds.length)) * 36),
      });
    }

    selection = clearInvalidOutputReferences(id, selection);
    pendingIds = renderIds.filter((momentId) => !hasUsableMomentOutput(id, selection, momentId));
    const successful = renderIds.length - pendingIds.length;
    if (successful === 0) {
      throw new Error("No se pudo completar ningún clip pendiente.");
    }
    updateClipJob(id, {
      status: "ready",
      stage: "results",
      progress: 100,
      selection,
      error: undefined,
      outputsDeletedAt: undefined,
      activeOperation: undefined,
    });
    appendClipLog(
      id,
      pendingIds.length > 0
        ? `Reanudación terminada: ${successful}/${renderIds.length} clip(s) listos; ${pendingIds.length} siguen pendientes y pueden reintentarse.`
        : `Reanudación terminada: ${successful}/${renderIds.length} clip(s) listos sin repetir los anteriores.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      updateClipJob(id, { status: "error", error: message, activeOperation: undefined });
      appendClipLog(id, `No se pudo continuar el trabajo: ${message}`);
    } catch {
      // El historial pudo eliminarse mientras se reanudaba.
    }
  }
}

async function processMockClipJob(id: string): Promise<void> {
  let initial = readClipJob(id);
  if (initial.sourceType === "youtube" && !initial.sourceFile) {
    const downloaded = await downloadVideoTo(initial.sourceUrl!, clipJobDir(id));
    initial = updateClipJob(id, { sourceFile: path.basename(downloaded) });
  }
  if (!initial.sourceFile) throw new Error("El trabajo no contiene un vídeo fixture.");
  updateClipJob(id, {
    status: "processing",
    stage: "understanding",
    progress: 28,
    activeOperation: { kind: "full", label: "Análisis simulado local" },
  });
  appendClipLog(id, "Gemini simulado: pending.");
  await simulateMockProvider("gemini");
  await simulateMockProvider("clips");

  const outputName = "clip-fixture.mp4";
  const thumbnailName = "clip-fixture.png";
  const subtitleName = "subs-fixture.ass";
  fs.writeFileSync(
    clipAssetPath(id, outputName),
    Buffer.from("000000186674797069736f6d0000020069736f6d69736f32525253532d453245", "hex"),
  );
  fs.writeFileSync(
    clipAssetPath(id, thumbnailName),
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  );
  fs.writeFileSync(
    clipAssetPath(id, subtitleName),
    "[Script Info]\nScriptType: v4.00+\n[Events]\nDialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Resultado fixture sincronizado\n",
    "utf8",
  );
  const selection: ClipSelection = {
    source: initial.selectionMode ?? "ai",
    summary: "Selección multimodal simulada y determinista.",
    language: "es",
    transcript: [{ start: 1, end: 4, text: "Resultado fixture sincronizado", momentId: "fixture-viral" }],
    moments: [{
      id: "fixture-viral",
      title: "Momento viral fixture",
      start: 1,
      end: 7,
      duration: 6,
      viralScore: 91,
      controversyScore: 68,
      confidence: 95,
      hook: "Resultado antes del proceso",
      evidence: "Fixture local",
      whyViral: "Promesa concreta",
      whyControversial: "Contrasta el proceso manual",
      context: "Prueba E2E sin proveedor real",
      risk: "low",
      riskReason: "Contenido sintético",
      subtitleSource: "synced_json",
      sourceCues: [{ start: 1, end: 4, text: "Resultado fixture sincronizado", momentId: "fixture-viral" }],
      outputName,
      thumbnailName,
    }],
    topViral: ["fixture-viral"],
    topControversial: ["fixture-viral"],
    rejectedCount: 1,
  };
  updateClipJob(id, {
    status: "ready",
    stage: "results",
    progress: 100,
    duration: 30,
    selection,
    error: undefined,
    activeOperation: undefined,
  });
  appendClipLog(id, `1 clip vertical fixture listo con subtítulos (${subtitleName}).`);
}

async function processSingleClipMoment(
  id: string,
  momentId: string,
  subtitleMode: ClipSubtitleMode,
): Promise<void> {
  const sourceLabel = subtitleMode === "youtube_cc"
    ? "CC de YouTube"
    : subtitleMode === "local_whisper"
      ? "Whisper local"
      : "Gemini";
  try {
    const job = readClipJob(id);
    if (!job.selection || !job.sourceFile) {
      throw new Error("El trabajo no conserva selección y fuente suficientes para regenerar el clip.");
    }
    const originalMoment = job.selection.moments.find((moment) => moment.id === momentId);
    if (!originalMoment) throw new Error("El clip seleccionado ya no existe en este historial.");
    const sourcePath = clipAssetPath(id, job.sourceFile);
    updateClipJob(id, {
      status: "processing",
      stage: "rendering",
      progress: 78,
      error: undefined,
      activeOperation: {
        kind: "moment",
        momentId,
        label: `Regenerando un clip con ${sourceLabel}`,
      },
    });
    appendClipLog(id, `Regeneración individual de «${originalMoment.title}» con ${sourceLabel}…`);

    let selection = withoutMomentTranscript(job.selection, momentId);
    if (subtitleMode === "youtube_cc") {
      if (job.sourceType !== "youtube" || !job.sourceUrl) {
        throw new Error("Los CC solo están disponibles para una fuente de YouTube.");
      }
      const captions = await loadYouTubeCaptions(job.sourceUrl, clipJobDir(id));
      if (captions.length === 0) {
        throw new Error("YouTube no devolvió una pista CC utilizable para este vídeo.");
      }
      const target = selection.moments.find((moment) => moment.id === momentId)!;
      const ccSelection = applyYouTubeCaptions(
        {
          ...selection,
          transcript: [],
          moments: [target],
          topViral: [momentId],
          topControversial: [],
        },
        captions,
      );
      const ccMoment = ccSelection.moments[0];
      if (ccMoment?.subtitleSource !== "youtube_cc") {
        throw new Error("La pista CC no contiene texto dentro del intervalo de este clip.");
      }
      selection = {
        ...selection,
        transcript: [
          ...selection.transcript.filter((cue) => cue.momentId !== momentId),
          ...ccSelection.transcript,
        ].sort((a, b) => a.start - b.start || a.end - b.end),
        moments: selection.moments.map((moment) =>
          moment.id === momentId ? ccMoment : moment
        ),
      };
    } else if (subtitleMode === "gemini") {
      if (!hasSecret("gemini")) throw new Error("Configura Gemini en Ajustes para usar esta opción.");
      const target = selection.moments.find((moment) => moment.id === momentId)!;
      const aligned = await alignSingleClipMoment(
        sourcePath,
        clipJobDir(id),
        selection,
        target,
      );
      selection = {
        ...selection,
        transcript: [
          ...selection.transcript.filter((cue) => cue.momentId !== momentId),
          ...aligned.cues,
        ].sort((a, b) => a.start - b.start || a.end - b.end),
        moments: selection.moments.map((moment) =>
          moment.id === momentId ? aligned.moment : moment
        ),
      };
    } else if (!hasLocalWhisper()) {
      throw new Error("Whisper local no está preparado. Revísalo en Ajustes.");
    }

    const target = selection.moments.find((moment) => moment.id === momentId)!;
    const rendered = await renderClipMoment({
      sourcePath,
      outputDir: clipJobDir(id),
      selection,
      moment: target,
    });
    selection = patchMoment(selection, momentId, { ...rendered, renderError: undefined });
    updateClipJob(id, {
      status: "ready",
      stage: "results",
      progress: 100,
      selection,
      error: undefined,
      outputsDeletedAt: undefined,
      activeOperation: undefined,
    });
    appendClipLog(
      id,
      `Clip «${originalMoment.title}» regenerado únicamente con ${sourceLabel}; los demás vídeos no cambiaron.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      const current = readClipJob(id);
      const selection = current.selection
        ? patchMoment(current.selection, momentId, { renderError: message })
        : current.selection;
      updateClipJob(id, {
        status: current.selection ? "ready" : "error",
        stage: current.selection ? "results" : current.stage,
        progress: current.selection ? 100 : current.progress,
        selection,
        error: current.selection ? undefined : message,
        activeOperation: undefined,
      });
      appendClipLog(
        id,
        `No se pudo regenerar el clip con ${sourceLabel}: ${message}. Se conserva el último MP4 correcto.`,
      );
    } catch {
      // El trabajo pudo eliminarse mientras se preparaba la operación.
    }
  }
}

function withoutMomentTranscript(selection: ClipSelection, momentId: string): ClipSelection {
  return {
    ...selection,
    transcript: selection.transcript.filter((cue) => cue.momentId !== momentId),
    moments: selection.moments.map((moment) => moment.id === momentId
      ? {
          ...moment,
          subtitleSource: undefined,
          alignedTranscript: undefined,
          alignmentScore: undefined,
          renderError: undefined,
        }
      : moment),
  };
}

function applyCaptionsOnlyToMoments(
  selection: ClipSelection,
  captions: TranscriptCue[],
  momentIds: Set<string>,
): ClipSelection {
  const scoped = applyYouTubeCaptions(
    {
      ...selection,
      transcript: [],
      moments: selection.moments.filter((moment) => momentIds.has(moment.id)),
      topViral: selection.topViral.filter((id) => momentIds.has(id)),
      topControversial: selection.topControversial.filter((id) => momentIds.has(id)),
    },
    captions,
  );
  const scopedMoments = new Map(scoped.moments.map((moment) => [moment.id, moment]));
  return {
    ...selection,
    transcript: [
      ...selection.transcript.filter((cue) => !cue.momentId || !momentIds.has(cue.momentId)),
      ...scoped.transcript,
    ].sort((a, b) => a.start - b.start || a.end - b.end),
    moments: selection.moments.map((moment) => scopedMoments.get(moment.id) ?? moment),
  };
}

function clearInvalidOutputReferences(id: string, selection: ClipSelection): ClipSelection {
  return {
    ...selection,
    moments: selection.moments.map((moment) => {
      if (!moment.outputName || isUsableOutputFile(id, moment.outputName)) return moment;
      return {
        ...moment,
        outputName: undefined,
        thumbnailName: undefined,
        renderError: "El render anterior quedó incompleto o ya no existe; se volverá a generar.",
      };
    }),
  };
}

function expectedRenderIds(selection: ClipSelection): string[] {
  return [...new Set([
    ...selection.topViral,
    ...selection.topControversial,
    ...selection.moments.filter((moment) => moment.renderError).map((moment) => moment.id),
  ])];
}

function hasUsableMomentOutput(
  id: string,
  selection: ClipSelection,
  momentId: string,
): boolean {
  const outputName = selection.moments.find((moment) => moment.id === momentId)?.outputName;
  return Boolean(outputName && isUsableOutputFile(id, outputName));
}

function isUsableOutputFile(id: string, outputName: string): boolean {
  try {
    const file = clipAssetPath(id, outputName);
    return fs.existsSync(file)
      && fs.statSync(file).isFile()
      && fs.statSync(file).size > 16 * 1024
      && Boolean(ffprobeDuration(file));
  } catch {
    return false;
  }
}

function subtitleSourceLabel(source: NonNullable<ClipSelection["moments"][number]["subtitleSource"]>): string {
  return source === "youtube_cc"
    ? "CC de YouTube"
    : source === "local_whisper"
      ? "Whisper local"
      : source === "synced_json"
        ? "subtítulos del JSON"
        : "Gemini";
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
