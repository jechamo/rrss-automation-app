import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, posix, relative, resolve, sep, win32 } from 'node:path';

const MODES = new Set(['audit', 'enforce']);
const KINDS = new Set([
  'public-api',
  'public-code',
  'ui-catalog',
  'user-guide',
  'architecture',
  'operations',
  'developer-readme',
]);
const DOC_ID = /^DOC-[A-Z0-9][A-Z0-9-]*$/;
const GLOB_CHARS = /[*?]/;
const DEFAULT_OWNERS = new Set([
  'api-designer', 'architect', 'backend-expert', 'bitacora-keeper', 'code-reviewer',
  'database-expert', 'devops-expert', 'docs-writer', 'frontend-expert', 'implementer',
  'orchestrator', 'performance-optimizer', 'planner', 'refactor-specialist',
  'release-manager', 'research-analyst', 'security-auditor', 'spec-analyst',
  'test-engineer', 'ux-designer',
]);

function insideRoot(candidate, root) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function existingPrefix(candidate) {
  let current = candidate;
  while (!existsSync(current)) {
    const parent = resolve(current, '..');
    if (parent === current) return null;
    current = parent;
  }
  return current;
}

/**
 * Normaliza una ruta documental relativa y falla cerrado ante URL, absoluta, traversal o
 * un prefijo existente que escape de la raiz mediante un enlace simbolico.
 */
export function normalizeDocPath(value, root = process.cwd()) {
  if (typeof value !== 'string' || !value.trim())
    throw new Error('la ruta documental debe ser texto no vacio');
  if (value.includes('\0')) throw new Error('la ruta documental contiene un byte nulo');

  const raw = value.trim().replaceAll('\\', '/');
  if (/[{}[\]]/.test(raw))
    throw new Error(`la ruta documental usa una sintaxis glob no soportada: ${value}`);
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//') ||
      posix.isAbsolute(raw) || win32.isAbsolute(raw)) {
    throw new Error(`la ruta documental debe ser relativa: ${value}`);
  }

  const normalized = posix.normalize(raw).replace(/^\.\//, '');
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../'))
    throw new Error(`la ruta documental escapa de la raiz: ${value}`);
  if ((normalized === '.env' || (normalized.startsWith('.env.') && normalized !== '.env.example')) ||
      /(^|\/)(?:secrets?|credentials?)(?:\/|$)/i.test(normalized) ||
      /(^|\/)(?:\.npmrc|\.pypirc|\.netrc|id_rsa|id_ed25519)$/i.test(normalized) ||
      /\.(?:key|pem|p12|pfx|jks)$/i.test(normalized) ||
      normalized.startsWith('.sdd/state/') ||
      normalized.startsWith('.sdd/conflicts/') || normalized === '.claude/settings.local.json' ||
      normalized.startsWith('.cursor/local/')) {
    throw new Error(`la ruta documental apunta a secretos o estado local: ${value}`);
  }

  const absoluteRoot = resolve(root);
  const staticPrefix = normalized.split('/').filter((part) => !GLOB_CHARS.test(part)).join('/');
  const candidate = resolve(absoluteRoot, staticPrefix || '.');
  if (!insideRoot(candidate, absoluteRoot))
    throw new Error(`la ruta documental escapa de la raiz: ${value}`);

  const prefix = existingPrefix(candidate);
  if (prefix) {
    const realRoot = realpathSync(absoluteRoot);
    const realPrefix = realpathSync(prefix);
    if (!insideRoot(realPrefix, realRoot))
      throw new Error(`la ruta documental resuelve fuera de la raiz: ${value}`);
  }

  return normalized;
}

function escapeRegex(text) {
  return text.replace(/[|\\{}()[\]^$+?.-]/g, '\\$&');
}

