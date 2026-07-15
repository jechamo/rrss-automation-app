import { getEngine } from "@/core/ai";
import { getSettings } from "@/core/settings";
import type { Dossier } from "@/core/dossier/types";
import { coerceContent, type PieceContent, type Plataforma } from "./types";

// REQ-006 — Contenido propio de la app.
// (1) analyzeFunctions: la IA propone funcionalidades demostrables (con URL y pasos)
//     a partir del dossier (REQ-001) → el usuario elige/edita.
// (2) generateDemoGuion: genera un guion ORIGINAL que muestra la funcionalidad,
//     con cortes B-roll (fal.ai) para intercalar con el screencast real de la app.
// Apoyo de conocimiento: skill de proyecto `rrss-content-generation`.

export interface AppFuncion {
  nombre: string;
  descripcion: string;
  url: string; // ruta/URL concreta a navegar y grabar
  pasos: string[]; // pasos de navegacion para demostrarla
}

function str(v: unknown, def = ""): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : def;
}
function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [];
}

export function coerceFuncion(raw: unknown): AppFuncion {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    nombre: str(o.nombre),
    descripcion: str(o.descripcion),
    url: str(o.url),
    pasos: strArr(o.pasos),
  };
}

const SYSTEM_FUNCS = `Eres un estratega de producto y contenido. A partir del dossier de un producto
SaaS/appweb, propones que FUNCIONALIDADES concretas conviene mostrar en un video corto de redes
para demostrar su valor. Cada funcionalidad debe ser navegable en la propia app. Respondes SIEMPRE
en espanol y SOLO con JSON valido, sin markdown.`;

export async function analyzeFunctions(args: {
  dossier: Dossier;
  appUrl: string;
}): Promise<AppFuncion[]> {
  const { dossier, appUrl } = args;

  const prompt = `Propon entre 3 y 6 funcionalidades demostrables de nuestra app para grabar un video
corto que ensene su valor.

## Nuestra app (del dossier)
- Negocio: ${dossier.negocio}
- Propuesta de valor: ${dossier.propuestaValor}
- Publico objetivo: ${dossier.publicoObjetivo}
- Funcionalidades clave: ${dossier.funcionalidades.slice(0, 10).join(", ")}
- URL base: ${appUrl}

## Instruccion
Devuelve EXCLUSIVAMENTE un JSON con esta forma exacta:
{
  "funciones": [
    {
      "nombre": "nombre corto de la funcionalidad",
      "descripcion": "que resuelve y por que es demostrable en video",
      "url": "URL o ruta concreta a navegar para mostrarla (usa la URL base si no sabes la ruta exacta)",
      "pasos": ["paso 1 de navegacion", "paso 2", "paso 3"]
    }
  ]
}
Reglas: 3-6 funciones; prioriza las de mayor impacto visual; los pasos deben ser accionables. No incluyas nada fuera del JSON.`;

  const settings = getSettings();
  const engine = getEngine(settings.aiEngine);
  const result = await engine.run({
    system: SYSTEM_FUNCS,
    prompt,
    json: true,
    model: settings.aiModel,
    timeoutMs: 180000,
  });

  const data = (result.data ?? tryParse(result.text)) as { funciones?: unknown } | null;
  const list = Array.isArray(data?.funciones) ? data!.funciones : [];
  const funciones = list.map(coerceFuncion).filter((f) => f.nombre);
  if (funciones.length === 0) {
    throw new Error("El motor de IA no propuso funcionalidades. Revisa el motor en Ajustes.");
  }
  return funciones;
}

const SYSTEM_GUION = `Eres un guionista experto en contenido corto para redes sociales que muestra
producto (product-led). Creas guiones ORIGINALES que ensenan una funcionalidad real de una app,
combinando la grabacion de pantalla con cortes B-roll generados. Escribes hooks de 3 segundos,
estructura de retencion y CTAs claros. Respondes SIEMPRE en espanol y SOLO con JSON valido, sin markdown.`;

export async function generateDemoGuion(args: {
  dossier: Dossier;
  funcion: AppFuncion;
  plataforma: Plataforma;
}): Promise<PieceContent> {
  const { dossier, funcion, plataforma } = args;

  const prompt = `Crea un guion de video ORIGINAL que muestre esta funcionalidad de NUESTRA app.

## Nuestra marca (del dossier)
- Negocio: ${dossier.negocio}
- Propuesta de valor: ${dossier.propuestaValor}
- Tono/voz: ${dossier.marca.tono} · ${dossier.marca.voz}
- Publico objetivo: ${dossier.publicoObjetivo}
- CTAs habituales: ${dossier.ctas.slice(0, 4).join(", ")}

## Funcionalidad a mostrar
- Nombre: ${funcion.nombre}
- Descripcion: ${funcion.descripcion}
- Pasos en la app: ${funcion.pasos.join(" -> ")}

## Plataforma destino
${plataforma} (formato vertical corto salvo YouTube largo).

## Instruccion
El video intercala la GRABACION real de la pantalla (que se capta aparte) con CORTES B-roll
generados por IA de video. Devuelve EXCLUSIVAMENTE un JSON con esta forma exacta:
{
  "plataforma": "${plataforma}",
  "patronAplicado": "angulo/gancho product-led elegido para esta funcionalidad",
  "notaLegal": "Contenido propio que muestra nuestra app.",
  "guion": {
    "gancho": "hook original de ~3s",
    "desarrollo": "cuerpo del video mostrando la funcionalidad, con estructura de retencion",
    "cta": "llamada a la accion final",
    "locucion": "texto completo y natural para voz en off (lo que se oira)",
    "hashtags": ["#ejemplo"],
    "duracionTotal": 30
  },
  "escaleta": [
    { "n": 1, "descripcion": "que se ve (marca si es GRABACION de pantalla o CORTE b-roll)", "prompt": "prompt en INGLES para generar el corte b-roll con fal.ai (vacio si es grabacion de pantalla)", "texto": "texto en pantalla", "segundos": 3 }
  ]
}
Reglas: 4-8 planos; alterna grabacion de pantalla y cortes b-roll; los "prompt" de los cortes en
ingles, visuales y concretos; los planos de grabacion llevan prompt vacio. No incluyas nada fuera del JSON.`;

  const settings = getSettings();
  const engine = getEngine(settings.aiEngine);
  const result = await engine.run({
    system: SYSTEM_GUION,
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
