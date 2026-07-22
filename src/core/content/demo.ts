import fs from "node:fs";
import path from "node:path";
import { getEngine } from "@/core/ai";
import { getSettings } from "@/core/settings";
import type { Dossier } from "@/core/dossier/types";
import {
  coerceContent,
  coerceNavStep,
  type NavStep,
  type PieceContent,
  type Plataforma,
} from "./types";
import { flattenNavigation, type NavigationMap } from "@/core/navigation/types";

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
  navSteps?: NavStep[]; // acciones Playwright con selectores comprobados en el repo
  evidencias?: string[]; // fichero:linea que sustenta el recorrido propuesto
  confianza?: "alta" | "media" | "baja";
  navValidated?: boolean; // confirmado contra el DOM real en un dry-run
  navValidationLogs?: string[];
}

function str(v: unknown, def = ""): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : def;
}
function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [];
}

export function coerceFuncion(raw: unknown): AppFuncion {
  const o = (raw ?? {}) as Record<string, unknown>;
  const funcion: AppFuncion = {
    nombre: str(o.nombre),
    descripcion: str(o.descripcion),
    url: str(o.url),
    pasos: strArr(o.pasos),
  };
  const evidencias = strArr(o.evidencias);
  if (evidencias.length > 0) funcion.evidencias = evidencias;
  const confianza = str(o.confianza).toLowerCase();
  if (confianza === "alta" || confianza === "media" || confianza === "baja") {
    funcion.confianza = confianza;
  }
  const navSteps = (
    Array.isArray(o.navSteps ?? o.nav_steps) ? (o.navSteps ?? o.nav_steps) : []
  ) as unknown[];
  const coerced = navSteps
    .map(coerceNavStep)
    .filter((step): step is NavStep => step !== null);
  if (coerced.length > 0) funcion.navSteps = coerced;
  return funcion;
}

const REPO_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte", ".html"]);
const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".nuxt",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "vendor",
]);
const NAV_EVIDENCE =
  /data-(?:testid|tutorial)\s*=|placeholder\s*=|(?:href|to|path|value)\s*=\s*["'`]|(?:id|name|aria-label|role)\s*=\s*["'`]|(?:router\.(?:push|replace)|navigate)\s*\(|<Route\b|<(?:button|a|TabsTrigger)\b|cursor-pointer/i;

/**
 * Inventario acotado del codigo local: rutas y selectores visibles para que la
 * IA no invente navegacion. No lee .env ni ficheros ajenos a UI web.
 */
function repoNavigationContext(codePath: string, objective = ""): string {
  const root = path.resolve(codePath);
  try {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return "";
  } catch {
    return "";
  }

  const files: string[] = [];
  const walk = (dir: string) => {
    if (files.length >= 500) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.isDirectory()) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) walk(absolute);
      } else if (
        REPO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) &&
        !/\.config\.[cm]?[jt]s$/i.test(entry.name)
      ) {
        files.push(absolute);
      }
      if (files.length >= 500) break;
    }
  };
  walk(root);

  const relative = (file: string) => path.relative(root, file).replace(/\\/g, "/");
  const routeFiles = files
    .filter((file) => /(?:^|\/)(?:app|pages|routes?)(?:\/|$)/i.test(relative(file)))
    .map(relative)
    .slice(0, 80);

  const evidence: string[] = [];
  const objectiveTokens = objective
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
  const targeted: string[] = [];
  for (const file of files) {
    if (evidence.length >= 120 && (objectiveTokens.length === 0 || targeted.length >= 100)) break;
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    const normalizedText = text
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (objectiveTokens.length > 0 && objectiveTokens.some((token) => normalizedText.includes(token))) {
      for (let index = 0; index < lines.length && targeted.length < 100; index++) {
        const normalizedLine = lines[index]
          .toLocaleLowerCase("es")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        if (!objectiveTokens.some((token) => normalizedLine.includes(token))) continue;
        const from = Math.max(0, index - 2);
        const to = Math.min(lines.length, index + 3);
        const excerpt = lines.slice(from, to).map((line) => line.trim()).filter(Boolean).join(" ");
        targeted.push(`${relative(file)}:${index + 1} ${excerpt.slice(0, 420)}`);
      }
    }
    for (let index = 0; index < lines.length && evidence.length < 120; index++) {
      const line = lines[index].trim();
      if (NAV_EVIDENCE.test(line)) {
        evidence.push(`${relative(file)}:${index + 1} ${line.slice(0, 220)}`);
      }
    }
  }

  if (routeFiles.length === 0 && evidence.length === 0 && targeted.length === 0) return "";
  return [
    "## Evidencia del repositorio local (no inventar fuera de esta evidencia)",
    "Archivos de rutas/paginas:",
    ...(routeFiles.length ? routeFiles.map((file) => `- ${file}`) : ["- No detectados"]),
    "Selectores y navegacion encontrados:",
    ...(evidence.length ? evidence.map((line) => `- ${line}`) : ["- No detectados"]),
    ...(objectiveTokens.length
      ? [
          `Coincidencias especificas para \"${objective}\":`,
          ...(targeted.length ? targeted.map((line) => `- ${line}`) : ["- No detectadas"]),
        ]
      : []),
  ].join("\n");
}