/** Glob portable limitado a `*`, `?` y `**`; no consulta el filesystem. */
export function matchesDocPattern(value, pattern) {
  let candidate;
  let glob;
  try {
    candidate = normalizeDocPath(value);
    glob = normalizeDocPath(pattern);
  } catch {
    return false;
  }

  let source = '^';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === '*' && glob[i + 1] === '*') {
      const followedBySlash = glob[i + 2] === '/';
      source += followedBySlash ? '(?:.*/)?' : '.*';
      i += followedBySlash ? 2 : 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += escapeRegex(char);
  }
  return new RegExp(`${source}$`).test(candidate);
}

function configuredChecks(checks) {
  if (!checks || typeof checks !== 'object') return {};
  return checks.checks && typeof checks.checks === 'object' ? checks.checks : checks;
}

function validatePaths(values, label, root, errors) {
  if (!Array.isArray(values) || values.length === 0) {
    errors.push(`${label} debe ser un array no vacio`);
    return;
  }
  const seen = new Set();
  for (const value of values) {
    try {
      const normalized = normalizeDocPath(value, root);
      if (seen.has(normalized)) errors.push(`${label} contiene la ruta duplicada ${normalized}`);
      seen.add(normalized);
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }
}

/** Devuelve todos los errores del contrato; un array vacio representa un contrato valido. */
export function validateDocsConfig(config, {
  root = process.cwd(), checks = {}, requireNonEmpty = false, owners = DEFAULT_OWNERS,
} = {}) {
  const errors = [];
  if (!config || typeof config !== 'object' || Array.isArray(config))
    return ['el contrato documental debe ser un objeto JSON'];
  if (config.schemaVersion !== 1) errors.push('schemaVersion documental debe ser 1');
  if (!MODES.has(config.mode)) errors.push('mode documental debe ser audit o enforce');
  if (!Array.isArray(config.documentSets)) {
    errors.push('documentSets debe ser un array');
    return errors;
  }
  if (requireNonEmpty && config.documentSets.length === 0)
    errors.push('documentSets no puede estar vacio en este contexto');

  const ids = new Set();
  const availableChecks = configuredChecks(checks);
  const allowedOwners = owners instanceof Set ? owners : new Set(owners || []);
  for (const [index, set] of config.documentSets.entries()) {
    const label = `documentSets[${index}]`;
    if (!set || typeof set !== 'object' || Array.isArray(set)) {
      errors.push(`${label} debe ser un objeto`);
      continue;
    }
    if (typeof set.id !== 'string' || !DOC_ID.test(set.id))
      errors.push(`${label}.id debe usar el formato DOC-*`);
    else if (ids.has(set.id)) errors.push(`DOC-ID duplicado: ${set.id}`);
    else ids.add(set.id);
    if (!KINDS.has(set.kind)) errors.push(`${label}.kind no es valido`);
    validatePaths(set.sources, `${label}.sources`, root, errors);
    validatePaths(set.artifacts, `${label}.artifacts`, root, errors);
    if (typeof set.generated !== 'boolean') errors.push(`${label}.generated debe ser booleano`);
    if (typeof set.owner !== 'string' || !set.owner.trim()) errors.push(`${label}.owner es obligatorio`);
    else if (!allowedOwners.has(set.owner)) errors.push(`${label}.owner no pertenece a los agentes permitidos`);

    if (set.generated) {
      if (typeof set.gate !== 'string' || !(set.gate === 'docs' || set.gate.startsWith('docs:'))) {
        errors.push(`${label}.gate debe declarar un gate docs o docs:* para artefactos generados`);
      } else {
        const gate = availableChecks[set.gate];
        if (!gate || typeof gate.command !== 'string' || !gate.command.trim() ||
            gate.required !== true || gate.enabled === false || gate.speed !== 'slow') {
          errors.push(`${label}.gate ${set.gate} debe estar habilitado, requerido y ser slow`);
        }
      }
    } else if (set.gate !== null && set.gate !== undefined && typeof set.gate !== 'string') {
      errors.push(`${label}.gate debe ser texto o null`);
    }
  }
  return errors;
}
