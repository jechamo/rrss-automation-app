#!/usr/bin/env node
/**
 * check-coverage — trinquete de cobertura sin dependencias.
 *
 * Durante dos specs este repositorio declaró que no medía cobertura porque hacerlo exigiría
 * añadir `nyc` o `c8`, y el compromiso de cero dependencias pesaba más. El argumento era
 * correcto entonces y dejó de serlo: V8 recolecta cobertura por su cuenta y Node la vuelca a
 * disco con solo definir `NODE_V8_COVERAGE`. No había dependencia que añadir; había un motivo
 * que había caducado sin que nadie lo revisara. Esa es, en pequeño, la tesis de la spec 014.
 *
 *   node scripts/check-coverage.mjs            # mide y contrasta contra el trinquete
 *   node scripts/check-coverage.mjs --json     # el mismo resultado, legible por máquina
 *   node scripts/check-coverage.mjs --selftest # verifica el cálculo, sin ejecutar suites
 *   node scripts/check-coverage.mjs --explica-fallo  # mide y muestra cómo se ve el rojo
 *   node scripts/check-coverage.mjs --update   # sube el trinquete si la medición lo permite
 *
 * El umbral **solo sube**. Un trinquete que baja solo no es un trinquete, es un adorno: la
 * cobertura se erosiona un poco en cada cambio y nadie llega a ver nunca un rojo. Bajarlo es
 * una decisión humana que se edita a mano en `.sdd/coverage.json` y queda en el historial.
 *
 * Lo que se mide es **línea recorrida**, no comportamiento probado. Un fichero al 100 % puede
 * no aseverar nada. El número sirve para detectar código que ningún test toca jamás, que es un
 * defecto real y detectable; no sirve para afirmar que algo está bien probado.
 *
 * Node >= 18, sin dependencias.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { rutaDeVolcado, lineasSinCubrir, lineasEjecutables, porcentaje } from './lib/coverage-v8.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = join(ROOT, '.sdd', 'coverage.json');
const args = process.argv.slice(2);
const json = args.includes('--json');

function configuracion() {
  if (!existsSync(CONFIG)) {
    return { version: 1, incluir: ['scripts/'], excluir: [], suites: [], umbral: 0, margen: 3 };
  }
  return JSON.parse(readFileSync(CONFIG, 'utf8'));
}

/** ¿Cuenta este fichero para el número? Los arneses de test se excluyen a propósito: medir la
 *  cobertura del propio medidor no informa de nada. */
function cuenta(relativa, conf) {
  const r = relativa.replaceAll('\\', '/');
  if (!(conf.incluir || []).some((p) => r.startsWith(p))) return false;
  if ((conf.excluir || []).some((p) => r.startsWith(p) || r === p)) return false;
  return r.endsWith('.mjs') || r.endsWith('.js');
}

/** Ejecuta las suites declaradas con el recolector de V8 activo y devuelve el directorio. */
function recolectar(conf) {
  const dir = mkdtempSync(join(tmpdir(), 'sdd-cov-'));
  for (const suite of conf.suites || []) {
    // Argumentos ya separados: nunca se construye una línea de comando ni se pasa por shell.
    spawnSync(process.execPath, suite, {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, NODE_V8_COVERAGE: dir, SDD_COVERAGE: '1' },
    });
  }
  return dir;
}

/** Agrega todos los volcados de un directorio en un mapa fichero → líneas. */
function agregar(dir, conf) {
  const porFichero = new Map();
  for (const nombre of readdirSync(dir)) {
    if (!nombre.endsWith('.json')) continue;
    let volcado;
    try {
      volcado = JSON.parse(readFileSync(join(dir, nombre), 'utf8'));
    } catch {
      continue; // Un volcado truncado no invalida los demás.
    }
    for (const entrada of volcado.result || []) {
      const relativa = rutaDeVolcado(entrada.url, ROOT);
      if (!relativa || !cuenta(relativa, conf)) continue;
      const absoluta = join(ROOT, relativa);
      if (!existsSync(absoluta)) continue;
      // La fuente se lee como cadena: los desplazamientos de V8 indexan unidades UTF-16, no
      // bytes, y en un repositorio en español la diferencia aparece en la primera tilde.
      const fuente = readFileSync(absoluta, 'utf8');
      const rangos = (entrada.functions || []).flatMap((f) => f.ranges || []);
      const actual = porFichero.get(relativa) || {
        ejecutables: lineasEjecutables(fuente),
        sinCubrir: null,
      };
      const sinCubrir = lineasSinCubrir(fuente, rangos);
      // Varios procesos miden el mismo fichero: una línea solo está sin cubrir si ninguno la
      // recorrió, así que las ausencias se intersecan, no se acumulan.
      actual.sinCubrir = actual.sinCubrir === null
        ? sinCubrir
        : new Set([...actual.sinCubrir].filter((l) => sinCubrir.has(l)));
      porFichero.set(relativa, actual);
    }
  }
  return porFichero;
}