const SYSTEM_FUNCS = `Eres un estratega de producto y contenido. A partir del dossier de un producto
SaaS/appweb, propones que FUNCIONALIDADES concretas conviene mostrar en un video corto de redes
para demostrar su valor. Cada funcionalidad debe ser navegable en la propia app. Respondes SIEMPRE
en espanol y SOLO con JSON valido, sin markdown.`;

export async function analyzeFunctions(args: {
  dossier: Dossier;
  appUrl: string;
  codeType?: string | null;
  codePath?: string | null;
  objective?: string;
  loginConfigured?: boolean;
  demoData?: string;
  runtimeContext?: string;
  navigationMap?: NavigationMap | null;
}): Promise<AppFuncion[]> {
  const { dossier, appUrl } = args;
  const objective = args.objective?.trim() ?? "";
  const repoContext =
    args.codeType === "local" && args.codePath ? repoNavigationContext(args.codePath, objective) : "";
  const navigationContext = args.navigationMap
    ? flattenNavigation(args.navigationMap.roots)
        .slice(0, 120)
        .map((node) =>
          `- ${node.label} | ruta=${node.route || "n/d"} | superficie=${node.surface} | evidencias=${node.evidence.join("; ")}`,
        )
        .join("\n")
    : "";

  const prompt = `${objective
    ? `Analiza EXCLUSIVAMENTE como demostrar la funcionalidad solicitada \"${objective}\". Devuelve una sola funcion y conserva ese objetivo como nombre.`
    : "Propon entre 3 y 6 funcionalidades demostrables de nuestra app para grabar un video corto que ensene su valor."}

## Nuestra app (del dossier)
- Negocio: ${dossier.negocio}
- Propuesta de valor: ${dossier.propuestaValor}
- Publico objetivo: ${dossier.publicoObjetivo}
- Funcionalidades clave: ${dossier.funcionalidades.slice(0, 10).join(", ")}
- URL base: ${appUrl}
- Login previo al recorrido: ${args.loginConfigured ? "configurado; Playwright lo ejecutara antes de navSteps" : "no configurado"}
${args.demoData ? `- Cliente/dato de ejemplo solicitado: ${args.demoData}` : "- Cliente/dato de ejemplo: no indicado; si hace falta una entidad dinámica, usa el primer elemento seguro observado y dilo en los pasos humanos"}

${repoContext}
${args.runtimeContext ?? ""}
${navigationContext ? `## Mapa funcional ya generado\n${navigationContext}` : ""}

