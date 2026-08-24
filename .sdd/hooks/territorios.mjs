/**
 * Regla de territorio — quién puede escribir dónde.
 *
 * Vive fuera del hook a propósito. Mientras la decisión estaba dentro de
 * `guard-write.mjs`, mezclada con la lectura del protocolo de cada entorno, solo se podía
 * probar simulando un host; y como los tests que lo intentaban miraban una clave que no
 * existía, en la práctica no se probó nunca. Aquí es una función sin efectos: se dirige
 * con una tabla de casos y lo que se verifica es exactamente lo que decide el hook,
 * porque el hook llama a esto.
 *
 * Sin dependencias. Node >= 18.
 */
import { globARegExp } from './_lib.mjs';

/** Los cuatro modos admitidos, del más permisivo al más restrictivo. */
export const MODOS = ['off', 'audit', 'ask', 'deny'];

/**
 * Normaliza una ruta antes de compararla con un patrón.
 *
 * Sin esto, `docs\architecture\x.md` y `docs/specs/../architecture/x.md` esquivarían un
 * territorio que sí cubre `docs/architecture/**`. La comparación de rutas es el punto
 * donde estas guardas se eluden por accidente.
 */
export function normalizarRuta(ruta) {
  const bruta = String(ruta || '').replace(/\\/g, '/');
  const segmentos = [];
  for (const parte of bruta.split('/')) {
    if (parte === '' || parte === '.') continue;
    if (parte === '..') {
      if (segmentos.length) segmentos.pop();
      continue; // salir de la raíz no produce una ruta que este reparto pueda cubrir
    }
    segmentos.push(parte);
  }
  return segmentos.join('/');
}

/**
 * Lee el reparto y decide en qué modo se opera.
 *
 * La ausencia y la corrupción no son lo mismo. Un proyecto que todavía no reparte
 * territorios no debe bloquearse: `off`. Un reparto presente que no se entiende sí, porque
 * un mapa ilegible no puede interpretarse como permiso.
 */
export function cargarTerritorios(texto) {
  if (texto === null || texto === undefined || String(texto).trim() === '') {
    return { ok: true, modo: 'off', config: null, motivo: 'no hay reparto declarado' };
  }

  let cfg;
  try {
    cfg = JSON.parse(String(texto));
  } catch {
    return { ok: false, modo: 'deny', config: null, motivo: 'el reparto no es JSON válido' };
  }

  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    return { ok: false, modo: 'deny', config: null, motivo: 'el reparto no es un objeto' };
  }
  if (!Array.isArray(cfg.territories)) {
    return { ok: false, modo: 'deny', config: cfg, motivo: 'el reparto no declara la lista `territories`' };
  }
  if (!MODOS.includes(cfg.modo)) {
    return { ok: false, modo: 'deny', config: cfg, motivo: `modo desconocido: ${JSON.stringify(cfg.modo)}` };
  }

  return { ok: true, modo: cfg.modo, config: cfg, motivo: '' };
}

/** Territorios en forma canónica, tolerando el formato antiguo por objeto. */
function territoriosDe(config) {
  if (Array.isArray(config?.territories)) {
    return config.territories.map((t, i) => ({
      nombre: t.name || `territory-${i + 1}`,
      duenos: [t.agent].filter(Boolean),
      patrones: Array.isArray(t.paths) ? t.paths : [],
    }));
  }
  return Object.entries(config?.territorios || {}).map(([nombre, t]) => ({
    nombre,
    duenos: t.duenos || [],
    patrones: t.patrones || [],
  }));
}

/**
 * Decide si `agente` puede escribir en `ruta`.
 *
 * La regla es «no entres en el territorio de otro», no «quédate en el tuyo»: una ruta que no
 * pertenece a nadie se permite. En un repositorio recién creado nadie sabe todavía dónde vive
 * cada cosa, y una guarda que bloquea lo desconocido se desactiva el primer día.
 *
 * @returns {{decision:'allow'|'ask'|'deny', motivo:string, territorio?:string, dueno?:string}}
 */
export function decidirTerritorio({ agente, ruta, modo, config }) {
  const efectivo = MODOS.includes(modo) ? modo : 'deny';

  if (efectivo === 'off' || efectivo === 'audit') {
    return { decision: 'allow', motivo: `reparto en modo \`${efectivo}\`: observa, no bloquea` };
  }
  // Sin agente identificado es el hilo principal —la persona y su agente—, no un especialista.
  if (!agente) return { decision: 'allow', motivo: 'sin subagente activo' };
  if ((config?.coordinadores || []).includes(agente)) {
    return { decision: 'allow', motivo: `\`${agente}\` coordina: delega, no ocupa territorio` };
  }

  const objetivo = normalizarRuta(ruta);
  if (!objetivo) return { decision: 'allow', motivo: 'sin ruta que evaluar' };

  for (const t of territoriosDe(config)) {
    if (t.duenos.includes(agente)) continue;
    if (!t.patrones.some((p) => globARegExp(p).test(objetivo))) continue;

    const dueno = t.duenos[0] || null;
    return {
      decision: efectivo,
      territorio: t.nombre,
      dueno,
      motivo:
        `\`${objetivo}\` es territorio de **${t.nombre}** (${t.duenos.join(', ') || 'sin dueño declarado'}) ` +
        `y quien escribe es **${agente}**.\n` +
        `Cada capa tiene su procedimiento —puertas de entrada, ciclo TDD y comprobaciones propias— y ` +
        `saltárselo es la forma habitual de colar un fallo. Devuelve el control a quien te invocó y que ` +
        `delegue en el especialista.\n` +
        `Si el reparto es incorrecto, se corrige en \`.sdd/territories.json\`, no ignorándolo.`,
    };
  }

  return { decision: 'allow', motivo: 'la ruta no pertenece a ningún territorio ajeno' };
}
