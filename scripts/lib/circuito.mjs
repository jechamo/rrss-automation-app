/** Clasificación proporcional pura. Node >= 18, sin I/O ni dependencias. */
import { createHash } from 'node:crypto';
import { extname } from 'node:path';

const GRAMMAR = 'portable-path-v1';
const CONTROL_OR_GLOB = /[\u0000-\u001f\u007f*?\[\]{}!]/u;
const ABSOLUTE = /^(?:\/|[a-z]:\/|\\\\|[a-z][a-z0-9+.-]*:)/i;
const AGENT_IDENTITIES = new Set([
  'agent', 'antigravity', 'claude', 'codex', 'copilot', 'cursor', 'gemini',
  'api-designer', 'architect', 'backend-expert', 'bitacora-keeper', 'code-reviewer',
  'database-expert', 'devops-expert', 'docs-writer', 'frontend-expert', 'implementer',
  'orchestrator', 'performance-optimizer', 'planner', 'refactor-specialist', 'release-manager',
  'research-analyst', 'security-auditor', 'spec-analyst', 'test-engineer', 'ux-designer',
]);

function formaOriginal(ruta) {
  return String(ruta ?? '').replace(/\\/g, '/');
}

/** Forma portable: slash, NFC y case-fold independiente del locale. */
export function canonicalizarRuta(ruta) {
  const raw = String(ruta ?? '').normalize('NFC').replace(/\\/g, '/');
  if (raw !== raw.trim()) return null;
  if (!raw || ABSOLUTE.test(raw) || CONTROL_OR_GLOB.test(raw)) return null;
  const parts = raw.split('/');
  if (parts.some((part) => part === '..')) return null;
  const clean = parts.filter((part) => part && part !== '.');
  if (!clean.length) return null;
  return clean.join('/').toLowerCase();
}

/** Alias compatible con la spec 015. */
export const normalizar = canonicalizarRuta;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function canonicalEntries(values, { prefix = false } = {}) {
  return (values || []).map((original) => ({
    original: String(original),
    canonical: canonicalizarRuta(original),
    prefix: prefix && /[\\/]$/.test(String(original)),
  }));
}

function hashInput(input) {
  const proposal = input?.proposal || {};
  return stable({
    schemaVersion: input?.schemaVersion,
    grammar: input?.grammar,
    detectorVersion: input?.detectorVersion,
    proposal: {
      ...proposal,
      light: { ...proposal.light, allowedFiles: canonicalEntries(proposal.light?.allowedFiles) },
      compact: { ...proposal.compact, allowedPrefixes: canonicalEntries(proposal.compact?.allowedPrefixes, { prefix: true }) },
      deniedPrefixes: canonicalEntries(proposal.deniedPrefixes, { prefix: true }),
    },
  });
}

export function hashPropuesta(input) {
  return createHash('sha256').update(JSON.stringify(hashInput(input))).digest('hex');
}

export function esAprobadorHumano(approvedBy) {
  const actor = String(approvedBy || '').trim();
  return actor.length >= 2 && !AGENT_IDENTITIES.has(actor.toLowerCase());
}

export function validarSolicitudAprobacion({ suppliedHash, expectedHash, approvedBy, decisionRef }) {
  const actor = String(approvedBy || '').trim();
  if (!/^[0-9a-f]{64}$/i.test(String(suppliedHash || '')) || suppliedHash !== expectedHash)
    return { ok: false, reason: 'hash obsoleto o inválido' };
  if (!esAprobadorHumano(actor))
    return { ok: false, reason: 'la aprobación debe atribuirse a una persona, no a un agente' };
  if (!/^(?:DEC|ADR)-[A-Za-z0-9._-]+$/.test(String(decisionRef || '')))
    return { ok: false, reason: 'referencia de decisión inválida' };
  return { ok: true, reason: null };
}

function fechaIsoValida(value) {
  const raw = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw)) return false;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === raw;
}

