import { analyzeLocalVideoJson } from "@/core/media/gemini";
import {
  applyImportedAlignment,
  type ClipSelection,
} from "./contracts";

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
