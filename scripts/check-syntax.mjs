#!/usr/bin/env node
/**
 * check-syntax — verificación de sintaxis y formato de los scripts, sin dependencias.
 *
 *   node scripts/check-syntax.mjs [--json]
 *   node scripts/check-syntax.mjs --selftest
 *
 * Un repositorio editado desde Windows por varios agentes acumula CRLF, espacios finales y
 * ficheros sin línea final sin que nadie lo note, hasta que un diff de trescientas líneas
 * resulta ser un cambio de una. Esto lo detecta antes de que llegue al commit.
 *
 * Alcance deliberado: solo los módulos ejecutables. La prosa en Markdown no se lintea porque
 * el formato de un párrafo no es un defecto y penalizarlo produce ruido que se acaba ignorando.
 *
 * Node >= 18, sin dependencias.
 */
import { readFileSync, readdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const JSON_OUT = process.argv.includes('--json');
const EXTENSIONES = ['.mjs', '.js'];
const IGNORAR = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);

/**
 * Reglas de `.editorconfig` que sí describen un defecto objetivo. Se leen sobre el texto
 * completo, no línea a línea, para que el resultado sea idéntico en Windows y en Linux.
 */
function analizarFormato(texto) {
  const hallazgos = [];
  if (texto.includes('\r\n')) hallazgos.push({ regla: 'crlf', detalle: 'fin de línea CRLF; .editorconfig exige LF' });
  if (texto.length && !texto.endsWith('\n')) hallazgos.push({ regla: 'sin-linea-final', detalle: 'el fichero no termina en salto de línea' });
  const lineas = texto.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    if (/[ \t]+$/.test(linea)) hallazgos.push({ regla: 'espacios-finales', detalle: `espacios al final de la línea ${i + 1}` });
    if (/^\t/.test(linea)) hallazgos.push({ regla: 'tabulador', detalle: `indentación con tabulador en la línea ${i + 1}` });
  }
  return hallazgos;
}

function ficherosVersionados() {
  const listado = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (listado.status === 0) {
    return listado.stdout.split('\0').filter(Boolean)
      .filter((ruta) => EXTENSIONES.some((ext) => ruta.endsWith(ext)));
  }
  // Sin git se recorre el árbol: preferimos analizar de más a no analizar nada.
  const encontrados = [];
  const recorrer = (relativa) => {
    for (const entrada of readdirSync(join(ROOT, relativa) || ROOT, { withFileTypes: true })) {
      const siguiente = relativa ? `${relativa}/${entrada.name}` : entrada.name;
      if (entrada.isDirectory()) {
        if (!IGNORAR.has(entrada.name)) recorrer(siguiente);
      } else if (EXTENSIONES.some((ext) => entrada.name.endsWith(ext))) encontrados.push(siguiente);
    }
  };
  recorrer('');
  return encontrados;
}

function comprobarSintaxis(ruta) {
  const r = spawnSync(process.execPath, ['--check', join(ROOT, ruta)], { encoding: 'utf8' });
  if (r.status === 0) return null;
  // El mensaje de Node incluye la ruta absoluta del host; se recorta a la ruta del repositorio.
  const bruto = `${r.stderr || ''}`.split('\n').filter(Boolean).slice(0, 3).join(' ').trim();
  return { regla: 'sintaxis', detalle: bruto.split(sep).pop() || 'sintaxis inválida' };
}

function analizar() {
  const problemas = [];
  const ficheros = ficherosVersionados();
  for (const ruta of ficheros) {
    let texto;
    try { texto = readFileSync(join(ROOT, ruta), 'utf8'); }
    catch { continue; }
    const sintaxis = comprobarSintaxis(ruta);
    if (sintaxis) problemas.push({ file: ruta, ...sintaxis });
    for (const hallazgo of analizarFormato(texto)) problemas.push({ file: ruta, ...hallazgo });
  }
  return { filesScanned: ficheros.length, problems: problemas };
}

/**
 * Autotest del propio verificador. Vive aquí y no en un fichero aparte: para una herramienta
 * de este tamaño, un segundo módulo sería más superficie que valor.
 */
function selftest() {
  const casos = [
    { nombre: 'limpio', texto: 'const a = 1;\nexport default a;\n', espera: [] },
    { nombre: 'crlf', texto: 'const a = 1;\r\n', espera: ['crlf'] },
    { nombre: 'sin línea final', texto: 'const a = 1;', espera: ['sin-linea-final'] },
    { nombre: 'espacios finales', texto: 'const a = 1;   \n', espera: ['espacios-finales'] },
    { nombre: 'tabulador', texto: 'function f() {\n\treturn 1;\n}\n', espera: ['tabulador'] },
  ];
  let fallos = 0;
  for (const caso of casos) {
    const reglas = analizarFormato(caso.texto).map((h) => h.regla);
    const igual = reglas.length === caso.espera.length && caso.espera.every((r) => reglas.includes(r));
    console.log(`  ${igual ? '✓' : '✗'} ${caso.nombre} → [${reglas.join(', ')}]`);
    if (!igual) fallos++;
  }
  const temporal = mkdtempSync(join(tmpdir(), 'sdd-syntax-'));
  try {
    const roto = join(temporal, 'roto.mjs');
    writeFileSync(roto, 'const a = ;\n', 'utf8');
    const hallazgo = comprobarSintaxis(relative(ROOT, roto));
    const detecta = Boolean(hallazgo) && hallazgo.regla === 'sintaxis';
    console.log(`  ${detecta ? '✓' : '✗'} sintaxis inválida detectada`);
    if (!detecta) fallos++;
    const sano = join(temporal, 'sano.mjs');
    writeFileSync(sano, 'export const a = 1;\n', 'utf8');
    const limpio = comprobarSintaxis(relative(ROOT, sano)) === null;
    console.log(`  ${limpio ? '✓' : '✗'} sintaxis válida aceptada`);
    if (!limpio) fallos++;
  } finally {
    rmSync(temporal, { recursive: true, force: true });
  }
  if (fallos) {
    console.error(`\ncheck-syntax --selftest: ${fallos} comprobación(es) fallida(s).`);
    process.exit(1);
  }
  console.log('\ncheck-syntax --selftest: el verificador se comporta como dice.');
}

if (process.argv.includes('--selftest')) {
  console.log('check-syntax · autotest');
  selftest();
} else {
  const resultado = analizar();
  if (JSON_OUT) console.log(JSON.stringify({ schemaVersion: 1, ok: resultado.problems.length === 0, ...resultado }));
  else {
    console.log(`check-syntax · ${resultado.filesScanned} fichero(s)`);
    for (const p of resultado.problems) console.log(`  ✗ [${p.regla}] ${p.file}: ${p.detalle}`);
    console.log(resultado.problems.length
      ? `\n${resultado.problems.length} problema(s) de sintaxis o formato.`
      : '\nSintaxis y formato correctos.');
  }
  if (resultado.problems.length) process.exit(1);
}
