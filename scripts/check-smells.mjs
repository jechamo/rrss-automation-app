#!/usr/bin/env node
/**
 * check-smells — trinquete de tamaño sobre el código propio.
 *
 * Aquí hay una tentación que conviene descartar por escrito: medir complejidad ciclomática.
 * Suena riguroso y es barato de aproximar contando palabras clave, pero esa aproximación mide
 * el número de `if` y no la dificultad de entender el código. Un `switch` de quince casos
 * planos puntúa peor que tres condiciones anidadas con estado compartido, cuando la segunda es
 * la que de verdad duele. Un número que se puede bajar reordenando sin mejorar nada es un
 * número que se acaba gestionando en lugar de usarse. Por eso este verificador mide **tamaño**,
 * que es una señal más pobre pero honesta: un fichero de mil líneas es difícil de revisar sea
 * cual sea su forma, y no se arregla moviendo llaves de sitio.
 *
 *   node scripts/check-smells.mjs             # contrasta contra el trinquete
 *   node scripts/check-smells.mjs --json      # el mismo informe, legible por máquina
 *   node scripts/check-smells.mjs --selftest  # verifica el cálculo con fuentes fabricadas
 *   node scripts/check-smells.mjs --update    # sube el trinquete si la medición lo permite
 *
 * Como el de cobertura, el trinquete **solo baja** —es un máximo, así que apretarlo es bajarlo—
 * y aflojarlo es una decisión humana que se edita a mano y queda en el historial. Es un gate
 * rápido porque lee ficheros y cuenta líneas: no ejecuta nada.
 *
 * Node >= 18, sin dependencias.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = join(ROOT, '.sdd', 'smells.json');
const args = process.argv.slice(2);
const json = args.includes('--json');

function configuracion() {
  if (!existsSync(CONFIG)) return { version: 1, incluir: ['scripts/', '.sdd/hooks/'], maxLineas: null, maxLineasFuncion: null };
  return JSON.parse(readFileSync(CONFIG, 'utf8'));
}

/**
 * Techo efectivo de un trinquete. `null` significa «todavía sin calibrar»: una instalación nueva
 * no puede heredar el techo medido en otro repositorio, y bloquear el primer día con un número
 * ajeno es la forma más rápida de que alguien desactive el gate entero.
 */
const techo = (v) => (typeof v === 'number' && v > 0 ? v : Infinity);

/** Ficheros versionados que entran en la medida. */
function ficheros(conf) {
  const r = spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  return r.stdout.split('\n')
    .map((s) => s.trim().replaceAll('\\', '/'))
    .filter(Boolean)
    .filter((f) => (conf.incluir || []).some((p) => f.startsWith(p)))
    .filter((f) => f.endsWith('.mjs') || f.endsWith('.js'));
}

/**
 * Longitud de cada función de nivel superior, contada por llaves. Ignora llaves dentro de
 * cadenas o comentarios de línea, que es donde una cuenta ingenua se despista. No pretende ser
 * un analizador sintáctico: cuando dude, cuenta de menos.
 */
