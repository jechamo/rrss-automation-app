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
  projectRoot, readIfExists, agenteActivo, globARegExp,
  PATRONES_SECRETO, RUTAS_PROHIBIDAS, esPlantillaEnv,
} from './_lib.mjs';
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
  ...RUTAS_PROHIBIDAS,
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
  if (esPlantillaEnv(r)) continue;
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
// La regla es "no entres en el territorio de otro", no "quédate en el tuyo": una ruta
// que no pertenece a nadie se permite. En un repo recién creado nadie sabe todavía
// dónde vive cada cosa, y una guarda que bloquea lo desconocido se desactiva el primer día.
if (gatesEnabled()) {
  const cfg = (() => {
    try {
      return JSON.parse(readIfExists(join(root, '.sdd/territories.json')) || 'null');
    } catch {
      return null; // un mapa ilegible no debe bloquear el trabajo; check-sdd lo denuncia
    }
  })();

  const agente = agenteActivo(root, input.session_id || 'default');
  const modo = cfg?.modo || 'deny';

  // Sin agente identificado es el hilo principal —el humano y su agente—, no un especialista.
  if (cfg && agente && !['off', 'audit'].includes(modo) && !(cfg.coordinadores || []).includes(agente)) {
    const territorios = Array.isArray(cfg.territories)
      ? cfg.territories.map((t, i) => [
          t.name || `territory-${i + 1}`,
          { duenos: [t.agent].filter(Boolean), patrones: t.paths || [] },
        ])
      : Object.entries(cfg.territorios || {});
    for (const [nombre, t] of territorios) {
      const duenos = t.duenos || [];
      if (duenos.includes(agente)) continue;

      for (const r of rutas) {
        if (!(t.patrones || []).some((p) => globARegExp(p).test(r))) continue;
        decide(
          modo,
          `\`${r}\` es territorio de **${nombre}** (${duenos.join(', ') || 'sin dueño declarado'}) ` +
            `y quien escribe es **${agente}**.\n` +
            `Cada capa tiene su procedimiento —puertas de entrada, ciclo TDD y comprobaciones ` +
            `propias— y saltárselo es la forma habitual de colar un fallo. Devuelve el control a ` +
            `quien te invocó y que delegue en el especialista.\n` +
            `Si el reparto es incorrecto, se corrige en \`.sdd/territories.json\`, no ignorándolo.`,
          host,
        );
      }
    }
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
