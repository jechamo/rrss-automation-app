#!/usr/bin/env node
/**
 * Escaneo de secretos sobre ficheros versionados.
 *
 *   node scripts/scan-secrets.mjs [--json]
 *
 * Existe porque la Definition of Done promete este gate "en CI, bloquea merge" y hasta ahora
 * solo existía como hook local. Un hook local no protege nada en los hosts que no tienen hooks
 * —Lovable y equivalentes—, ni en un push hecho desde la web de GitHub. Ahí CI es lo único.
 *
 * Comparte los patrones con `.sdd/hooks/guard-write.mjs` a través de `.sdd/hooks/_lib.mjs`:
 * si divergieran, el que miente sería siempre el que no se ejecuta en tu máquina.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const JSON_OUT = process.argv.includes('--json');

const libPath = join(ROOT, '.sdd/hooks/_lib.mjs');
if (!existsSync(libPath)) {
  console.error('No existe .sdd/hooks/_lib.mjs: no hay patrones que aplicar.');
  process.exit(1);
}
const { PATRONES_SECRETO, RUTAS_PROHIBIDAS, esPlantillaEnv } = await import(pathToFileURL(libPath).href);

const listado = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (listado.status !== 0) {
  console.error('No se pudo listar los ficheros versionados; ¿es un repositorio git?');
  process.exit(1);
}
const ficheros = listado.stdout.split('\0').filter(Boolean);

// Este propio fichero y la librería contienen los patrones: se excluyen o se denuncian a sí mismos.
const AUTOEXCLUIDOS = new Set(['scripts/scan-secrets.mjs', '.sdd/hooks/_lib.mjs', '.sdd/hooks/guard-write.mjs']);

const hallazgos = [];
let revisados = 0;

for (const ruta of ficheros) {
  // 1 · Ficheros que no deben existir en el repositorio por lo que son.
  if (!esPlantillaEnv(ruta)) {
    for (const p of RUTAS_PROHIBIDAS) {
      if (p.re.test(ruta)) hallazgos.push({ ruta, linea: null, que: 'fichero prohibido', detalle: p.motivo });
    }
  }
  if (AUTOEXCLUIDOS.has(ruta)) continue;

  // 2 · Secretos en el contenido.
  let contenido;
  try { contenido = readFileSync(join(ROOT, ruta), 'utf8'); } catch { continue; }
  if (contenido.includes('\0')) continue; // binario
  revisados += 1;

  const lineas = contenido.split(/\r?\n/);
  for (let i = 0; i < lineas.length; i += 1) {
    for (const s of PATRONES_SECRETO) {
      if (s.re.test(lineas[i])) hallazgos.push({ ruta, linea: i + 1, que: s.que, detalle: null });
    }
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify({ ok: hallazgos.length === 0, filesScanned: revisados, findings: hallazgos }));
  process.exit(hallazgos.length ? 1 : 0);
}

if (!hallazgos.length) {
  console.log(`Escaneo de secretos: sin hallazgos en ${revisados} fichero(s) versionado(s).`);
  process.exit(0);
}

console.error(`Escaneo de secretos: ${hallazgos.length} hallazgo(s) en ${revisados} fichero(s).\n`);
for (const h of hallazgos) {
  const donde = h.linea ? `${h.ruta}:${h.linea}` : h.ruta;
  console.error(`  ✗ ${donde} — ${h.que}${h.detalle ? ` · ${h.detalle}` : ''}`);
}
console.error('\nUn secreto en el historial sigue comprometido aunque lo borres del último commit:');
console.error('rota la credencial primero, y después limpia el fichero.');
console.error('Si es un valor de prueba, hazlo evidente para que no parezca real.');
process.exit(1);
