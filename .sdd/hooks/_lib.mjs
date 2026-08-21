/**
 * Utilidades compartidas por los hooks.
 * Node >= 18. Sin dependencias externas a propósito: un hook que necesita `npm install`
 * es un hook que algún día no se ejecuta.
 */
import {
  readFileSync, existsSync, readdirSync, mkdirSync, appendFileSync, writeFileSync,
  lstatSync, realpathSync, openSync, closeSync, fstatSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

/** Lee el JSON que Claude Code envía por stdin. Devuelve {} si no hay nada legible. */
export async function readHookInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Los gates se pueden desactivar temporalmente con SDD_GATES=off. */
export const gatesEnabled = () => process.env.SDD_GATES !== 'off';

/**
 * Patrones de secreto y rutas prohibidas, compartidos por el hook local `guard-write.mjs` y por
 * el escáner de CI `scripts/scan-secrets.mjs`.
 *
 * Viven aquí, en un solo sitio, porque si el hook y CI divergen uno de los dos miente — y el que
 * miente siempre es el que no se ejecuta en tu máquina. En hosts sin hooks (Lovable y
 * equivalentes) CI es la única protección que queda.
 */
export const PATRONES_SECRETO = [
  { re: /\b(sk-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_-]{20,})\b/, que: 'clave de API tipo OpenAI/Anthropic' },
  { re: /\bghp_[A-Za-z0-9]{30,}\b/, que: 'token de GitHub' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, que: 'access key de AWS' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, que: 'clave privada' },
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, que: 'JWT con aspecto real' },
  { re: /(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"\s${}]{12,}['"]/i, que: 'credencial literal' },
];

/** Ficheros que nunca deben entrar al repositorio, por lo que son. */
export const RUTAS_PROHIBIDAS = [
  { re: /(^|\/)\.env($|\.)/, motivo: 'Los ficheros .env contienen secretos.' },
  { re: /(^|\/)(secrets?|credentials?)\//i, motivo: 'Directorio de secretos.' },
  { re: /\.(pem|key|p12|pfx|keystore|jks)$/i, motivo: 'Material criptográfico.' },
  { re: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)/, motivo: 'Clave SSH privada.' },
];

/** `.env.example` y compañía sí se versionan: documentan nombres, no valores. */
export const esPlantillaEnv = (ruta) => /(^|\/)\.env\.(example|sample|template|dist)$/.test(ruta);

export const projectRoot = (input = {}) => input.cwd || process.cwd();

/**
 * Normaliza la llamada a herramienta entre hosts. Cada uno la envuelve distinto:
 *
 *   Claude Code / Copilot  { tool_name, tool_input: { command, file_path, … } }
 *   Antigravity            { toolCall: { name, args: { … } } }
 *   Cursor                 { command, cwd, … }              ← plano, sin envoltorio
 *
 * Devuelve { herramienta, entrada }. Si no hay envoltorio reconocible, el propio
 * payload es la entrada: es lo que hace Cursor, y asumir un envoltorio que no existe
 * deja la guarda sin datos y permitiéndolo todo en silencio.
 */
export function toolCall(payload = {}) {
  const esAntigravity = payload.toolCall && typeof payload.toolCall === 'object';
  if (esAntigravity) {
    const c = payload.toolCall;
    return {
      herramienta: String(c.name || '').toLowerCase(),
      entrada: c.args && typeof c.args === 'object' ? c.args : {},
    };
  }

  const envoltorio = payload.tool_input ?? payload.toolInput;
  return {
    herramienta: String(payload.tool_name ?? payload.toolName ?? '').toLowerCase(),
    entrada: envoltorio && typeof envoltorio === 'object' ? envoltorio : payload,
  };
}

/** Recolecta recursivamente los valores cuyas claves contengan alguno de los tokens. */
export function valoresPorClave(valor, tokens) {
  const out = [];
  if (Array.isArray(valor)) {
    for (const v of valor) out.push(...valoresPorClave(v, tokens));
  } else if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) {
      const clave = k.toLowerCase().replace(/[_-]/g, '');
      if (tokens.some((t) => clave.includes(t))) {
        if (typeof v === 'string') out.push(v);
        else if (Array.isArray(v)) out.push(...v.filter((x) => typeof x === 'string'));
      }
      if (v && typeof v === 'object') out.push(...valoresPorClave(v, tokens));
    }
  }
  return out;
}

export const rutasDe = (entrada) =>
  valoresPorClave(entrada, ['path', 'file', 'target', 'directory']).map((r) =>
    r.trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/').replace(/^\.\//, ''),
  );