## Instruccion
Devuelve EXCLUSIVAMENTE un JSON con esta forma exacta:
{
  "funciones": [
    {
      "nombre": "nombre corto de la funcionalidad",
      "descripcion": "que resuelve y por que es demostrable en video",
      "url": "URL o ruta concreta a navegar para mostrarla (usa la URL base si no sabes la ruta exacta)",
      "pasos": ["paso 1 de navegacion", "paso 2", "paso 3"],
      "evidencias": ["ruta/archivo.tsx:linea que justifica el paso"],
      "confianza": "alta | media | baja",
      "navSteps": [
        { "action": "goto", "url": "URL concreta" },
        { "action": "tap", "selector": "[data-testid='selector-real']", "commit": false },
        { "action": "fill", "selector": "[data-testid='campo-real']", "value": "dato de demostracion" },
        { "action": "wait", "selector": "[data-testid='resultado-real']", "timeoutMs": 15000 },
        { "action": "scroll", "pixels": 500, "pauseMs": 1500 }
      ]
    }
  ]
}
Reglas: ${objective ? "exactamente 1 funcion, la solicitada" : "3-6 funciones; prioriza las de mayor impacto visual"}; los pasos deben ser accionables.
Si hay evidencia del repositorio o de Playwright runtime, usa exclusivamente rutas y selectores que
aparezcan en ella, prefiriendo data-testid/data-tutorial y después id, name, placeholder, href o texto
literal de botón. Puedes usar selectores Playwright observados como button:has-text("Texto") y
"tag.cursor-pointer >> nth=0". No inventes selectores. Si no hay evidencia suficiente, omite navSteps
y conserva los pasos humanos; la grabacion usara su modo compatible. navSteps puede contener varios
goto si la funcionalidad atraviesa varias pantallas. No incluyas pasos ni valores de credenciales:
el login cifrado ocurre antes de ejecutar este recorrido. Cuando haya navSteps, empieza por un goto
a la primera pantalla funcional para que el recorrido sea determinista despues del login. Para rutas
dinamicas, navega seleccionando la entidad observada; nunca inventes IDs ni uses ":param" en una URL.
Incluye todos los estados intermedios necesarios (tabs, filtros, desplegables y modales) y no dependas
de selecciones guardadas en sessionStorage. El tag del selector debe coincidir con el elemento real:
no conviertas una tarjeta div clicable en button solo porque su texto parezca una accion.
Marca \`commit:true\` SOLO en el tap que confirma una mutacion (generar, guardar, enviar, eliminar o pagar),
para que el dry-run se detenga antes de ejecutarla. Cada evidencia debe existir literalmente en el
contexto proporcionado. No incluyas nada fuera del JSON.`;

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
  const funciones = list
    .map(coerceFuncion)
    .filter((f) => f.nombre)
    .map((funcion) => normalizeFunctionUrls(funcion, appUrl));
  if (funciones.length === 0) {
    throw new Error("El motor de IA no propuso funcionalidades. Revisa el motor en Ajustes.");
  }
  return funciones;
}

function normalizeFunctionUrls(funcion: AppFuncion, appUrl: string): AppFuncion {
  const absolute = (value: string): string => {
    if (!value) return appUrl;
    try {
      return new URL(value, appUrl).href;
    } catch {
      return appUrl;
    }
  };
  const normalized: AppFuncion = { ...funcion, url: absolute(funcion.url) };
  if (funcion.navSteps?.length) {
    const invalidDynamicUrl = funcion.navSteps.some(
      (step) => step.action === "goto" && Boolean(step.url?.match(/:\w+|\{[^}]+\}|\[[^\]]+\]/)),
    );
    if (!invalidDynamicUrl) {
      normalized.navSteps = funcion.navSteps.map((step) =>
        step.action === "goto" && step.url ? { ...step, url: absolute(step.url) } : step,
      );
    } else {
      delete normalized.navSteps;
      normalized.confianza = "baja";
    }
  }
  return normalized;
}

const SYSTEM_GUION = `Eres un guionista experto en contenido corto para redes sociales que muestra
producto (product-led). Creas guiones ORIGINALES que ensenan una funcionalidad real de una app,
combinando la grabacion de pantalla con cortes B-roll generados. Escribes hooks de 3 segundos,
estructura de retencion y CTAs claros. Respondes SIEMPRE en espanol y SOLO con JSON valido, sin markdown.`;

export async function generateDemoGuion(args: {
  dossier: Dossier;
  funcion: AppFuncion;
  plataforma: Plataforma;
  previousCount?: number;
  clipCount?: number;
}): Promise<PieceContent> {
  const { dossier, funcion, plataforma, previousCount = 0 } = args;
  const clipCount = Math.min(6, Math.max(0, Math.round(args.clipCount ?? 4)));

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
${previousCount > 0 ? `- Ya existen ${previousCount} videos de esta funcionalidad: usa un angulo, hook y estructura claramente distintos.` : ""}

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
Reglas: crea entre 4 y 10 planos y exactamente ${clipCount} planos CORTE b-roll con prompt${clipCount === 0 ? "; usa solo planos de GRABACION" : ""}; alterna grabacion de pantalla y cortes b-roll; los "prompt" de los cortes en
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
