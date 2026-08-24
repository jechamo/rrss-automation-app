import { createHash, createHmac, randomBytes } from 'node:crypto';
import { closeSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { hostname } from 'node:os';

const FALLBACK = 'node scripts/sdd-project.mjs run --slow --summary-json';
const REUTILIZABLES = new Set(['coverage', 'e2e', 'a11y']);
const MAX_MATERIAL_FILE_BYTES = 64 * 1024 * 1024;
const MAX_MATERIAL_TOTAL_BYTES = 256 * 1024 * 1024;
const MAX_EDITORIAL_ENTRIES = 256;

function normalizarRuta(ruta) {
  return String(ruta || '').normalize('NFC').replaceAll('\\', '/').replace(/^\.\//, '');
}

/** Lista cerrada: son historia de entrega, nunca fuentes ejecutables ni documentación publicada. */
export function esMetadataRelease(ruta) {
  const path = normalizarRuta(ruta);
  if (path === 'CHANGELOG.md' || path === 'docs/bitacora/DECISIONS.md') return true;
  if (/^docs\/specs\/\d{3}-[^/]+\/(?:spec|tasks|evidence)\.md$/.test(path)) return true;
  if (/^docs\/(?:quality|security|design)\/reports\/[^/]+\.md$/.test(path)) return true;
  return false;
}

function contenidoMaterial(path, bytes) {
  if (path === 'CHANGELOG.md' || path === 'docs/bitacora/DECISIONS.md' ||
      /^docs\/(?:quality|security|design)\/reports\/[^/]+\.md$/.test(path) ||
      /^docs\/specs\/\d{3}-[^/]+\/evidence\.md$/.test(path)) return null;
  const text = bytes.toString('utf8');
  if (/^docs\/specs\/\d{3}-[^/]+\/spec\.md$/.test(path))
    return Buffer.from(text.replace(/^\| \*\*Estado\*\* \|.*\|$/gmu, '| **Estado** | <release-state> |'));
  if (/^docs\/specs\/\d{3}-[^/]+\/tasks\.md$/.test(path)) return Buffer.from(text
    .replace(/^\| \*\*Progreso\*\* \|.*\|$/gmu, '| **Progreso** | <release-state> |')
    .replace(/^- \*\*Estado\*\*:\s*.*$/gmu, '- **Estado**: <release-state>'));
  return bytes;
}

function modoEditorial(path) {
  if (path === 'CHANGELOG.md') return 'exists';
  if (path === 'docs/bitacora/DECISIONS.md') return 'insert-after-header';
  if (/^docs\/specs\/\d{3}-[^/]+\/evidence\.md$/.test(path)) return 'append-only';
  if (/^docs\/(?:quality|security|design)\/reports\/[^/]+\.md$/.test(path)) return 'immutable';
  return null;
}

function hashRango(path, start, length) {
  const hasher = createHash('sha256');
  let fd;
  try {
    fd = openSync(path, 'r');
    const chunk = Buffer.allocUnsafe(64 * 1024);
    let position = start;
    let remaining = length;
    while (remaining > 0) {
      const size = Math.min(chunk.length, remaining);
      const bytesRead = readSync(fd, chunk, 0, size, position);
      if (bytesRead <= 0) return null;
      hasher.update(chunk.subarray(0, bytesRead));
      position += bytesRead;
      remaining -= bytesRead;
    }
    return hasher.digest('hex');
  } catch { return null; }
  finally { if (fd !== undefined) closeSync(fd); }
}

export function capturarBaselineEditorial(root) {
  const listed = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (listed.status !== 0) return null;
  const entries = [];
  let totalBytes = 0;
  for (const path of [...new Set((listed.stdout || '').split('\0').filter(Boolean)
    .map((value) => value.replaceAll('\\', '/')))].sort()) {
    const mode = modoEditorial(path);
    if (!mode) continue;
    if (!rutaMaterialSegura(root, path)) return null;
    const stat = lstatSync(join(root, path));
    if (mode === 'exists') { entries.push({ path, mode }); continue; }
    if (stat.size > MAX_MATERIAL_FILE_BYTES || totalBytes + stat.size > MAX_MATERIAL_TOTAL_BYTES) return null;
    totalBytes += stat.size;
    const hash = hashRango(join(root, path), 0, stat.size);
    if (!hash) return null;
    if (mode === 'insert-after-header') {
      const bytes = readFileSync(join(root, path));
      const marker = bytes.indexOf(Buffer.from('\n---\n'));
      if (marker >= 0) {
        const prefixSize = marker + Buffer.byteLength('\n---\n');
        const suffixSize = bytes.length - prefixSize;
        entries.push({ path, mode, prefixSize, suffixSize,
          prefixHash: createHash('sha256').update(bytes.subarray(0, prefixSize)).digest('hex'),
          suffixHash: createHash('sha256').update(bytes.subarray(prefixSize)).digest('hex') });
        continue;
      }
    }
    entries.push({ path, mode, size: stat.size, hash });
  }
  return entries;
}

export function validarBaselineEditorial(root, baseline) {
  if (!Array.isArray(baseline)) return { ok: false, reason: 'Falta el baseline editorial del slow.' };
  const listed = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (listed.status !== 0) return { ok: false, reason: 'No se pudo enumerar la metadata editorial actual.' };
  const currentEditorial = [...new Set((listed.stdout || '').split('\0').filter(Boolean)
    .map((value) => value.replaceAll('\\', '/')))].filter(modoEditorial).sort();
  if (currentEditorial.length > MAX_EDITORIAL_ENTRIES)
    return { ok: false, reason: 'La metadata editorial supera la cuota de entradas.' };
  let currentBytes = 0;
  for (const path of currentEditorial) {
    if (!rutaMaterialSegura(root, path))
      return { ok: false, reason: `La metadata editorial no es un fichero regular seguro: ${path}.` };
    const stat = lstatSync(join(root, path));
    if (stat.size > MAX_MATERIAL_FILE_BYTES || currentBytes + stat.size > MAX_MATERIAL_TOTAL_BYTES)
      return { ok: false, reason: `La metadata editorial supera la cuota de lectura: ${path}.` };
    currentBytes += stat.size;
  }
  for (const entry of baseline) {
    if (!entry?.path || !entry.mode || !rutaMaterialSegura(root, entry.path))
      return { ok: false, reason: `La evidencia editorial previa falta o no es regular: ${entry?.path || '<ruta>'}.` };
    const absolute = join(root, entry.path);
    const stat = lstatSync(absolute);
    if (entry.mode === 'exists') continue;
    if (entry.mode === 'insert-after-header' && Number.isInteger(entry.prefixSize)) {
      if (stat.size < entry.prefixSize + entry.suffixSize ||
          hashRango(absolute, 0, entry.prefixSize) !== entry.prefixHash ||
          hashRango(absolute, stat.size - entry.suffixSize, entry.suffixSize) !== entry.suffixHash)
        return { ok: false, reason: `La historia editorial previa fue reescrita: ${entry.path}.` };
      continue;
    }
    if (!Number.isInteger(entry.size) || entry.size < 0 || !entry.hash || stat.size < entry.size)
      return { ok: false, reason: `La evidencia editorial previa fue recortada: ${entry.path}.` };
    let start = 0;
    if (entry.mode === 'immutable' && stat.size !== entry.size)
      return { ok: false, reason: `Un informe previo cambió: ${entry.path}.` };
    if (entry.mode === 'insert-after-header') start = stat.size - entry.size;
    const actual = hashRango(absolute, start, entry.size);
    if (actual !== entry.hash)
      return { ok: false, reason: `La historia editorial previa fue reescrita: ${entry.path}.` };
  }
  return { ok: true, reason: 'La historia editorial previa permanece íntegra.' };
}

function rechazo(reason) {
  return { ok: false, reason, reusedChecks: [], freshChecks: [], fallbackCommand: FALLBACK };
}

export function hashEvidenciaRelease(evidence) {
  const payload = { ...(evidence || {}) };
  delete payload.evidenceHash;
  delete payload.evidenceMac;
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function firmarEvidenciaRelease(evidence, key) {
  if (!Buffer.isBuffer(key) || key.length < 32) return null;
  const payload = { ...(evidence || {}) };
  delete payload.evidenceHash;
  delete payload.evidenceMac;
  return createHmac('sha256', key).update(JSON.stringify(payload)).digest('hex');
}

/** Clave por clon, fuera del árbol versionado. No se imprime ni viaja con `.sdd/state`. */
export function claveEvidenciaLocal(root, { create = false } = {}) {
  const common = spawnSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8' });
  if (common.status !== 0 || !(common.stdout || '').trim()) return null;
  let gitRoot;
  try { gitRoot = realpathSync(resolve(root, common.stdout.trim())); } catch { return null; }
  const dir = join(gitRoot, 'sdd-gates');
  try {
    if (create) mkdirSync(dir, { recursive: true, mode: 0o700 });
    const statDir = lstatSync(dir);
    if (!statDir.isDirectory() || statDir.isSymbolicLink()) return null;
    const rel = relative(gitRoot, realpathSync(dir));
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  } catch { return null; }
  const path = join(dir, 'release-evidence.key');
  const read = () => {
    try {
      const stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink > 1 || stat.size !== 32) return null;
      const key = readFileSync(path);
      return key.length === 32 ? key : null;
    } catch { return null; }
  };
  const existing = read();
  if (existing || !create) return existing;
  let fd;
  try {
    fd = openSync(path, 'wx', 0o600);
    writeFileSync(fd, randomBytes(32));
  } catch (error) {
    if (error?.code !== 'EEXIST') return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  return read();
}

export function evaluarReutilizacionRelease(previous, current) {
  if (!previous) return rechazo('No existe evidencia slow anterior.');
  if (previous.schemaVersion !== 2) return rechazo('La evidencia usa un schema incompatible.');
  if (previous.kind !== 'slow') return rechazo('La evidencia de origen no es una ejecución slow completa.');
  if (!previous.evidenceHash || previous.evidenceHash !== hashEvidenciaRelease(previous))
    return rechazo('La integridad de la evidencia slow no coincide.');
  if (!previous.evidenceMac || previous.evidenceMac !== firmarEvidenciaRelease(previous, current?.evidenceKey))
    return rechazo('La autenticidad local de la evidencia slow no coincide.');
  if (!current?.editorial?.ok) return rechazo(current?.editorial?.reason || 'No se validó la historia editorial.');
  if (previous.ok !== true) return rechazo('La evidencia slow anterior quedó en rojo.');
  if (!current?.ancestor) return rechazo('El run anterior no pertenece a un ancestro del HEAD actual.');
  if (!previous.runId || !previous.head || !previous.at) return rechazo('La evidencia anterior no tiene procedencia completa.');
  if (previous.checksHash !== current.checksHash) return rechazo('Cambió la configuración de checks.');
  if (previous.runtime !== current.runtime) return rechazo('Cambió el runtime que ejecutó los checks.');
  if (!previous.machineHash || previous.machineHash !== current.machineHash)
    return rechazo('La evidencia slow pertenece a otra máquina.');
  if (!previous.materialHash || !current.materialHash) return rechazo('No se pudo demostrar la huella material.');
  if (previous.materialHash !== current.materialHash) return rechazo('Cambiaron entradas materiales no editoriales.');
  const changed = Array.isArray(current.changedPaths) ? current.changedPaths : [];
  if (!changed.every(esMetadataRelease)) return rechazo('El delta contiene rutas fuera de los metadatos permitidos para release.');

  const required = Array.isArray(current.requiredSlowChecks) ? current.requiredSlowChecks : [];
  const results = new Map((previous.results || []).map((result) => [result.id, result]));
  const reusedChecks = [];
  const freshChecks = [];
  const seenReusable = new Set();
  for (const id of required) {
    if (!REUTILIZABLES.has(String(id))) {
      if ([...REUTILIZABLES].some((base) => String(id).startsWith(`${base}:`)))
        return rechazo(`Check reutilizable duplicado o no canónico: ${id}.`);
      freshChecks.push(id);
      continue;
    }
    if (seenReusable.has(id)) return rechazo(`Check reutilizable duplicado: ${id}.`);
    seenReusable.add(id);
    const source = results.get(id);
    if (!source || source.status !== 0 || !source.outputHash || source.execution !== 'executed')
      return rechazo(`La evidencia no contiene un PASS verificable para ${id}.`);
    reusedChecks.push(id);
  }
  return { ok: true, reason: 'Las entradas materiales siguen idénticas.', reusedChecks, freshChecks,
    fallbackCommand: FALLBACK };
}

export function resultadoReutilizado(source, previous) {
  return {
    id: source.id,
    command: source.command || '',
    status: 0,
    signal: null,
    timedOut: false,
    durationMs: 0,
    outputHash: source.outputHash,
    output: '',
    counts: source.counts || { stdoutBytes: 0, stderrBytes: 0, stdoutLines: 0,
      stderrLines: 0, totalBytes: 0, emittedBytes: 0, redactions: 0, truncated: false },
    execution: 'reused',
    sourceRunId: previous.runId,
    sourceAt: previous.at,
    sourceHead: previous.head,
    reason: 'Entradas materiales, checks y runtime idénticos; resultado reutilizado sin reejecutar.',
  };
}

export function runtimeGates() {
  return `${process.version}|${process.platform}|${process.arch}`;
}

export function machineGates() {
  return createHash('sha256').update(`gate-machine-v1\0${hostname().normalize('NFC').toLowerCase()}`)
    .digest('hex');
}

export function hashChecks(config) {
  return createHash('sha256').update(JSON.stringify(config || {})).digest('hex');
}

export function headActual(root) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? (result.stdout || '').trim() : '';
}

export function rutaMaterialSegura(root, path) {
  const normalized = normalizarRuta(path);
  if (!normalized || /[\u0000-\u001f\u007f]/u.test(normalized) ||
      normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..')) return false;
  const rootAbs = resolve(root);
  const target = resolve(rootAbs, normalized);
  const rel = relative(rootAbs, target);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return false;
  let rootReal;
  try { rootReal = realpathSync(rootAbs); } catch { return false; }
  let current = rootAbs;
  const segments = rel.split(/[\\/]+/).filter(Boolean);
  for (let index = 0; index < segments.length; index += 1) {
    current = join(current, segments[index]);
    let stat;
    try { stat = lstatSync(current); } catch { return false; }
    if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink > 1)) return false;
    if (index < segments.length - 1 && !stat.isDirectory()) return false;
    if (index === segments.length - 1 && !stat.isFile()) return false;
    let real;
    try { real = realpathSync(current); } catch { return false; }
    const realRel = relative(rootReal, real);
    if (realRel === '..' || realRel.startsWith(`..${sep}`) || isAbsolute(realRel)) return false;
  }
  return segments.length > 0;
}

/** Huella de todo lo que puede cambiar conducta; un enlace/tipo especial impide reutilizar. */
export function huellaMaterialRelease(root) {
  const listed = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (listed.status !== 0) return null;
  const paths = [...new Set((listed.stdout || '').split('\0').filter(Boolean)
    .map((path) => path.replaceAll('\\', '/')))].sort();
  const hasher = createHash('sha256').update('release-material-v1\0');
  let totalBytes = 0;
  for (const path of paths) {
    if (!rutaMaterialSegura(root, path)) return null;
    const absolute = join(root, path);
    let stat;
    try { stat = lstatSync(absolute); } catch { return null; }
    const exempt = contenidoMaterial(path, Buffer.alloc(0)) === null;
    if (exempt) continue;
    if (stat.size > MAX_MATERIAL_FILE_BYTES || totalBytes + stat.size > MAX_MATERIAL_TOTAL_BYTES) return null;
    totalBytes += stat.size;
    hasher.update(path.normalize('NFC')).update('\0').update(String(stat.mode)).update('\0');
    if (/^docs\/specs\/\d{3}-[^/]+\/(?:spec|tasks)\.md$/.test(path)) {
      let bytes;
      try { bytes = readFileSync(absolute); } catch { return null; }
      hasher.update(contenidoMaterial(path, bytes));
    } else {
      let fd;
      try {
        fd = openSync(absolute, 'r');
        const chunk = Buffer.allocUnsafe(64 * 1024);
        let bytesRead;
        while ((bytesRead = readSync(fd, chunk, 0, chunk.length, null)) > 0)
          hasher.update(chunk.subarray(0, bytesRead));
      } catch { return null; }
      finally { if (fd !== undefined) closeSync(fd); }
    }
    hasher.update('\0');
  }
  return hasher.digest('hex');
}

export function rutasPendientes(root) {
  const commands = [
    ['diff', '--name-only', '-z', '--'], ['diff', '--cached', '--name-only', '-z', '--'],
    ['ls-files', '--others', '--exclude-standard', '-z'],
  ];
  const paths = new Set();
  for (const args of commands) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (result.status !== 0) return null;
    for (const path of (result.stdout || '').split('\0').filter(Boolean)) paths.add(path.replaceAll('\\', '/'));
  }
  return [...paths].sort();
}