export const comandosDe = (entrada) => valoresPorClave(entrada, ['command', 'cmd']);

/**
 * Busca el primer valor cuya clave coincida **exactamente** con una de las candidatas.
 *
 * A diferencia de `valoresPorClave`, no hace coincidencia parcial: buscar `agent` de forma
 * difusa captura `agentSessionId` y acaba registrando un hash donde debería ir el nombre
 * del agente, que es precisamente el dato que da valor a la bitácora.
 */
export function valorExacto(valor, claves) {
  const buscadas = new Set(claves.map((c) => c.toLowerCase().replace(/[_-]/g, '')));
  if (Array.isArray(valor)) {
    for (const v of valor) {
      const r = valorExacto(v, claves);
      if (r) return r;
    }
    return null;
  }
  if (!valor || typeof valor !== 'object') return null;

  for (const [k, v] of Object.entries(valor)) {
    if (buscadas.has(k.toLowerCase().replace(/[_-]/g, '')) && typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  for (const v of Object.values(valor)) {
    const r = valorExacto(v, claves);
    if (r) return r;
  }
  return null;
}

/**
 * Host de destino. Se pasa como `--host=cursor|antigravity|claude`.
 * Sin flag se asume `claude`, que es el formato de Claude Code y Copilot.
 */
export function hostDestino() {
  const flag = process.argv.find((a) => a.startsWith('--host='));
  return flag ? flag.slice(7) : 'claude';
}

/**
 * Emite una decisión de permiso en el formato que espera cada host.
 *
 * Los tres soportan el mismo modelo de tres niveles —`allow`, `ask`, `deny`—, solo
 * cambia el envoltorio. `ask` es lo que distingue un gate maduro: bloquear un
 * `terraform apply` legítimo frustra; dejarlo pasar sin preguntar, arruina.
 */
export function decide(decision, motivo, host = 'claude') {
  // Compatibilidad: antes el tercer argumento era el booleano `antigravity`.
  const h = host === true ? 'antigravity' : host === false ? 'claude' : host;

  let salida;
  if (h === 'antigravity') {
    salida = { decision: decision === 'ask' ? 'force_ask' : decision, reason: motivo };
  } else if (h === 'cursor') {
    salida = {
      continue: decision !== 'deny',
      permission: decision,
      agentMessage: motivo,
      ...(decision === 'deny' ? { userMessage: motivo } : {}),
    };
  } else if (h === 'codex') {
    // Codex no admite `ask` como decisión de PreToolUse. Convertirlo en `deny` evita
    // que la acción continúe silenciosamente; la persona puede revisarla y reintentarlo.
    salida = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision === 'ask' ? 'deny' : decision,
        permissionDecisionReason: decision === 'ask'
          ? `${motivo} Codex requiere revisión humana y un reintento explícito.`
          : motivo,
      },
    };
  } else {
    salida = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: motivo,
      },
    };
  }
  process.stdout.write(JSON.stringify(salida) + '\n');
  process.exit(0);
}

/** Bloquea la acción: Claude ve el mensaje y corrige. */
export function block(message) {
  process.stderr.write(message + '\n');
  process.exit(2);
}

/** Añade contexto a la conversación (SessionStart / UserPromptSubmit). */
export function inject(text) {
  if (text && text.trim()) process.stdout.write(text.trim() + '\n');
  process.exit(0);
}

export const allow = () => process.exit(0);

export function readIfExists(path) {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
  } catch {
    return null;
  }
}

export function listDirs(path) {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

function rutaConfinadaSinEnlaces(root, path) {
  const rootAbs = resolve(root);
  const target = resolve(path);
  const rel = relative(rootAbs, target);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return false;
  const rootReal = realpathSync(rootAbs);
  let current = rootAbs;
  for (const segment of rel.split(/[\\/]+/).filter(Boolean)) {
    current = join(current, segment);
    let stat;
    try { stat = lstatSync(current); }
    catch (error) {
      if (error?.code === 'ENOENT') continue;
      return false;
    }
    if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink > 1)) return false;
    const realRel = relative(rootReal, realpathSync(current));
    if (realRel === '..' || realRel.startsWith(`..${sep}`) || isAbsolute(realRel)) return false;
  }
  return true;
}