function referenciaExiste(reference, known) {
  if (known === undefined || known === null) return false;
  if (typeof known === 'function') return Boolean(known(reference));
  return known instanceof Set ? known.has(reference) : false;
}

export function intencionCambio(texto) {
  const source = String(texto || '').replace(/\r\n/g, '\n');
  const start = source.indexOf('## Intención sellada');
  const end = source.indexOf('\n## Tareas', start);
  if (start < 0 || end < 0) return null;
  const group = source.match(/^\|\s*Change-Group\s*\|\s*`?([^|`\n]+)`?\s*\|/im)?.[1]?.trim();
  const module = source.match(/^\|\s*M[oó]dulo\s*\|\s*`?([^|`\n]+)`?\s*\|/im)?.[1]?.trim();
  if (!group || !module) return null;
  return `Change-Group: ${group}\nMódulo: ${module}\n${source.slice(start, end)}`
    .trim().replace(/[ \t]+$/gm, '');
}

export function validarCambioCompacto(texto, circuitConfig, { decisionRefs } = {}) {
  const source = String(texto || '').replace(/\r\n/g, '\n');
  if (Buffer.byteLength(source, 'utf8') > 12 * 1024) return { ok: false, reason: 'supera 12 KiB' };
  const criteria = new Set(source.match(/\bCA-\d+\b/g) || []);
  const tasks = new Set(source.match(/\bT-\d{3}-\d+\b/g) || []);
  if (criteria.size < 1 || tasks.size < 1 || criteria.size > 3 || tasks.size > 3)
    return { ok: false, reason: 'requiere entre uno y tres criterios y tareas' };
  if (!/^- Seguridad:\s*`no-sensible`\s*$/im.test(source))
    return { ok: false, reason: 'Seguridad debe ser exactamente no-sensible' };
  if (!/^\|\s*Revisor independiente\s*\|\s*code-reviewer\s*\|/im.test(source))
    return { ok: false, reason: 'requiere code-reviewer independiente' };
  const module = source.match(/^\|\s*M[oó]dulo\s*\|\s*`?([^|`\n]+)`?\s*\|/im)?.[1]?.trim();
  const moduleCanonical = canonicalizarRuta(module);
  if (!moduleCanonical || /pendiente|<|>/i.test(module || '')) return { ok: false, reason: 'módulo no portable o pendiente' };
  const routesBlock = source.match(/### Rutas previstas\s*\n([\s\S]*?)(?=\n###|\n##|$)/i)?.[1] || '';
  const routes = [...routesBlock.matchAll(/^-\s*`([^`]+)`\s*$/gm)].map((match) => match[1]);
  if (!routes.length || routes.some((route) => /[<>]/.test(route) || !canonicalizarRuta(route)))
    return { ok: false, reason: 'rutas previstas ausentes o no portables' };
  if (routes.some((route) => {
    const candidate = canonicalizarRuta(route);
    return candidate !== moduleCanonical && !candidate.startsWith(`${moduleCanonical}/`);
  })) return { ok: false, reason: 'ruta prevista fuera del módulo' };
  const taskLines = source.split('\n').filter((line) => /^- \[[ x]\]\s*T-\d{3}-\d+/i.test(line));
  if (taskLines.length !== tasks.size || taskLines.some((line) =>
    !/RED.*GREEN.*REFACTOR/i.test(line) || !/test:\s*`[^`\s]+::[^`\s]+`/i.test(line)))
    return { ok: false, reason: 'tarea sin RED/GREEN/REFACTOR o test ruta::caso' };
  const intention = intencionCambio(source);
  if (!intention || /<[^>]+>|pendiente/i.test(intention)) return { ok: false, reason: 'intención pendiente o no sellable' };
  if (clasificarCircuito(routes, circuitConfig, { securityImpact: 'no-sensible', decisionRefs }).circuito === 'full')
    return { ok: false, reason: 'rutas fuera de la frontera compact aprobada' };
  return { ok: true, reason: null, module, moduleCanonical, routes, criteria: criteria.size,
    tasks: tasks.size, intention };
}