function medir() {
  const conf = configuracion();
  const dir = recolectar(conf);
  let porFichero;
  try {
    porFichero = agregar(dir, conf);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const ficheros = [];
  let cubiertas = 0;
  let ejecutables = 0;
  for (const [relativa, datos] of porFichero) {
    const faltan = [...(datos.sinCubrir || new Set())].filter((l) => datos.ejecutables.has(l));
    const total = datos.ejecutables.size;
    cubiertas += total - faltan.length;
    ejecutables += total;
    ficheros.push({
      fichero: relativa,
      ejecutables: total,
      sinCubrir: faltan.length,
      porcentaje: porcentaje({ cubiertas: total - faltan.length, ejecutables: total }),
    });
  }
  ficheros.sort((a, b) => b.sinCubrir - a.sinCubrir);
  return { conf, ficheros, cubiertas, ejecutables, medido: porcentaje({ cubiertas, ejecutables }) };
}

/** El texto del rojo. Nombra el número, el umbral y quién lo está bajando: sin esas tres cosas
 *  el fallo obliga a reinvestigar lo que el propio gate ya sabe. */
function textoDeFallo({ medido, conf, ficheros }, umbral) {
  const peores = ficheros.filter((f) => f.sinCubrir > 0).slice(0, 5);
  const lineas = [
    `✗ Cobertura ${medido} % · umbral vigente ${umbral} % · faltan ${Math.round((umbral - medido) * 10) / 10} puntos.`,
    '',
    'Los ficheros que más la bajan:',
    ...peores.map((f) => `  · ${f.fichero} — ${f.porcentaje} % · ${f.sinCubrir} línea(s) sin recorrer`),
    '',
    `Sube la cobertura de esos ficheros, o revisa el umbral en .sdd/coverage.json (margen ${conf.margen ?? 0}).`,
    'Bajar el umbral es una decisión humana: se edita a mano y queda en el historial.',
  ];
  return lineas.join('\n');
}

// ─── autotest ────────────────────────────────────────────────────────────────
// Verifica el cálculo contra casos fabricados, no contra la cobertura real de hoy: aseverar el
// número de este repositorio convertiría cualquier refactor en un fallo espurio.
if (args.includes('--selftest')) {
  const fallos = [];
  const fuente = 'const a = 1;\nfunction b() {\n  return 2;\n}\n';
  const sinCubrir = lineasSinCubrir(fuente, [{ startOffset: 13, endOffset: 40, count: 0 }]);
  if (!sinCubrir.has(2) || sinCubrir.has(1)) fallos.push('el rango sin recorrer no marca las líneas esperadas');
  if (porcentaje({ cubiertas: 0, ejecutables: 0 }) !== 0) fallos.push('sin nada medido el porcentaje debería ser 0');
  if (porcentaje({ cubiertas: 1, ejecutables: 4 }) !== 25) fallos.push('el porcentaje no cuadra');
  if (rutaDeVolcado('file:///tmp/otro/a.mjs', '/tmp/repo') !== null) fallos.push('una ruta de fuera no se descarta');
  const conf = { incluir: ['scripts/'], excluir: ['scripts/test-'] };
  if (cuenta('scripts/test-hooks.mjs', conf)) fallos.push('el arnés de test no debería contar');
  if (!cuenta('scripts/check-sdd.mjs', conf)) fallos.push('un script propio debería contar');
  const texto = textoDeFallo(
    { medido: 10, conf: { margen: 3 }, ficheros: [{ fichero: 'scripts/x.mjs', porcentaje: 10, sinCubrir: 9 }] },
    50,
  );
  if (!/umbral/i.test(texto) || !/scripts\/x\.mjs/.test(texto)) fallos.push('el texto de fallo no explica qué falta');
  if (json) console.log(JSON.stringify({ ok: fallos.length === 0, fallos }, null, 2));
  else console.log(fallos.length ? `✗ ${fallos.join('\n✗ ')}` : '✅ El cálculo de cobertura se comporta como se documenta.');
  process.exit(fallos.length ? 1 : 0);
}

// ─── medición ────────────────────────────────────────────────────────────────
const resultado = medir();
const umbralDeclarado = resultado.conf.umbral ?? 0;

if (args.includes('--explica-fallo')) {
  // Muestra el rojo por el mismo camino de código que lo produciría de verdad, para que el
  // texto sea verificable sin tener que romper la cobertura a propósito.
  console.log(textoDeFallo(resultado, 100));
  process.exit(0);
}

if (args.includes('--update')) {
  const propuesto = Math.max(umbralDeclarado, Math.round((resultado.medido - (resultado.conf.margen ?? 0)) * 10) / 10);
  const nuevo = { ...resultado.conf, umbral: propuesto, medido: resultado.medido, actualizado: new Date().toISOString().slice(0, 10) };
  const { writeFileSync } = await import('node:fs');
  writeFileSync(CONFIG, `${JSON.stringify(nuevo, null, 2)}\n`, 'utf8');
  console.log(`Trinquete: medido ${resultado.medido} % · umbral ${propuesto} %`);
  process.exit(0);
}

const pasa = resultado.medido >= umbralDeclarado;
// Una instalación nueva llega sin suites declaradas. Medir cero y decir que va bien sería
// mentir; el gate avisa de que todavía no mide nada en vez de fingir un verde.
const sinCalibrar = (resultado.conf.suites || []).length === 0;
if (json) {
  console.log(JSON.stringify({
    ok: pasa,
    sinCalibrar,
    medido: resultado.medido,
    umbral: umbralDeclarado,
    ejecutables: resultado.ejecutables,
    cubiertas: resultado.cubiertas,
    ficheros: resultado.ficheros,
  }, null, 2));
} else if (sinCalibrar) {
  console.log('ℹ Cobertura sin calibrar: .sdd/coverage.json no declara ninguna suite todavía.');
  console.log('   Declara en `suites` los comandos de prueba del proyecto y ejecuta `--update` para fijar el umbral desde lo medido.');
} else if (pasa) {
  console.log(`✅ Cobertura ${resultado.medido} % sobre ${resultado.ejecutables} línea(s) · umbral ${umbralDeclarado} %.`);
  console.log('   Mide línea recorrida, no comportamiento probado.');
} else {
  console.log(textoDeFallo(resultado, umbralDeclarado));
}
process.exit(pasa ? 0 : 1);
