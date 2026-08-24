#!/usr/bin/env node
/**
 * PreToolUse (Edit|Write|MultiEdit|NotebookEdit) — controla dónde se puede escribir.
 *
 * Tres niveles de decisión, no dos:
 *   deny  → prohibido (secretos, artefactos generados, territorio ajeno)
 *   ask   → escala al humano (políticas de agentes, configuración compartida)
 *   allow → adelante
 */
import {
  readHookInput, decide, gatesEnabled, toolCall, rutasDe, hostDestino,
  projectRoot, readIfExists, agenteActivo, logEjecucion, marcarAutoria,
  PATRONES_SECRETO, motivoRutaProhibida,
} from './_lib.mjs';
import { decidirTerritorio, cargarTerritorios } from './territorios.mjs';
import { join } from 'node:path';

const input = await readHookInput();
const { entrada } = toolCall(input);
const host = hostDestino();
const root = projectRoot(input);
const rutas = rutasDe(entrada);
const contenido = entrada.content || entrada.new_string || '';

if (!rutas.length) decide('allow', 'Sin ruta que evaluar.', host);

// ── deny: nunca ──────────────────────────────────────────────────────────────
// Las de secretos y material criptográfico vienen de `_lib.mjs`, compartidas con el escáner de
// CI: si divergen, el que miente es el que no se ejecuta en tu máquina.
const prohibidas = [
  { re: /(^|\/)node_modules\//, motivo: 'Dependencias instaladas: edita el manifiesto.' },
  { re: /(^|\/)(dist|build|out|\.next|target|coverage)\//, motivo: 'Artefacto generado: edita la fuente.' },
  { re: /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|Cargo\.lock)$/,
    motivo: 'Lockfile: se regenera con el gestor de paquetes.' },
  { re: /(^|\/)\.git\//, motivo: 'Internals de git.' },
  { re: /(^|\/)(execution-log|agent-audit)\.jsonl$/,
    motivo: 'Bitácora append-only de ejecuciones: la escriben los hooks, no el agente. ' +
            'Reescribirla destruiría la única evidencia de qué agente hizo qué.' },
];

for (const r of rutas) {
  const motivoCompartido = motivoRutaProhibida(r);
  if (motivoCompartido) {
    decide('deny', `Escritura bloqueada en \`${r}\`. ${motivoCompartido}`, host);
  }
  for (const p of prohibidas) {
    if (p.re.test(r)) decide('deny', `Escritura bloqueada en \`${r}\`. ${p.motivo}`, host);
  }
}

// ── deny: secretos en el contenido ───────────────────────────────────────────
if (gatesEnabled() && contenido) {
  for (const s of PATRONES_SECRETO) {
    if (s.re.test(contenido)) {
      decide(
        'deny',
        `Posible secreto en \`${rutas[0]}\` (${s.que}). Usa una variable de entorno y ` +
          'documenta su nombre en `.env.example`, sin el valor. Si es un valor de prueba, hazlo evidente.',
        host,
      );
    }
  }
}

// ── ask: política compartida del ecosistema ──────────────────────────────────
// Cambiar un agente, una skill o un hook cambia el comportamiento de TODO el
// proyecto y de todas las sesiones futuras. Eso lo aprueba una persona.
const politica = [
  /(^|\/)\.claude\/(agents|skills)\//,
  /(^|\/)\.agents\/skills\//,
  /(^|\/)\.agents\/agents\//,
  /(^|\/)\.gemini\/agents\//,
  /(^|\/)\.sdd\/hooks\//,
  /(^|\/)\.sdd\/docs\.json$/,
  /(^|\/)\.claude\/settings\.json$/,
  /(^|\/)\.github\/(agents|prompts|instructions)\//,
  /(^|\/)\.cursor\/(rules|agents|commands)\//,
  /(^|\/)\.codex\/(agents\/|config\.toml$)/,
  /(^|\/)\.agents\/(rules|workflows)\//,
  /(^|\/)(AGENTS|CLAUDE|GEMINI)\.md$/,
  /(^|\/)docs\/architecture\/constitution\.md$/,
  /(^|\/)\.mcp\.json$/,
  // Aprobar una skill de terceros es una decisión de cadena de suministro (ASI04):
  // instrucciones que el agente obedecerá, más scripts que puede ejecutar.
  /(^|\/)\.sdd\/external-skills\.json$/,
];

if (gatesEnabled()) {
  for (const r of rutas) {
    if (politica.some((p) => p.test(r))) {
      decide(
        'ask',
        `\`${r}\` define el comportamiento de los agentes o la arquitectura del proyecto. ` +
          'Un cambio aquí afecta a todas las sesiones futuras: requiere revisión humana.',
        host,
      );
    }
  }
}

// ── deny: territorio ajeno ───────────────────────────────────────────────────
//
// Un handoff hace que el trabajo avance; NO impide que un agente haga lo que no le
// toca. Eso lo impide esto: se cruza el agente activo (que registran SubagentStart/
// SubagentStop) con la ruta que intenta escribir.
//
// La regla vive en `territorios.mjs`, no aquí. Este bloque es el adaptador: traduce la
// entrada del host a una llamada y convierte la respuesta en una decisión. Duplicar la
// regla haría que verificarla dejara de significar nada.
const agente = gatesEnabled() ? agenteActivo(root, input.session_id || 'default') : null;

if (gatesEnabled()) {
  const reparto = cargarTerritorios(readIfExists(join(root, '.sdd/territories.json')));

  for (const r of rutas) {
    const veredicto = decidirTerritorio({
      agente,
      ruta: r,
      modo: reparto.modo,
      config: reparto.config,
    });
    if (veredicto.decision !== 'allow') decide(veredicto.decision, veredicto.motivo, host);
  }
}

// ── autoría de fichero, observada por la propia guarda ───────────────────────
//
// Llegar aquí significa que la escritura está permitida y va a ocurrir. Registrarla ahora
// deja evidencia de «este agente tocó este fichero» sin depender de que el host emita el
// ciclo de vida del subagente: la pre-escritura corre en cinco de los seis entornos, el
// ciclo de subagente solo en dos. Una línea por agente y fichero, no por pulsación.
//
// El límite: la guarda ve la intención de escribir, no la escritura consumada. Si el host
// aborta después, quedará una autoría de algo que no llegó a pasar. Se prefiere ese falso
// positivo a no tener rastro en cuatro de los seis entornos.
if (agente) {
  for (const r of rutas) {
    if (!marcarAutoria(root, { sesion: input.session_id || 'default', agente, ruta: r })) continue;
    try {
      logEjecucion(root, {
        evento: 'autoria',
        agente,
        sesion: String(input.session_id || 'default').slice(0, 8) || null,
        fichero: r,
        verificacion: 'observed-write',
      });
    } catch { /* la bitácora no puede impedir una escritura legítima */ }
  }
}


// ── aviso que no bloquea ─────────────────────────────────────────────────────
const esNucleo = rutas.some(
  (r) => /^(src|app|lib|packages|services)\//.test(r) &&
         !/\.(test|spec)\./.test(r) &&
         /(^|\/)(domain|application)\//.test(r),
);
if (gatesEnabled() && esNucleo) {
  process.stderr.write(
    'ℹ️  Código de dominio/aplicación: asegúrate de tener el test ROJO demostrado antes.\n',
  );
}

decide('allow', 'Ruta permitida por la guarda SDD.', host);