export function funcionesLargas(fuente, maximo) {
  const lineas = fuente.split('\n');
  const largas = [];
  let actual = null;
  let profundidad = 0;
  for (let i = 0; i < lineas.length; i++) {
    const cruda = lineas[i];
    // Fuera cadenas y comentarios antes de contar llaves.
    const limpia = cruda
      .replace(/'(\\.|[^'\\])*'/g, "''")
      .replace(/"(\\.|[^"\\])*"/g, '""')
      .replace(/`(\\.|[^`\\])*`/g, '``')
      .replace(/\/\/.*$/, '');
    if (!actual && /^\s*(export\s+)?(async\s+)?function\s+([A-Za-z_$][\w$]*)/.test(limpia)) {
      actual = { nombre: RegExp.$3, desde: i + 1 };
      profundidad = 0;
    }
    if (!actual) continue;
    profundidad += (limpia.match(/\{/g) || []).length;
    profundidad -= (limpia.match(/\}/g) || []).length;
    if (profundidad <= 0 && i + 1 > actual.desde) {
      const largo = i + 1 - actual.desde + 1;
      if (largo > maximo) largas.push({ funcion: actual.nombre, lineas: largo, desde: actual.desde });
      actual = null;
    }
  }
  return largas;
}

function medir() {
  const conf = configuracion();
  const informe = [];
  let mayor = 0;
  let mayorFuncion = 0;
  for (const f of ficheros(conf)) {
    const fuente = readFileSync(join(ROOT, f), 'utf8');
    const total = fuente.split('\n').length;
    const largas = funcionesLargas(fuente, techo(conf.maxLineasFuncion));
    mayor = Math.max(mayor, total);
    // La mayor función se mide siempre, no solo cuando incumple: el trinquete se aprieta desde
    // lo observado, y para eso hace falta el observado completo.
    for (const l of funcionesLargas(fuente, 0)) mayorFuncion = Math.max(mayorFuncion, l.lineas);
    if (total > techo(conf.maxLineas) || largas.length) informe.push({ fichero: f, lineas: total, funciones: largas });
  }
  return { conf, informe, mayor, mayorFuncion };
}

// ─── autotest ────────────────────────────────────────────────────────────────
if (args.includes('--selftest')) {
  const fallos = [];
  const cuerpo = (n) => Array.from({ length: n }, (_, i) => `  const x${i} = ${i};`).join('\n');
  const larga = `function grande() {\n${cuerpo(20)}\n}\n`;
  if (funcionesLargas(larga, 10).length !== 1) fallos.push('una función larga debería detectarse');
  if (funcionesLargas(larga, 50).length !== 0) fallos.push('bajo el umbral no debería haber hallazgo');
  const conLlaveEnCadena = 'function f() {\n  const s = "{";\n  return s;\n}\n';
  if (funcionesLargas(conLlaveEnCadena, 2).length !== 1) fallos.push('una llave dentro de una cadena no debería descuadrar la cuenta');
  const conComentario = 'function g() {\n  // }\n  return 1;\n}\n';
  if (funcionesLargas(conComentario, 2).length !== 1) fallos.push('una llave comentada no debería cerrar la función');
  const detalle = funcionesLargas(larga, 10)[0];
  if (!detalle || detalle.funcion !== 'grande' || !detalle.desde) fallos.push('el hallazgo no nombra la función ni dónde empieza');
  if (funcionesLargas(larga, techo(null)).length !== 0) fallos.push('un trinquete sin calibrar no debería señalar nada');
  if (techo(0) !== Infinity || techo(-5) !== Infinity) fallos.push('un techo no positivo debe leerse como sin calibrar');
  if (json) console.log(JSON.stringify({ ok: fallos.length === 0, fallos }, null, 2));
  else console.log(fallos.length ? `✗ ${fallos.join('\n✗ ')}` : '✅ El detector de tamaño cuenta lo que dice contar.');
  process.exit(fallos.length ? 1 : 0);
}

// ─── medición ────────────────────────────────────────────────────────────────
const { conf, informe, mayor, mayorFuncion } = medir();

if (args.includes('--update')) {
  const nuevo = {
    ...conf,
    maxLineas: Math.min(techo(conf.maxLineas), Math.max(mayor, 1) + (conf.margen ?? 0)),
    maxLineasFuncion: Math.min(techo(conf.maxLineasFuncion), Math.max(mayorFuncion, 1) + (conf.margen ?? 0)),
    medido: { mayorFichero: mayor, mayorFuncion },
    actualizado: new Date().toISOString().slice(0, 10),
  };
  writeFileSync(CONFIG, `${JSON.stringify(nuevo, null, 2)}\n`, 'utf8');
  console.log(`Trinquete de tamaño: fichero ${nuevo.maxLineas} · función ${nuevo.maxLineasFuncion}`);
  process.exit(0);
}

const ok = informe.length === 0;
const sinCalibrar = techo(conf.maxLineas) === Infinity || techo(conf.maxLineasFuncion) === Infinity;
if (json) {
  console.log(JSON.stringify({ ok, sinCalibrar, maxLineas: conf.maxLineas, maxLineasFuncion: conf.maxLineasFuncion, mayor, mayorFuncion, informe }, null, 2));
} else if (sinCalibrar) {
  console.log(`ℹ Trinquete sin calibrar · mayor fichero ${mayor} línea(s) · mayor función ${mayorFuncion}.`);
  console.log('   Ejecuta `node scripts/check-smells.mjs --update` para fijar el techo desde lo que este proyecto mide hoy.');
} else if (ok) {
  console.log(`✅ Tamaño dentro del trinquete · mayor fichero ${mayor} línea(s) (máx ${conf.maxLineas}) · mayor función ${mayorFuncion} (máx ${conf.maxLineasFuncion}).`);
  console.log('   Mide tamaño, no complejidad: es una señal pobre pero que no se puede maquillar reordenando.');
} else {
  console.log(`✗ ${informe.length} fichero(s) por encima del trinquete de tamaño:\n`);
  for (const f of informe) {
    if (f.lineas > conf.maxLineas) console.log(`  · ${f.fichero} — ${f.lineas} líneas (máx ${conf.maxLineas})`);
    for (const fn of f.funciones) {
      console.log(`  · ${f.fichero}:${fn.desde} — función ${fn.funcion}(), ${fn.lineas} líneas (máx ${conf.maxLineasFuncion})`);
    }
  }
  console.log('\nParte el fichero o la función, o afloja el trinquete a mano en .sdd/smells.json dejando dicho por qué.');
}
process.exit(ok ? 0 : 1);