/** Corrobora el gate durable de change.md, no solo el comando que lo escribió. */
export function validarAprobacionCambio(texto, { decisionRefs } = {}) {
  const source = String(texto || '').replace(/\r\n/g, '\n');
  if (!/^\|\s*Estado\s*\|\s*approved\s*\|/im.test(source))
    return { ok: false, reason: 'cambio pendiente de aprobación' };
  const approvedBy = source.match(/^\|\s*Aprobado por\s*\|\s*([^|\n]+)\|/im)?.[1]?.trim();
  const approvedAt = source.match(/^\|\s*Fecha de aprobación\s*\|\s*([^|\n]+)\|/im)?.[1]?.trim();
  const decisionRef = source.match(/^\|\s*Referencia de decisión\s*\|\s*([^|\n]+)\|/im)?.[1]?.trim();
  const declaredSeal = source.match(/^\|\s*Sello de intención\s*\|\s*`?([0-9a-f]{64})`?\s*\|/im)?.[1];
  const intention = intencionCambio(source);
  const actualSeal = intention ? createHash('sha256').update(intention).digest('hex') : null;
  if (!esAprobadorHumano(approvedBy)) return { ok: false, reason: 'aprobador no humano o ausente' };
  if (!fechaIsoValida(approvedAt)) return { ok: false, reason: 'fecha de aprobación inválida' };
  if (!/^(?:DEC|ADR)-[A-Za-z0-9._-]+$/.test(String(decisionRef || '')) || !referenciaExiste(decisionRef, decisionRefs))
    return { ok: false, reason: 'referencia de decisión inválida o inexistente' };
  if (!declaredSeal || declaredSeal !== actualSeal) return { ok: false, reason: 'sello de intención inválido' };
  return { ok: true, approvedBy, approvedAt, decisionRef, seal: actualSeal };
}

function validateEntries(values, { prefixes = false, exact = false } = {}) {
  if (!Array.isArray(values)) return { ok: false, reason: 'lista ausente' };
  const seen = new Map();
  for (const value of values) {
    const original = String(value);
    const canonical = canonicalizarRuta(original);
    if (!canonical) return { ok: false, reason: `patrón inválido: ${original}` };
    const trailing = /[\\/]$/.test(original);
    if (prefixes && !trailing) return { ok: false, reason: `prefijo sin barra final: ${original}` };
    if (exact && trailing) return { ok: false, reason: `fichero exacto termina en barra: ${original}` };
    if (seen.has(canonical) && seen.get(canonical) !== original)
      return { ok: false, reason: `colisión portable: ${seen.get(canonical)} / ${original}` };
    seen.set(canonical, original);
  }
  return { ok: true };
}

