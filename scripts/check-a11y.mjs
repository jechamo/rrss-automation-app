#!/usr/bin/env node
/**
 * check-a11y — auditoría de accesibilidad de las páginas que este repositorio publica.
 *
 * El gate `a11y` estuvo declarado inaplicable durante nueve specs con el motivo "no hay
 * superficie visual". Era cierto cuando se escribió. Después el repositorio empezó a publicar
 * un sitio en GitHub Pages y el motivo caducó sin que nadie lo revisara. Ese es exactamente el
 * defecto que la spec 014 persigue: una declaración de ausencia que envejece en silencio pesa
 * más que no haberla escrito, porque da la apariencia de una decisión tomada.
 *
 *   node scripts/check-a11y.mjs             # audita site/
 *   node scripts/check-a11y.mjs --json      # el mismo informe, legible por máquina
 *   node scripts/check-a11y.mjs --dir <ruta>  # audita otro directorio
 *   node scripts/check-a11y.mjs --selftest  # verifica las reglas contra casos fabricados
 *
 * **Qué comprueba y qué no.** Comprueba lo que se puede decidir leyendo el marcado: idioma
 * declarado, título no vacío, alternativa textual en imágenes informativas, existencia de un
 * punto de referencia principal, jerarquía de encabezados sin saltos y nombre accesible en los
 * controles de formulario. No comprueba contraste calculado, foco visible, orden de tabulación
 * ni nada que dependa de un navegador o del árbol de accesibilidad ya construido: eso exigiría
 * una dependencia pesada y este artefacto se compromete a no tenerla. Lo que no se comprueba se
 * declara en `docs/quality/TEST-STRATEGY.md` con su clase de ausencia, no se omite.
 *
 * El análisis es por expresión regular sobre el marcado, sin árbol DOM. Eso basta para las seis
 * reglas anteriores sobre HTML estático escrito a mano, y se rompería sobre marcado generado o
 * con contenido inyectado por script. Si el sitio deja de ser estático, esta herramienta deja
 * de ser suficiente y hay que decirlo, no ampliarla a base de parches.
 *
 * Node >= 18, sin dependencias.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const json = args.includes('--json');
const iDir = args.indexOf('--dir');
const DIR = iDir >= 0 && args[iDir + 1] ? resolve(args[iDir + 1]) : join(ROOT, 'site');

/** Atributo de una etiqueta, o `null` si no está. Acepta comillas simples, dobles o ninguna. */
function atributo(etiqueta, nombre) {
  const m = etiqueta.match(new RegExp(`\\s${nombre}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? '';
}

/** Todas las etiquetas de apertura de un nombre dado. */
function etiquetas(html, nombre) {
  return [...html.matchAll(new RegExp(`<${nombre}\\b[^>]*>`, 'gi'))].map((m) => m[0]);
}

/**
 * Audita un documento y devuelve la lista de hallazgos. Cada hallazgo nombra la regla, el
 * elemento concreto y qué hacer: un informe que solo dice "falla a11y" obliga a reinvestigar
 * lo que la herramienta ya sabe.
 */
export function auditar(html, pagina = '') {
  const hallazgos = [];
  const añade = (regla, elemento, mensaje) => hallazgos.push({ pagina, regla, elemento, mensaje });

  // WCAG 3.1.1 — el idioma decide la voz del lector de pantalla y la separación silábica.
  const etiquetaHtml = (html.match(/<html\b[^>]*>/i) || [''])[0];
  const lang = atributo(etiquetaHtml, 'lang');
  if (!lang || !lang.trim()) {
    añade('idioma', '<html>', 'declara el idioma con lang="es" para que el lector de pantalla use la voz correcta');
  }

  // WCAG 2.4.2 — el título es lo primero que se anuncia y lo que distingue una pestaña.
  const titulo = (html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  if (!titulo || !titulo.trim()) {
    añade('titulo', '<title>', 'da a la página un título no vacío que la distinga de las demás');
  }

  // WCAG 1.1.1 — `alt=""` es correcto y significa "decorativa"; su ausencia deja al lector
  // anunciando el nombre del fichero, que no informa de nada.
  for (const img of etiquetas(html, 'img')) {
    if (atributo(img, 'alt') === null && atributo(img, 'aria-hidden') !== 'true') {
      añade('alternativa', img.slice(0, 80),
        'añade alt con el contenido de la imagen, o alt="" si es decorativa');
    }
  }

  // WCAG 1.3.1 — sin punto de referencia principal no hay forma de saltar la navegación.
  const tieneMain = /<main\b/i.test(html) || /role\s*=\s*["']?main/i.test(html);
  if (!tieneMain) {
    añade('referencia-principal', '<main>',
      'envuelve el contenido en <main> para que se pueda saltar la navegación');
  }

  // WCAG 1.3.1 — la jerarquía de encabezados es el índice del documento; un salto rompe la
  // navegación por encabezados, que es como se recorre una página larga sin ver.
  const niveles = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  let previo = 0;
  for (const nivel of niveles) {
    if (previo && nivel > previo + 1) {
      añade('encabezados', `<h${nivel}>`,
        `no saltes de h${previo} a h${nivel}: la jerarquía es el índice del documento`);
      break; // Un aviso por página basta; encadenarlos solo hace ruido.
    }
    previo = nivel;
  }

  // WCAG 4.1.2 — un control sin nombre se anuncia como "campo de edición" y nada más. Hay dos
  // formas legítimas de dárselo y las dos cuentan: `<label for="id">` apuntando al control, y
  // el label que lo envuelve, que asocia sin necesidad de `id`.
  const conEtiqueta = new Set(
    [...html.matchAll(/<label\b[^>]*\sfor\s*=\s*("([^"]*)"|'([^']*)')/gi)]
      .map((m) => m[2] ?? m[3]),
  );
  const rangosDeLabel = [...html.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/gi)]
    .map((m) => [m.index, m.index + m[0].length]);
  const dentroDeLabel = (posicion) => rangosDeLabel.some(([a, b]) => posicion >= a && posicion < b);

  for (const nombre of ['input', 'select', 'textarea']) {
    for (const m of html.matchAll(new RegExp(`<${nombre}\\b[^>]*>`, 'gi'))) {
      const control = m[0];
      const tipo = (atributo(control, 'type') || '').toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'image'].includes(tipo)) continue;
      const id = atributo(control, 'id');
      const tieneNombre = Boolean(atributo(control, 'aria-label'))
        || Boolean(atributo(control, 'aria-labelledby'))
        || Boolean(atributo(control, 'title'))
        || (id && conEtiqueta.has(id))
        || dentroDeLabel(m.index);
      if (!tieneNombre) {
        añade('nombre-accesible', control.slice(0, 80),
          'asocia un <label for>, envuélvelo en un <label>, o pon aria-label');
      }
    }
  }

  return hallazgos;
}

/** Páginas HTML del directorio, recorrido en profundidad. */
function paginasDe(dir) {
  if (!existsSync(dir)) return [];
  const salida = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...paginasDe(ruta));
    else if (/\.html?$/i.test(nombre)) salida.push(ruta);
  }
  return salida;
}

// ─── autotest ────────────────────────────────────────────────────────────────
// Las reglas se prueban contra marcado fabricado que debe fallar. Un auditor que solo se ha
// visto pasar sobre páginas correctas es indistinguible de uno que no mira nada.
if (args.includes('--selftest')) {
  const fallos = [];
  const reglasDe = (html) => new Set(auditar(html).map((h) => h.regla));

  const mala = reglasDe('<!doctype html><html><head></head><body><h1>A</h1><h3>B</h3>'
    + '<img src="g.png"><input type="text"></body></html>');
  for (const regla of ['idioma', 'titulo', 'alternativa', 'referencia-principal', 'encabezados', 'nombre-accesible']) {
    if (!mala.has(regla)) fallos.push(`la regla ${regla} no detecta su incumplimiento`);
  }

  const buena = reglasDe('<!doctype html><html lang="es"><head><title>T</title></head><body>'
    + '<main><h1>A</h1><h2>B</h2><img src="g.png" alt="">'
    + '<label for="c">C</label><input id="c" type="text"></main></body></html>');
  if (buena.size) fallos.push(`una página correcta no debería tener hallazgos: ${[...buena].join(', ')}`);

  const decorativa = reglasDe('<html lang="es"><head><title>T</title></head><body><main>'
    + '<img src="g.png" aria-hidden="true"></main></body></html>');
  if (decorativa.has('alternativa')) fallos.push('una imagen aria-hidden no necesita alternativa');

  const boton = reglasDe('<html lang="es"><head><title>T</title></head><body><main>'
    + '<input type="submit" value="Enviar"></main></body></html>');
  if (boton.has('nombre-accesible')) fallos.push('un submit con value ya tiene nombre');

  const rol = reglasDe('<html lang="es"><head><title>T</title></head><body>'
    + '<div role="main"><h1>A</h1></div></body></html>');
  if (rol.has('referencia-principal')) fallos.push('role="main" también es un punto de referencia');

  const envolvente = reglasDe('<html lang="es"><head><title>T</title></head><body><main>'
    + '<label><input type="checkbox"><span>Sin hooks</span></label></main></body></html>');
  if (envolvente.has('nombre-accesible')) fallos.push('un label envolvente ya da nombre al control');

  const detalle = auditar('<html><head></head><body></body></html>', 'x.html')[0];
  if (!detalle || detalle.pagina !== 'x.html' || !detalle.mensaje) {
    fallos.push('el hallazgo no nombra la página ni dice qué hacer');
  }

  if (json) console.log(JSON.stringify({ ok: fallos.length === 0, fallos }, null, 2));
  else console.log(fallos.length ? `✗ ${fallos.join('\n✗ ')}` : '✅ Las reglas de accesibilidad detectan lo que dicen detectar.');
  process.exit(fallos.length ? 1 : 0);
}

// ─── auditoría ───────────────────────────────────────────────────────────────
const paginas = paginasDe(DIR);
const hallazgos = [];
for (const ruta of paginas) {
  const relativa = relative(ROOT, ruta).replaceAll('\\', '/');
  hallazgos.push(...auditar(readFileSync(ruta, 'utf8'), relativa));
}

const ok = hallazgos.length === 0;
if (json) {
  console.log(JSON.stringify({
    ok,
    directorio: relative(ROOT, DIR).replaceAll('\\', '/') || '.',
    paginas: paginas.map((p) => relative(ROOT, p).replaceAll('\\', '/')),
    hallazgos,
  }, null, 2));
} else if (ok) {
  console.log(`✅ ${paginas.length} página(s) publicada(s) pasan la auditoría de marcado.`);
  console.log('   No cubre contraste, foco ni orden de tabulación: eso exige un navegador.');
} else {
  console.log(`✗ ${hallazgos.length} hallazgo(s) de accesibilidad en ${paginas.length} página(s):\n`);
  for (const h of hallazgos) {
    console.log(`  · ${h.pagina} — [${h.regla}] ${h.elemento}`);
    console.log(`      ${h.mensaje}`);
  }
}
process.exit(ok ? 0 : 1);
