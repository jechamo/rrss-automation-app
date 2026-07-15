import type { Dossier } from "@/core/dossier/types";
import type { Viral } from "@/core/virales/types";
import { describeViral } from "@/core/media/gemini";
import type { MediaConfig } from "./types";

// Paso "extraer contenido" del viral fuente (REQ-005).
// Por defecto reusa lo ya capturado en REQ-004 (hook, estructura, patron
// transferible). Si config.usarGemini, ademas enriquece con Gemini (opcional).

export interface ViralExtract {
  fuenteUrl: string;
  plataforma: string;
  titulo: string;
  patronTransferible: string;
  hook: string;
  estructuraResumen: string;
  shareTrigger: string;
  porQueFunciona: string;
  notasGemini: string; // vacio si no se uso Gemini
}

function estructuraToText(v: Viral): string {
  if (!v.estructura?.length) return "";
  return v.estructura
    .map((b) => `${b.bloque} (${b.desde}-${b.hasta}s): ${b.nota}`)
    .join(" | ");
}

export async function extractViral(args: {
  viral: Viral;
  dossier: Dossier;
  config: MediaConfig;
  log?: (m: string) => void;
}): Promise<ViralExtract> {
  const { viral, config, log } = args;

  const base: ViralExtract = {
    fuenteUrl: viral.url,
    plataforma: viral.plataforma,
    titulo: viral.titulo,
    patronTransferible: viral.patronTransferible,
    hook: viral.hook?.texto ? `${viral.hook.tipo}: ${viral.hook.texto}` : viral.hook?.tipo ?? "",
    estructuraResumen: estructuraToText(viral),
    shareTrigger: viral.shareTrigger,
    porQueFunciona: viral.porQueFunciona,
    notasGemini: "",
  };

  if (config.usarGemini) {
    try {
      const contexto = [
        `titulo: ${viral.titulo}`,
        `hook: ${base.hook}`,
        `estructura: ${base.estructuraResumen}`,
        `porQueFunciona: ${viral.porQueFunciona}`,
        `patronTransferible: ${viral.patronTransferible}`,
      ].join(" | ");
      base.notasGemini = await describeViral(viral.url, contexto);
      log?.("Gemini enriquecio la comprension del viral fuente.");
    } catch (e) {
      // Gemini es opcional: si falla (sin key/red), se sigue con los datos de REQ-004.
      log?.(`Gemini no disponible (${(e as Error).message}). Se usan los datos de REQ-004.`);
    }
  }

  return base;
}
