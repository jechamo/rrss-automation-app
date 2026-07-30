import { analyzeLocalVideoJson } from "@/core/media/gemini";

export async function analyzeClipSource(args: {
  absPath: string;
  duration: number;
  title: string;
}): Promise<unknown> {
  const prompt = `Actúa como editor sénior de TikTok/Reels especializado en retención, debate y
controversia editorial responsable. Analiza el vídeo COMPLETO (imagen, voz, silencios, cambios de
tono y contexto) y localiza únicamente momentos que puedan sostener un clip por sí mismos.

No cortes por cortar. Un momento válido necesita:
- hook comprensible en los primeros 1-3 segundos del corte;
- una idea, tensión o arco con cierre;
- suficiente contexto para no tergiversar al hablante;
- potencial real de comentarios, compartidos, guardados o desacuerdo;
- timecodes comprobables en el vídeo.

"Controversial" significa afirmación discutible, choque de posturas, tema tabú, contradicción,
confesión o conclusión contraintuitiva. No inventes polémica, no saques frases de contexto y marca
riesgo alto cuando el corte aislado pueda ser engañoso, difamatorio o afectar a una persona.

Duración real: ${args.duration.toFixed(2)} segundos.
Título/fuente: ${args.title}

Propón entre 12 y 30 candidatos SOLO si son sólidos. Duración objetivo 15-60 segundos; permite hasta
90 únicamente cuando sea imprescindible para completar el arco. Devuelve también una transcripción
temporal de 2-8 segundos por segmento que cubra todos los candidatos, para subtitularlos literalmente.
Los scores son 0-100 y confidence mide la seguridad de los timecodes y de la interpretación.

Devuelve SOLO JSON válido con esta forma:
{
  "summary": "tesis y dinámica general del vídeo",
  "language": "es",
  "transcript": [
    { "start": 12.4, "end": 16.8, "speaker": "Persona A", "text": "texto literal" }
  ],
  "moments": [
    {
      "id": "slug-corto",
      "title": "título editorial del clip",
      "start": 12.4,
      "end": 48.2,
      "viralScore": 0,
      "controversyScore": 0,
      "confidence": 0,
      "hook": "frase/imagen que detiene el scroll",
      "evidence": "cita literal breve que demuestra la selección",
      "whyViral": "señales concretas de retención y compartibilidad",
      "whyControversial": "qué postura o tensión generará debate",
      "context": "contexto mínimo que no debe perderse",
      "risk": "low|medium|high",
      "riskReason": "riesgo de interpretación al aislar el fragmento"
    }
  ]
}`;

  return analyzeLocalVideoJson(args.absPath, prompt);
}
