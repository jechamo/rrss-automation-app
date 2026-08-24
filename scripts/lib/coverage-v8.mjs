/**
 * coverage-v8 — lectura de los volcados de cobertura que produce Node por sí solo.
 *
 * Este repositorio se compromete a cero dependencias de runtime, y durante dos specs eso se
 * tradujo en no medir cobertura en absoluto. El argumento era correcto cuando medir exigía
 * `nyc` o `c8`. Dejó de serlo: V8 recolecta cobertura de forma nativa y Node la vuelca a disco
 * con solo definir `NODE_V8_COVERAGE`, en todas las versiones que este artefacto ya exige. No
 * hay dependencia que añadir; hay una variable de entorno que definir.
 *
 * Dos trampas de plataforma se dan aquí las dos a la vez, y por eso están resueltas desde el
 * primer momento en lugar de como parche posterior:
 *
 *   1. La URL del volcado llega **percent-encoded**. Una ruta de trabajo con un espacio
 *      —`OneDrive - Bankinter`, por ejemplo— produce `OneDrive%20-%20Bankinter`, así que
 *      compararla contra la raíz sin decodificar no casa nunca y el gate mediría cero
 *      ficheros mientras informa de éxito.
 *   2. Los desplazamientos de V8 indexan la **cadena** del módulo, no su búfer. En un
 *      repositorio escrito en español, contar sobre bytes desalinea todo lo que venga después
 *      del primer acento.
 *
 * Y una consideración de seguridad: las URL de un volcado las escribe el proceso medido, no
 * nosotros. Un volcado ajeno en el directorio bastaría para que el lector abriera ficheros de
 * fuera del árbol si resolviera a ciegas. Por eso `rutaDeVolcado` devuelve `null` para todo lo
 * que no resuelva dentro de la raíz, y quien la usa no lee lo que no pasa por ella.
 *
 * Lo que esto mide es **línea recorrida**, no comportamiento probado. Es un suelo útil —detecta
 * código que ningún test toca jamás— y un techo engañoso. Quien publique el número tiene la
 * obligación de publicar también esta frase.
 *
 * Node >= 18, sin dependencias.
 */

/** Normaliza separadores y resuelve `.` y `..` sin tocar el sistema de ficheros. */
function normalizar(ruta) {
  const partes = ruta.replace(/\\/g, '/').split('/');
  const pila = [];
  for (const parte of partes) {
    if (!parte || parte === '.') continue;
    if (parte === '..') pila.pop();
    else pila.push(parte);
  }
  return pila.join('/');
}

/**
 * Traduce la URL de una entrada de volcado a una ruta relativa a la raíz, o `null` si no
 * corresponde a un fichero propio del repositorio.
 */
export function rutaDeVolcado(url, raiz) {
  if (typeof url !== 'string' || !url.startsWith('file://')) return null;
  let camino = url.slice('file://'.length);
  try {
    camino = decodeURIComponent(camino);
  } catch {
    return null; // Una URL mal formada no se interpreta a la buena de Dios.
  }
  // `file:///C:/x` deja una barra delante de la letra de unidad; en POSIX no sobra nada.
  if (/^\/[A-Za-z]:/.test(camino)) camino = camino.slice(1);
  const absoluta = normalizar(camino);
  const base = normalizar(raiz);
  // La comparación es insensible a mayúsculas porque en Windows `C:/Users` y `c:/users` son el
  // mismo sitio, y una diferencia de capitalización no puede decidir si algo se audita.
  const a = absoluta.toLowerCase();
  const b = base.toLowerCase();
  if (a !== b && !a.startsWith(`${b}/`)) return null;
  return absoluta.slice(base.length + 1);
}

/** Desplazamiento de inicio de cada línea, contado sobre la cadena. */
function iniciosDeLinea(fuente) {
  const inicios = [0];
  for (let i = 0; i < fuente.length; i++) if (fuente[i] === '\n') inicios.push(i + 1);
  return inicios;
}

/** Número de línea (1-indexado) que contiene un desplazamiento dado. */
function lineaDe(inicios, desplazamiento) {
  let bajo = 0;
  let alto = inicios.length - 1;
  while (bajo < alto) {
    const medio = Math.ceil((bajo + alto) / 2);
    if (inicios[medio] <= desplazamiento) bajo = medio;
    else alto = medio - 1;
  }
  return bajo + 1;
}

/**
 * Líneas que quedaron sin recorrer, a partir de los rangos que V8 marca con `count: 0`.
 * Devuelve un `Set` de números de línea 1-indexados.
 */
export function lineasSinCubrir(fuente, rangos) {
  const inicios = iniciosDeLinea(fuente);
  const sinCubrir = new Set();
  for (const rango of rangos || []) {
    if (!rango || rango.count !== 0) continue;
    const desde = lineaDe(inicios, Math.max(0, rango.startOffset));
    const hasta = lineaDe(inicios, Math.min(fuente.length, Math.max(0, rango.endOffset)));
    for (let l = desde; l <= hasta; l++) sinCubrir.add(l);
  }
  return sinCubrir;
}

/**
 * Líneas que cuentan para el denominador: ni vacías, ni comentario evidente, ni cierre de
 * bloque. Es una heurística y se declara como tal; su sesgo es hacia contar de menos, que es
 * el sesgo prudente para un umbral que solo puede subir.
 */
export function lineasEjecutables(fuente) {
  const ejecutables = new Set();
  const lineas = fuente.split('\n');
  let enBloque = false;
  for (let i = 0; i < lineas.length; i++) {
    const t = lineas[i].trim();
    if (enBloque) {
      if (t.includes('*/')) enBloque = false;
      continue;
    }
    if (!t) continue;
    if (t.startsWith('/*')) {
      if (!t.includes('*/')) enBloque = true;
      continue;
    }
    if (t.startsWith('//') || t.startsWith('*')) continue;
    if (t === '}' || t === '};' || t === '})' || t === '});' || t === ']' || t === ');') continue;
    ejecutables.add(i + 1);
  }
  return ejecutables;
}

/** Porcentaje con una decimal. Sin nada medido el resultado es 0, nunca 100. */
export function porcentaje({ cubiertas, ejecutables }) {
  if (!ejecutables) return 0;
  return Math.round((cubiertas / ejecutables) * 1000) / 10;
}
