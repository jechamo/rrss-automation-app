#!/usr/bin/env node
/**
 * PostToolUse (Edit|Write|MultiEdit) — formatea y linta solo el fichero tocado.
 * Detecta la herramienta disponible; si no hay ninguna, no hace nada y calla.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readHookInput, projectRoot, allow } from './_lib.mjs';

const input = await readHookInput();
const root = projectRoot(input);
const ruta = (input.tool_input?.file_path || input.tool_input?.path || '').replace(/\\/g, '/');
if (!ruta) allow();

const ext = (ruta.split('.').pop() || '').toLowerCase();
const tiene = (rel) => existsSync(join(root, rel));

/** Ejecuta y devuelve la salida; nunca lanza. */
function run(cmd, args) {
  try {
    return { ok: true, out: execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', timeout: 60_000 }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}`.trim() };
  }
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const acciones = [];

if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'css', 'scss', 'md', 'yml', 'yaml'].includes(ext)) {
  if (tiene('biome.json') || tiene('biome.jsonc')) {
    acciones.push([npx, ['--no-install', 'biome', 'check', '--write', ruta]]);
  } else {
    if (tiene('.prettierrc') || tiene('.prettierrc.json') || tiene('prettier.config.js') || tiene('.prettierrc.cjs')) {
      acciones.push([npx, ['--no-install', 'prettier', '--write', ruta]]);
    }
    if (['ts', 'tsx', 'js', 'jsx'].includes(ext) &&
        (tiene('eslint.config.js') || tiene('eslint.config.mjs') || tiene('.eslintrc.json') || tiene('.eslintrc.cjs'))) {
      acciones.push([npx, ['--no-install', 'eslint', '--fix', ruta]]);
    }
  }
}

if (ext === 'py') {
  if (tiene('pyproject.toml') || tiene('ruff.toml') || tiene('.ruff.toml')) {
    acciones.push(['ruff', ['format', ruta]]);
    acciones.push(['ruff', ['check', '--fix', ruta]]);
  }
}

if (ext === 'go') acciones.push(['gofmt', ['-w', ruta]]);
if (ext === 'rs') acciones.push(['rustfmt', [ruta]]);

const errores = [];
for (const [cmd, args] of acciones) {
  const r = run(cmd, args);
  if (!r.ok && r.out && !/not found|no such file|ENOENT|command not found/i.test(r.out)) {
    errores.push(r.out.split('\n').slice(0, 15).join('\n'));
  }
}

if (errores.length) {
  // exit 2 en PostToolUse devuelve el mensaje a Claude para que lo arregle.
  process.stderr.write(`⚠️  Lint/formato en \`${ruta}\`:\n${errores.join('\n')}\n`);
  process.exit(2);
}

allow();
