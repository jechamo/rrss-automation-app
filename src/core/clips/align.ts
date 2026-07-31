import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { analyzeLocalVideoJson } from "@/core/media/gemini";
import { systemToolPath } from "@/core/media/bintools";
import {
  applyImportedAlignment,
  type ClipMoment,
  type ClipSelection,
  type TranscriptCue,
} from "./contracts";

const execFileAsync = promisify(execFile);

export async function alignImportedClipSelection(
  absPath: string,
  selection: ClipSelection,
): Promise<ClipSelection> {
  const intervals = selection.moments.map((moment) => ({
    id: moment.id,
    start: moment.start,
    end: moment.end,
    suppliedTranscript: moment.sourceTranscript,
  }));
  const prompt = `Actúa únicamente como alineador profesional de subtítulos.

El usuario ya ha elegido los cortes, sus intervalos y sus rankings. NO propongas otros momentos,
NO cambies start/end y NO puntúes viralidad ni controversia. Escucha el audio dentro de cada
intervalo y comprueba si suppliedTranscript corresponde realmente a lo que se oye.

Para cada intervalo:
- devuelve el texto literal corregido, sin resumir ni suavizar lenguaje;
- divide el habla en cues de 2 a 7 palabras, normalmente de 1 a 4 segundos;
- usa timestamps ABSOLUTOS del vídeo y mantenlos estrictamente dentro de start/end;
- deja pequeñas pausas naturales cuando no habla nadie;
- match es 0-100: coincidencia semántica y temporal entre el texto suministrado y el audio;
- si el texto pertenece a otro momento, baja match aunque el tema sea parecido.

Intervalos:
${JSON.stringify(intervals)}

Devuelve SOLO JSON válido:
{
  "alignments": [
    {
      "id": "id exacto recibido",
      "match": 0,
      "correctedTranscript": "texto literal completo oído en el intervalo",
      "cues": [
        { "start": 12.3, "end": 15.1, "speaker": "Persona A", "text": "frase literal breve" }
      ]
    }
  ]
}`;

  const raw = await analyzeLocalVideoJson(absPath, prompt);
  return applyImportedAlignment(selection, raw);
}

export async function alignSingleClipMoment(
  sourcePath: string,
  outputDir: string,
  selection: ClipSelection,
  moment: ClipMoment,
): Promise<{ moment: ClipMoment; cues: TranscriptCue[] }> {
  const ffmpeg = systemToolPath("ffmpeg");
  if (!ffmpeg) throw new Error("FFmpeg no está disponible para preparar el corte de Gemini.");
  const safeId = moment.id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const snippetName = `gemini-${safeId}-${crypto.randomUUID().slice(0, 8)}.mp4`;
  const snippetPath = path.join(outputDir, snippetName);
  try {
    await execFileAsync(
      ffmpeg,
      [
        "-y",
        "-ss", moment.start.toFixed(3),
        "-t", moment.duration.toFixed(3),
        "-i", path.basename(sourcePath),
        "-vf", "scale=-2:480",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "28",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        snippetName,
      ],
      {
        cwd: outputDir,
        timeout: 8 * 60_000,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      },
    );
    const suppliedTranscript = moment.sourceTranscript
      || moment.alignedTranscript
      || moment.evidence;
    const localMoment: ClipMoment = {
      ...moment,
      start: 0,
      end: moment.duration,
      sourceTranscript: suppliedTranscript,
      subtitleSource: undefined,
      outputName: undefined,
      thumbnailName: undefined,
      renderError: undefined,
    };
    const localSelection: ClipSelection = {
      ...selection,
      transcript: [],
      moments: [localMoment],
      topViral: [moment.id],
      topControversial: [],
    };
    const aligned = await alignImportedClipSelection(snippetPath, localSelection);
    const alignedMoment = aligned.moments[0];
    const cues = aligned.transcript.map((cue) => ({
      ...cue,
      start: cue.start + moment.start,
      end: cue.end + moment.start,
      momentId: moment.id,
    }));
    return {
      moment: {
        ...moment,
        subtitleSource: "gemini",
        alignedTranscript: alignedMoment.alignedTranscript,
        alignmentScore: alignedMoment.alignmentScore,
        evidence: alignedMoment.evidence,
        renderError: undefined,
      },
      cues,
    };
  } finally {
    fs.rmSync(snippetPath, { force: true });
  }
}
