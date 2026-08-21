#!/usr/bin/env node
/**
 * Stop — registra la sesión en docs/bitacora/sessions/YYYY-MM.md.
 * Registro mecánico y breve: el "por qué" lo escribe bitacora-keeper en DECISIONS.md.
 */
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readHookInput, projectRoot, appendLine, resolveActiveSpec, allow, hostDestino } from './_lib.mjs';

const input = await readHookInput();
const root = projectRoot(input);

const ahora = new Date();
const mes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
const fecha = ahora.toISOString().slice(0, 10);
const hora = ahora.toTimeString().slice(0, 5);

const dir = join(root, 'docs/bitacora/sessions');
const fichero = join(dir, `${mes}.md`);

if (!existsSync(fichero)) appendLine(fichero,
  `# Sesiones de agente — ${mes}\n\n` +
  '> Registro automático (hook `Stop`). Las decisiones y su porqué viven en\n' +
  '> [`../DECISIONS.md`](../DECISIONS.md); esto es solo la traza de actividad.\n', root);

const resolution = resolveActiveSpec(root);
const spec = resolution.spec;
const contexto = spec
  ? `spec ${spec.nombre} (${spec.hechas}/${spec.total})`
  : resolution.reason === 'spec-activa-ambigua'
    ? `spec activa ambigua (${resolution.candidates.map((candidate) => candidate.nombre).join(', ')})`
    : 'sin spec activa';
const sesion = (input.session_id || '').slice(0, 8) || 'n/a';

appendLine(fichero, `- ${fecha} ${hora} · sesión \`${sesion}\` · ${contexto}`, root);

if (hostDestino() === 'codex') {
  process.stdout.write(`${JSON.stringify({ continue: true })}\n`);
  process.exit(0);
}
allow();