/** Valida estructura, gramática, colisiones, aprobación y sello. */
export function validarCircuito(config, { decisionRefs } = {}) {
  if (!config || typeof config !== 'object') return { ok: false, active: false, reason: 'ausente' };
  if (config.schemaVersion !== 1 || config.grammar !== GRAMMAR || !Number.isInteger(config.detectorVersion))
    return { ok: false, active: false, reason: 'versión o gramática inválida' };
  const proposal = config.proposal;
  if (!proposal || typeof proposal !== 'object') return { ok: false, active: false, reason: 'propuesta ausente' };
  for (const result of [
    validateEntries(proposal.light?.allowedFiles, { exact: true }),
    validateEntries(proposal.compact?.allowedPrefixes, { prefixes: true }),
    validateEntries(proposal.deniedPrefixes, { prefixes: true }),
  ]) if (!result.ok) return { ...result, active: false };
  if (!Array.isArray(proposal.executableExtensions) || !proposal.executableExtensions.every((x) => /^\.[a-z0-9]+$/i.test(x)))
    return { ok: false, active: false, reason: 'extensiones ejecutables inválidas' };
  if (!Array.isArray(proposal.sensitiveSegments) || !proposal.sensitiveSegments.every((x) => /^[a-z0-9._-]+$/i.test(x)))
    return { ok: false, active: false, reason: 'segmentos sensibles inválidos' };
  const limits = proposal.limits || {};
  if (![limits.modules, limits.criteria, limits.tasks, limits.intentBytes, limits.auditWindow]
    .every((x) => Number.isInteger(x) && x > 0))
    return { ok: false, active: false, reason: 'límites inválidos' };
  if (limits.auditWindow > 100)
    return { ok: false, active: false, reason: 'auditWindow supera el máximo de 100' };
  if (!Number.isFinite(proposal.quota) || proposal.quota < 0 || proposal.quota > 1)
    return { ok: false, active: false, reason: 'cuota inválida' };
  const expected = hashPropuesta(config);
  if (config.proposalHash !== expected) return { ok: false, active: false, reason: 'proposalHash no coincide' };
  if (config.status !== 'approved') return { ok: true, active: false, reason: 'pendiente de aprobación' };
  const approval = config.approval || {};
  const approvalRequest = validarSolicitudAprobacion({ suppliedHash: config.proposalHash,
    expectedHash: expected, approvedBy: approval.approvedBy, decisionRef: approval.decisionRef });
  if (!approvalRequest.ok || !fechaIsoValida(approval.approvedAt) ||
      !referenciaExiste(approval.decisionRef, decisionRefs))
    return { ok: false, active: false, reason: `aprobación inválida: ${approvalRequest.reason || 'fecha o decisión'}` };
  if (!/^[0-9a-f]{40}$/i.test(config.activationCommit || ''))
    return { ok: false, active: false, reason: 'commit de activación inválido' };
  return { ok: true, active: true, reason: null };
}

function coversPrefix(prefix, path) {
  const p = canonicalizarRuta(prefix);
  return Boolean(p) && (path === p || path.startsWith(`${p}/`));
}

function sensitive(path, segments) {
  const parts = path.split('/');
  const reserved = new Set((segments || []).map((x) => String(x).toLowerCase()));
  return parts.some((part) => reserved.has(part));
}

function fileTypeFor(fileTypes, original, canonical) {
  if (!fileTypes) return 'file';
  return fileTypes[canonical] || fileTypes[original] || 'file';
}

