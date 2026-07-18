import { getEngine } from "@/core/ai";
import { getSettings } from "@/core/settings";
import type { Dossier } from "@/core/dossier/types";
import type { ViralExtract } from "./extract";
import { coerceContent, type PieceContent, type Plataforma } from "./types";

// Paso "generar guion" de REQ-005: reinterpreta el patron transferible del viral
// en un guion ORIGINAL sobre la propia marca/producto (DA-04: concepto, no copia).
// Apoyo de conocimiento: skill de proyecto `rrss-content-generation` (auto-cargada).

const SYSTEM = `Eres un guionista experto en contenido corto para redes sociales. Reinterpretas el
CONCEPTO de un viral (su patron, no su contenido) para crear un guion ORIGINAL de otra marca.
NUNCA copias frases, imagenes ni la locucion del original: reescribes desde cero para el nuevo
nicho. Escribes hooks de 3 segundos, estructuras de retencion y CTAs claros. Respondes SIEMPRE en
espanol y SOLO con JSON valido, sin markdown.`;

export async function generateGuion(args: {
  dossier: Dossier;
  extract: ViralExtract;
  plataforma: Plataforma;
  clipCount?: number;
}): Promise<PieceContent> {
  const { dossier, extract, plataforma } = args;
  const clipCount = Math.min(6, Math.max(0, Math.round(args.clipCount ?? 4)));

  const prompt = `Crea un guion de video ORIGINAL para nuestra marca, reinterpretando el CONCEPTO de un
viral del nicho (no lo copies: aplica su patron a nuestro producto).

## Nuestra marca (del dossier)
- Negocio: ${dossier.negocio}
- Propuesta de valor: ${dossier.propuestaValor}
- Tono/voz: ${dossier.marca.tono} · ${dossier.marca.voz}
- Publico objetivo: ${dossier.publicoObjetivo}
- Funcionalidades clave: ${dossier.funcionalidades.slice(0, 6).join(", ")}
- CTAs habituales: ${dossier.ctas.slice(0, 4).join(", ")}

## Viral fuente (SOLO como referencia de patron; NO copiar)
- Plataforma: ${extract.plataforma}
- Patron transferible: ${extract.patronTransferible}
- Hook original (referencia de tipo, no de texto): ${extract.hook}
- Estructura: ${extract.estructuraResumen}
- Share trigger: ${extract.shareTrigger}
- Por que funciona: ${extract.porQueFunciona}
${extract.notasGemini ? `- Notas Gemini: ${extract.notasGemini}` : ""}

## Plataforma destino
${plataforma} (formato vertical corto salvo YouTube largo).

## Instruccion
Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma exacta:
{
  "plataforma": "${plataforma}",
  "patronAplicado": "que patron del viral reinterpretas y como lo adaptas a nuestra marca",
  "notaLegal": "Concepto reinterpretado para nuestra marca; no reproduce el video original.",
  "guion": {
    "gancho": "hook original de ~3s para nuestra marca",
    "desarrollo": "cuerpo del video, con la estructura de retencion",
    "cta": "llamada a la accion final",
    "locucion": "texto completo y natural para locucion/voz en off (lo que se oira)",
    "hashtags": ["#ejemplo"],
    "duracionTotal": 30
  },
  "escaleta": [
    { "n": 1, "descripcion": "que se ve en el plano", "prompt": "prompt en INGLES para generar este plano con IA de video (fal.ai)", "texto": "texto en pantalla del plano", "segundos": 3 }
  ]
}
Reglas: crea exactamente ${clipCount} planos en la escaleta${clipCount === 0 ? "; el usuario ha decidido no generar B-roll, devuelve una escaleta vacia" : "; cada plano corresponde a un corte fal.ai aprobado"}. Los "prompt" deben ser visuales, concretos y en ingles (para el
generador de video); nada de texto del original. No incluyas nada fuera del JSON.`;

  const settings = getSettings();
  const engine = getEngine(settings.aiEngine);
  const result = await engine.run({
    system: SYSTEM,
    prompt,
    json: true,
    model: settings.aiModel,
    timeoutMs: 180000,
  });

  const data = result.data ?? tryParse(result.text);
  if (!data) {
    throw new Error("El motor de IA no devolvio un JSON de guion valido. Revisa el motor en Ajustes.");
  }
  const content = coerceContent(data);
  content.plataforma = plataforma;
  return content;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