export function appendLine(path, line, root = process.cwd()) {
  try {
    if (!rutaConfinadaSinEnlaces(root, path)) return false;
    const parent = resolve(path, '..');
    mkdirSync(parent, { recursive: true });
    if (!rutaConfinadaSinEnlaces(root, parent) || !rutaConfinadaSinEnlaces(root, path)) return false;
    const fd = openSync(path, 'a', 0o600);
    try {
      const descriptor = fstatSync(fd);
      const pathname = lstatSync(path);
      if (!descriptor.isFile() || pathname.isSymbolicLink() || pathname.nlink > 1 ||
          descriptor.dev !== pathname.dev || descriptor.ino !== pathname.ino) return false;
      appendFileSync(fd, line + '\n', 'utf8');
      return true;
    } finally {
      closeSync(fd);
    }
  } catch {
    return false;
  }
}

/** Extrae únicamente estados declarados dentro de bloques reales `### T-*`. */
function taskStates(tasks) {
  const blocks = String(tasks || '').split(/(?=^###\s+T-[\w-]+\b)/gm)
    .filter((block) => /^###\s+T-[\w-]+\b/m.test(block));
  return blocks.map((block) => {
    const match = block.match(
      /^-\s*(?:\*\*)?Estado(?:\*\*)?\s*:\s*(?:\*\*)?\s*(pendiente|en\s+curso|hecho|bloqueado|cancelado)(?:\s*\*\*)?\s*$/im,
    );
    return match ? match[1].toLowerCase().replace(/\s+/g, ' ') : null;
  });
}

/**
 * Conserva la compatibilidad histórica de `SDD_SPECS_DIR` sin convertir una variable de
 * entorno en una lectura fuera del repositorio. Un valor inválido, absoluto, con traversal o
 * que atraviese un enlace cae al directorio canónico; los hooks nunca siguen esa ruta hostil.
 */
export function specsDirectory(root) {
  const rootAbs = resolve(root);
  const fallback = join(rootAbs, 'docs', 'specs');
  const fallbackSeguro = () => rutaConfinadaSinEnlaces(rootAbs, fallback) ? fallback : null;
  const configured = process.env.SDD_SPECS_DIR;
  if (!configured) return fallbackSeguro();
  if (isAbsolute(configured) || /[\u0000-\u001f\u007f]/.test(configured)) return fallbackSeguro();

  const target = resolve(rootAbs, configured);
  const rel = relative(rootAbs, target);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return fallbackSeguro();

  const rootReal = realpathSync(rootAbs);
  let current = rootAbs;
  for (const segment of rel.split(/[\\/]+/).filter(Boolean)) {
    current = join(current, segment);
    let stat;
    try { stat = lstatSync(current); }
    catch (error) {
      if (error?.code === 'ENOENT') continue;
      return fallbackSeguro();
    }
    if (stat.isSymbolicLink()) return fallbackSeguro();
    const currentReal = realpathSync(current);
    const realRel = relative(rootReal, currentReal);
    if (realRel === '..' || realRel.startsWith(`..${sep}`) || isAbsolute(realRel)) return fallbackSeguro();
  }
  return target;
}

/**
 * Resuelve la atribución sin adivinar. Una spec solo está activa si contiene una tarea
 * explícitamente `pendiente` o `en curso`; si hay varias candidatas, el evento debe ir a la
 * auditoría general con el motivo durable `spec-activa-ambigua`.
 */
export function resolveActiveSpec(root) {
  const specsDir = specsDirectory(root);
  const candidates = [];
  for (const name of listDirs(specsDir)) {
    if (!/^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) continue;
    const tasks = readIfExists(join(specsDir, name, 'tasks.md'));
    if (!tasks) continue;
    const states = taskStates(tasks);
    const total = states.length;
    if (!total) continue;
    const hechas = states.filter((state) => state === 'hecho').length;
    const enCurso = states.filter((state) => state === 'en curso').length;
    const pendientes = states.filter((state) => state === 'pendiente').length;
    if (pendientes || enCurso) candidates.push({
      dir: join(specsDir, name), nombre: name, total, hechas, enCurso, pendientes,
    });
  }
  if (candidates.length === 1) return { spec: candidates[0], reason: null, candidates };
  return {
    spec: null,
    reason: candidates.length ? 'spec-activa-ambigua' : 'sin-spec-activa',
    candidates,
  };
}

/** Compatibilidad para consumidores que solo necesitan la spec inequívoca o `null`. */
export function findActiveSpec(root) {
  return resolveActiveSpec(root).spec;
}

/**
 * Registra un evento en la bitácora de ejecución append-only de la spec activa.
 * Si no hay spec activa, cae a `.sdd/agent-audit.jsonl` para no perder el evento.
 *
 * La narración del chat no demuestra qué subagente trabajó. Esto sí deja rastro.
 */
export function logEjecucion(root, evento) {
  const resolution = resolveActiveSpec(root);
  const spec = resolution.spec;
  const destino = spec
    ? join(spec.dir, 'execution-log.jsonl')
    : join(root, '.sdd', 'agent-audit.jsonl');
  const linea = JSON.stringify({
    ts: new Date().toISOString(),
    ...evento,
    ...(!spec ? {
      atribucion: resolution.reason,
      ...(resolution.candidates.length
        ? { specsCandidatas: resolution.candidates.map((candidate) => candidate.nombre) }
        : {}),
    } : {}),
  });
  if (appendLine(destino, linea, root))
    return { destino, spec: spec?.nombre ?? null, atribucion: resolution.reason };

  const fallback = join(root, '.sdd', 'agent-audit.jsonl');
  const atribucion = spec ? 'ruta-spec-insegura' : 'ruta-auditoria-insegura';
  const lineaFallback = JSON.stringify({
    ts: new Date().toISOString(), ...evento, atribucion,
    ...(spec ? { specCandidata: spec.nombre } : {}),
  });
  if (!spec || !appendLine(fallback, lineaFallback, root))
    throw new Error('No existe un destino de auditoría confinado y seguro.');
  return { destino: fallback, spec: null, atribucion };
}

/**
 * Convierte un patrón tipo glob en expresión regular anclada.
 * Soporta `**` (cualquier profundidad), `*` (dentro de un segmento) y `?`.
 * Sin dependencias: traer un paquete de globs a un hook es traer un fallo futuro.
 */
export function globARegExp(patron) {
  // Se trocea por los comodines en vez de usar marcadores temporales: un carácter
  // centinela invisible en el fuente es un fallo esperando a que alguien copie y pegue.
  const partes = String(patron).split(/(\*\*\/|\*\*|\*|\?)/).filter((s) => s !== '');

  let re = '';
  for (const parte of partes) {
    if (parte === '**/') re += '(?:[^/]*\\/)*'; // cero o más segmentos
    else if (parte === '**') re += '.*';
    else if (parte === '*') re += '[^/]*'; // dentro de un segmento
    else if (parte === '?') re += '[^/]';
    else re += parte.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

// ─────────────────────────────────────────────────────────────────────────────
// Agente activo
//
// `PreToolUse` no dice qué subagente está escribiendo. Sin ese dato no se puede
// impedir que el especialista de datos toque el front: la guarda no sabe quién
// llama. Se resuelve con estado escrito por `SubagentStart`/`SubagentStop`.
//
// Es una pila, no un valor: un subagente puede invocar a otro (2 niveles), y al
// terminar el de dentro manda otra vez el de fuera.
// ─────────────────────────────────────────────────────────────────────────────

const rutaEstado = (root, sesion) =>
  join(root, '.sdd', 'state', `agentes-${(sesion || 'default').replace(/[^\w-]/g, '')}.json`);

function leerPila(root, sesion) {
  const t = readIfExists(rutaEstado(root, sesion));
  if (!t) return [];
  try {
    const v = JSON.parse(t);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function escribirPila(root, sesion, pila) {
  try {
    const p = rutaEstado(root, sesion);
    mkdirSync(resolve(p, '..'), { recursive: true });
    writeFileSync(p, JSON.stringify(pila), 'utf8');
  } catch {
    /* el estado nunca debe romper la sesión */
  }
}

/** Apila el subagente que arranca. */
export function entraAgente(root, sesion, agente) {
  if (!agente || agente === 'desconocido') return;
  const pila = leerPila(root, sesion);
  pila.push(agente);
  escribirPila(root, sesion, pila.slice(-8));
}

/** Desapila el subagente que termina. Quita la última aparición, no el último a secas. */
export function saleAgente(root, sesion, agente) {
  const pila = leerPila(root, sesion);
  const i = agente ? pila.lastIndexOf(agente) : pila.length - 1;
  if (i >= 0) pila.splice(i, 1);
  escribirPila(root, sesion, pila);
}

/** Quién está escribiendo ahora mismo, o null si es el hilo principal. */
export function agenteActivo(root, sesion) {
  const pila = leerPila(root, sesion);
  return pila.length ? pila[pila.length - 1] : null;
}

/** Últimas N entradas (encabezados `## `) de la bitácora. */
export function lastDecisions(root, n = 3) {
  const content = readIfExists(join(root, process.env.SDD_BITACORA || 'docs/bitacora/DECISIONS.md'));
  if (!content) return [];
  return (content.match(/^##\s+.+$/gm) || []).slice(0, n).map((l) => l.replace(/^##\s+/, ''));
}