/** Clasifica rutas contra un circuit.json aprobado. */
export function clasificarCircuito(rutas, config, options = {}) {
  const list = Array.isArray(rutas) ? rutas.map(String) : [];
  const validity = validarCircuito(config, { decisionRefs: options.decisionRefs });
  if (!list.length || !validity.active)
    return { circuito: 'full', obligan: list, total: list.length, reasons: [validity.reason || 'sin rutas'], modules: [] };

  const proposal = config.proposal;
  const exact = new Set(proposal.light.allowedFiles.map(canonicalizarRuta));
  const executables = new Set(proposal.executableExtensions.map((x) => x.toLowerCase()));
  const modules = new Set();
  const obligan = [];
  const reasons = [];
  let level = 'light';
  const exactOriginal = new Map(proposal.light.allowedFiles.map((value) => [canonicalizarRuta(value), formaOriginal(value)]));
  const portable = new Map();
  for (const original of [...(options.trackedPaths || []), ...list]) {
    const canonical = canonicalizarRuta(original);
    if (!canonical) continue;
    const form = formaOriginal(original);
    if (portable.has(canonical) && portable.get(canonical) !== form)
      return { circuito: 'full', obligan: list, total: list.length,
        reasons: [`colisión portable: ${portable.get(canonical)} / ${form}`], modules: [] };
    portable.set(canonical, form);
  }

  for (const original of list) {
    const path = canonicalizarRuta(original);
    if (!path) { obligan.push(original); reasons.push(`${original}: ruta inválida`); continue; }
    if (fileTypeFor(options.fileTypes, original, path) !== 'file') {
      obligan.push(original); reasons.push(`${original}: tipo no regular`); continue;
    }
    if (proposal.deniedPrefixes.some((p) => coversPrefix(p, path)) || sensitive(path, proposal.sensitiveSegments)) {
      obligan.push(original); reasons.push(`${original}: ruta sensible o prohibida`); continue;
    }
    const extension = extname(path).toLowerCase();
    const matchedModule = proposal.compact.allowedPrefixes.find((p) => coversPrefix(p, path));
    if (exact.has(path) && !executables.has(extension)) {
      if (exactOriginal.get(path) !== formaOriginal(original)) {
        obligan.push(original); reasons.push(`${original}: caja distinta del fichero exacto aprobado`); continue;
      }
      if (options.behaviorChanged) level = 'compact';
      continue;
    }
    if (matchedModule) {
      const originalPrefix = formaOriginal(matchedModule);
      const originalPath = formaOriginal(original);
      if (originalPath !== originalPrefix.replace(/\/$/, '') && !originalPath.startsWith(originalPrefix)) {
        obligan.push(original); reasons.push(`${original}: caja distinta del módulo compacto aprobado`); continue;
      }
      if (options.securityImpact !== 'no-sensible') {
        obligan.push(original); reasons.push(`${original}: impacto de seguridad no aprobado como no-sensible`); continue;
      }
      level = 'compact';
      modules.add(canonicalizarRuta(matchedModule));
      continue;
    }
    obligan.push(original);
    reasons.push(`${original}: fuera de la frontera aprobada`);
  }
  if (modules.size > (proposal.limits?.modules || 1)) reasons.push('más de un módulo compacto');
  if (obligan.length || modules.size > (proposal.limits?.modules || 1)) level = 'full';
  return { circuito: level, obligan, total: list.length, reasons, modules: [...modules] };
}

/** Compatibilidad pura con lightweight.json; los gates nuevos no la usan para conceder. */
export function esLigero(ruta, frontera) {
  if (!frontera || !Array.isArray(frontera.permitido) || !Array.isArray(frontera.prohibido)) return false;
  const path = canonicalizarRuta(ruta);
  if (!path) return false;
  if (frontera.prohibido.some((p) => coversPrefix(p, path) || canonicalizarRuta(p) === path)) return false;
  return frontera.permitido.some((p) => /[\\/]$/.test(String(p)) ? coversPrefix(p, path) : canonicalizarRuta(p) === path);
}

export function clasificar(rutas, frontera) {
  const list = (rutas || []).map(String);
  const obligan = list.filter((ruta) => !esLigero(ruta, frontera));
  return { circuito: list.length && !obligan.length ? 'light' : 'full', obligan, total: list.length };
}

const RELLENO = [
  /^(cambio|arreglo|fix|ajuste|mejora|update|actualizaci[oó]n|correcci[oó]n|errata|typo)s?\s*(menor|peque[nñ]o|r[aá]pido|trivial|varios?|general|es)?$/i,
  /^(?:varios|otros?|n\/?a|ninguno|motivo|excepci[oó]n|porque s[ií]|hac[ií]a falta|necesario)\.?$/i,
  /pendiente|tbd|todo/i,
];

export function motivoMaterial(texto) {
  const value = String(texto || '').trim();
  return value.length >= 20 && value.split(/\s+/).length >= 4 && !RELLENO.some((re) => re.test(value));
}

export function cuota({ ligeros = 0, total = 0, maximo = 1 } = {}) {
  const proporcion = total > 0 ? Number((ligeros / total).toFixed(3)) : 0;
  return { ligeros, total, proporcion, maximo, superada: total > 0 && proporcion > maximo };
}
