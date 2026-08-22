import { createInterface } from "node:readline/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { inspectClaudeSession } from "../src/core/installation/claude-session.mjs";

const ASSISTANT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "install-local.mjs",
);

/**
 * Recorrido guiado: check → prepare → indicar /login → comprobar sesión → start.
 * No autentica, no pide secretos y no dispara iniciar.bat.
 *
 * @param {{
 *   write?: (line: string) => void,
 *   prompt?: (id: string) => Promise<boolean>,
 *   runAssistant?: (operation: string) => Promise<{exitCode: number}>,
 *   inspectSession?: () => Promise<object>,
 * }} [ports]
 */
export async function runPrepareGuide({
  write = (line) => process.stdout.write(`${line}\n`),
  prompt,
  runAssistant,
  inspectSession,
} = {}) {
  const ask = prompt ?? defaultPrompt;
  const assistant = runAssistant ?? defaultRunAssistant;
  const sessionCheck = inspectSession ?? (async () => inspectClaudeSession());

  write("============================================");
  write("  RRSS Studio · Preparar en Windows 11");
  write("============================================");
  write("Contrato: persistencia comprobada · arranque comprobado · opcionales identificados");
  write("Este recorrido no instala nada global, no modifica el PATH y no inicia sesión por ti.");
  write("");

  write("Paso 1/5 · Diagnóstico (sin cambios)");
  const check = await assistant("check");
  if (check.exitCode !== 0) {
    write("El diagnóstico no ha declarado el uso local básico. Lee la categoría y el siguiente paso de arriba.");
  }
  write("");

  write("Paso 2/5 · Preparación dentro del proyecto");
  write("Instala dependencias y deja la plantilla lista. Pedirá confirmación explícita.");
  const prepared = await ask("prepare", "¿Ejecutar prepare? [y/N] ");
  if (prepared) {
    await assistant("prepare");
  } else {
    write("Preparación omitida. Sin cambios.");
  }
  write("");

  write("Paso 3/5 · Sesión de Claude (opcional, no bloquea)");
  write("No se piden secretos ni se lanza el login.");
  write("Si quieres análisis con IA: abre la aplicación Claude en este equipo y ejecuta /login.");
  write("Cuando hayas terminado —o si prefieres seguir sin IA— continúa.");
  await ask("claude-ready", "Pulsa Intro para comprobar la sesión (sin autenticar)… ");
  const session = await sessionCheck();
  write(`IA autenticada: ${sessionLabel(session.status)}`);
  write(`Efecto: ${session.nextStep}`);
  write("");

  write("Paso 4/5 · Arranque local");
  write("Pedirá confirmación de proceso. No dispara el arranque limpio histórico ni cierra procesos por imagen.");
  const shouldStart = await ask("start", "¿Ejecutar start? [y/N] ");
  let started = false;
  if (shouldStart) {
    const start = await assistant("start");
    started = start.exitCode === 0;
  } else {
    write("Arranque omitido.");
  }
  write("");

  write("Paso 5/5 · Resultado");
  write(
    started
      ? "Arranque solicitado. Si el asistente lo aceptó, abre http://localhost:3000"
      : "Puedes repetir este instalador o usar node scripts/install-local.mjs start",
  );
  if (session.status !== "ok") {
    write("Los análisis con IA siguen limitados hasta que exista una sesión local.");
  }

  return { prepared, started, session };
}

function sessionLabel(status) {
  if (status === "ok") return "comprobada";
  if (status === "login-required") return "opcional bloqueada · falta /login";
  if (status === "binary-missing") return "opcional no comprobada · herramienta ausente";
  return "opcional no comprobada";
}

async function defaultPrompt(id, question) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question(question);
    if (id === "claude-ready") return true;
    return /^(?:y|yes|s|sí)$/iu.test(answer.trim());
  } finally {
    terminal.close();
  }
}

function defaultRunAssistant(operation) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [ASSISTANT, operation], {
      stdio: "inherit",
      windowsHide: false,
    });
    child.on("close", (code) => resolve({ exitCode: code ?? 1 }));
    child.on("error", () => resolve({ exitCode: 1 }));
  });
}

export function isDirectExecution(
  moduleUrl = import.meta.url,
  executablePath = process.argv[1],
) {
  if (typeof executablePath !== "string" || executablePath === "") return false;
  return pathToComparable(executablePath) === pathToComparable(fileURLToPath(moduleUrl));
}

function pathToComparable(filePath) {
  return path.resolve(filePath).toLowerCase();
}

if (isDirectExecution()) {
  runPrepareGuide().then((result) => {
    process.exitCode = result.started || result.session?.blocksBasicUse === false ? 0 : 1;
  });
}