export function contextoReutilizacionRelease(root, config, previous, requiredSlowChecks) {
  const ancestor = Boolean(previous?.head) && spawnSync('git',
    ['merge-base', '--is-ancestor', previous.head, 'HEAD'], { cwd: root, encoding: 'utf8' }).status === 0;
  const changedPaths = rutasPendientes(root);
  return {
    checksHash: hashChecks(config), runtime: runtimeGates(), machineHash: machineGates(),
    evidenceKey: claveEvidenciaLocal(root),
    materialHash: huellaMaterialRelease(root),
    editorial: validarBaselineEditorial(root, previous?.editorialBaseline),
    ancestor, changedPaths: changedPaths || ['<git-status-no-disponible>'], requiredSlowChecks,
  };
}

export function crearEntradaEvidenciaGates({ root, kind, ok, tree, at, results, runId, config }) {
  const entry = { schemaVersion: 2, kind, ok, tree, at, checks: results.map((result) => result.id) };
  if (['slow', 'release'].includes(kind)) Object.assign(entry, {
    runId, head: headActual(root), checksHash: hashChecks(config), runtime: runtimeGates(),
    machineHash: machineGates(),
    materialHash: huellaMaterialRelease(root),
    editorialBaseline: capturarBaselineEditorial(root),
    results: results.map((result) => ({ id: result.id, command: result.command,
      status: result.status, outputHash: result.outputHash, counts: result.counts,
      execution: result.execution || 'executed', sourceRunId: result.sourceRunId || null,
      sourceAt: result.sourceAt || null, sourceHead: result.sourceHead || null,
      reason: result.reason || null })),
  });
  if (['slow', 'release'].includes(kind)) entry.evidenceHash = hashEvidenciaRelease(entry);
  if (['slow', 'release'].includes(kind)) {
    const key = claveEvidenciaLocal(root, { create: kind === 'slow' });
    entry.evidenceMac = firmarEvidenciaRelease(entry, key);
  }
  return entry;
}

export const RELEASE_REUSABLE_GATES = Object.freeze([...REUTILIZABLES]);
