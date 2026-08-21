/**
 * Parser JSONC mínimo que elimina comentarios y comas finales solo fuera de cadenas.
 * Los regex globales no sirven aquí porque las rutas glob pueden parecer comentarios.
 */
export function parseJsonc(texto) {
  const fuente = String(texto ?? '');
  let limpio = '';
  let enCadena = false;
  let escapado = false;

  for (let i = 0; i < fuente.length; i += 1) {
    const char = fuente[i];
    const siguiente = fuente[i + 1];
    if (enCadena) {
      limpio += char;
      if (escapado) escapado = false;
      else if (char === '\\') escapado = true;
      else if (char === '"') enCadena = false;
      continue;
    }
    if (char === '"') {
      enCadena = true;
      limpio += char;
    } else if (char === '/' && siguiente === '/') {
      while (i + 1 < fuente.length && fuente[i + 1] !== '\n') i += 1;
    } else if (char === '/' && siguiente === '*') {
      i += 2;
      while (i < fuente.length && !(fuente[i] === '*' && fuente[i + 1] === '/')) {
        if (fuente[i] === '\n') limpio += '\n';
        i += 1;
      }
      if (i >= fuente.length) throw new Error('comentario JSONC sin cerrar');
      i += 1;
    } else limpio += char;
  }
  if (enCadena) throw new Error('cadena JSON sin cerrar');

  let sinComasFinales = '';
  enCadena = false;
  escapado = false;
  for (let i = 0; i < limpio.length; i += 1) {
    const char = limpio[i];
    if (enCadena) {
      sinComasFinales += char;
      if (escapado) escapado = false;
      else if (char === '\\') escapado = true;
      else if (char === '"') enCadena = false;
      continue;
    }
    if (char === '"') enCadena = true;
    if (char === ',') {
      let cursor = i + 1;
      while (/\s/.test(limpio[cursor] || '')) cursor += 1;
      if (limpio[cursor] === '}' || limpio[cursor] === ']') continue;
    }
    sinComasFinales += char;
  }
  return JSON.parse(sinComasFinales);
}
