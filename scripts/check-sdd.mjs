#!/usr/bin/env node
/**
 * check-sdd — validador determinista del circuito SDD.
 *
 * Existe porque la Definition of Done la marcaba el propio modelo. Una casilla que
 * marca quien tiene que ser evaluado no es un gate: es una declaración de intenciones.
 * Esto lo comprueba desde fuera, contra el sistema de ficheros.
 *
 *   node scripts/check-sdd.mjs            → estructura y coherencia (avisa)
 *   node scripts/check-sdd.mjs --strict   → además exige evidencia y trazabilidad (falla)
 *   node scripts/check-sdd.mjs --spec 042 → limita el análisis a una spec
 *
 * Node >= 18, sin dependencias.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { validateDocsConfig, normalizeDocPath, matchesDocPattern } from './lib/docs-contract.mjs';
import { parseJsonc } from './lib/jsonc.mjs';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const STRICT = args.includes('--strict');
const VIRGIN = args.includes('--virgin');
const DOCS_DIFF = args.includes('--docs-diff');
const JSON_OUT = args.includes('--json');
const indiceBaseDocs = args.indexOf('--base');
const BASE_DOCS = indiceBaseDocs >= 0 ? args[indiceBaseDocs + 1] : null;
const soloSpec = (args[args.indexOf('--spec') + 1] || '').replace(/^--.*/, '');

const problemas = [];
const avisos = [];
const err = (regla, msg) => problemas.push({ regla, msg });
const warn = (regla, msg) => avisos.push({ regla, msg });

if (DOCS_DIFF && (!BASE_DOCS || BASE_DOCS.startsWith('--')))
  err('docs/diff-base', '--docs-diff requiere `--base <SHA completo>`');
if (!DOCS_DIFF && indiceBaseDocs >= 0)
  err('docs/diff-base', '--base solo es válido junto con --docs-diff');

const leer = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const rel = (p) => relative(ROOT, p).replace(/\\/g, '/');

function dirs(p) {
  try {
    return readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

function walk(dir, filtro, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, filtro, out);
    else if (filtro(e.name)) out.push(p);
  }
  return out;
}

function primerId(texto, patron) {
  return String(texto || '').match(patron)?.[1] || null;
}

function cadenaTrazable(linea) {
  const cadena = {
    objetivo: primerId(linea, /\b(OBJ-\d{3})\b/),
    requisitoProducto: primerId(linea, /\b(PRD-RF-\d{3})\b/),
    caso: primerId(linea, /\b(UC-\d{3})\b/),
    requisitoSpec: primerId(linea, /(?:^|[^\w-])(RF-\d+)\b/),
    criterio: primerId(linea, /\b(CA-\d+)\b/),
  };
  return Object.values(cadena).every(Boolean) ? cadena : null;
}

function tieneTestConcreto(texto) {
  const valor = String(texto || '').match(/Test que la define\**:\s*([^\n]+)/i)?.[1]?.trim();
  if (!valor || /^(?:`?<|pendiente|por definir|ningun[oa]|n\/?a|no aplica|[-—…])/i.test(valor)) return false;
  return !/<[^>\n]+>/.test(valor);
}

function tieneResultadoConcreto(texto) {
  return /[🟢🔴✅❌]|\b(?:pass(?:ed)?|verde|rojo|fall[óa]|error esperado|no ejecutado|bloquead[oa]|\d+\/\d+)\b/i
    .test(String(texto || ''));
}

// El indicador `u` no es decorativo: sin él, la clase [🔴❌] se compila sobre unidades UTF-16 y
// el sustituto alto de 🔴 (\ud83d) es el mismo que el de 🟢, así que un resultado verde con emoji
// se leía como rojo. Las plantillas usan 🟢, de modo que el fallo llegaba a cualquier proyecto.
function tieneResultadoSeguridadVerde(texto) {
  const valor = String(texto || '');
  if (/\b(?:no ejecutado|bloquead[oa]|rojo|fall(?:o|a|ed)?|error|pendiente|skipped?)\b|[🔴❌]/iu.test(valor)) return false;
  return /\b(?:pass(?:ed)?|verde|green|exit\s*(?:code\s*)?0|0\s+fallos?)\b|[🟢✅]/iu.test(valor);
}

function coincideCadena(texto, cadena, { conTarea = false, conTest = false, conResultado = false } = {}) {
  const contiene = Object.values(cadena).every((id) => String(texto || '').includes(id));
  return contiene && (!conTarea || /\bT-\d{3}-\d+\b/.test(texto)) &&
    (!conTest || tieneTestConcreto(texto)) && (!conResultado || tieneResultadoConcreto(texto));
}

function celdasMarkdown(linea) {
  const limpia = String(linea || '').trim();
  if (!limpia.startsWith('|') || !limpia.endsWith('|')) return [];
  return limpia.slice(1, -1).split('|').map((celda) => celda.trim());
}

function valorConcreto(valor) {
  const limpio = String(valor || '').replace(/[`*]/g, '').trim();
  if (!limpio || /<[^>]+>/.test(limpio) || /\bTBD\b/i.test(limpio) || /\bTODO\b/.test(limpio) ||
      /^todo$/i.test(limpio) || /\bunknown\b/i.test(limpio)) return false;
  if (/^(?:pendiente\b|por (?:definir|completar)\b)/i.test(limpio)) return false;
  return !/^(?:n\/?a|no aplica|ningun[oa]|[-—…])$/i.test(limpio);
}

function escaparRegex(valor) {
  return String(valor || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fechaIsoValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''))) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.valueOf()) && fecha.toISOString().slice(0, 10) === valor;
}

function referenciaTestResuelta(referencia) {
  const limpia = String(referencia || '').replace(/[`*]/g, '').trim();
  const separador = limpia.indexOf('::');
  if (separador <= 0 || separador === limpia.length - 2) return false;
  const ruta = limpia.slice(0, separador).replace(/\\/g, '/');
  const caso = limpia.slice(separador + 2).trim();
  const absoluta = resolve(ROOT, ruta);
  const relativa = relative(ROOT, absoluta).replace(/\\/g, '/');
  if (!relativa || relativa.startsWith('../') || relativa === '..' || !existsSync(absoluta)) return false;
  return new RegExp(`\\b${escaparRegex(caso)}\\b`).test(leer(absoluta) || '');
}

function referenciaDecisionExiste(referencia) {
  const id = String(referencia || '').trim();
  if (!valorConcreto(id) || !/^(?:DEC-[A-Z0-9-]+|ADR-\d{4}(?:-[A-Z0-9-]+)?)$/i.test(id)) return false;
  const patron = new RegExp(`(?:^|[^A-Z0-9-])${escaparRegex(id)}(?:$|[^A-Z0-9-])`, 'im');
  const decisiones = leer(join(ROOT, 'docs/bitacora/DECISIONS.md')) || '';
  if (patron.test(decisiones)) return true;
  const adr = join(ROOT, 'docs/architecture/adr');
  try {
    return readdirSync(adr).filter((nombre) => nombre.endsWith('.md'))
      .some((nombre) => patron.test(leer(join(adr, nombre)) || ''));
  } catch { return false; }
}

function impactoSeguridad(spec) {
  const linea = String(spec || '').split('\n').find((candidata) =>
    /^\|\s*\*{0,2}Impacto de seguridad\*{0,2}\s*\|/i.test(candidata));
  if (!linea || /\\\|/.test(linea)) return null;
  const valor = celdasMarkdown(linea)[1];
  const limpio = String(valor || '').replace(/[`*]/g, '').trim().toLowerCase();
  return ['sensible', 'no-sensible', 'security-pending'].includes(limpio) ? limpio : null;
}

// Usabilidad replica deliberadamente la forma de seguridad: mismo tipo de clasificación en la
// cabecera, misma matriz trazable y mismo informe parseable. Se lee por analogía a propósito.
function impactoUsabilidad(spec) {
  // Solo la tabla de cabecera, antes del primer encabezado: el glosario de una spec puede
  // definir el término y no es una declaración.
  const cabecera = String(spec || '').split(/^##\s/m)[0];
  const linea = cabecera.split('\n').find((candidata) =>
    /^\|\s*\*{0,2}Impacto de usabilidad\*{0,2}\s*\|/i.test(candidata));
  if (!linea || /\\\|/.test(linea)) return null;
  const valor = String(celdasMarkdown(linea)[1] || '').replace(/[`*]/g, '').trim();
  const normalizado = valor.toLowerCase();
  if (normalizado === 'aplicable') return { estado: 'aplicable', motivo: null, valor };
  if (normalizado === 'ux-pending') return { estado: 'ux-pending', motivo: null, valor };
  if (/^sin-ui(?:\s|·|-|:)/i.test(valor)) {
    const motivo = valor.replace(/^sin-ui\s*(?:·|-|:)?\s*/i, '').trim();
    return { estado: 'sin-ui', motivo, valor };
  }
  return { estado: 'invalido', motivo: null, valor };
}

function matrizUsabilidad(plan) {
  const lineas = String(plan || '').split('\n');
  const cabecera = lineas.findIndex((linea) => {
    const c = celdasMarkdown(linea).map((x) => x.toLowerCase());
    return c.length >= 8 && c[0] === 'control' && c[1].includes('wcag') && c[2].includes('heur') &&
      c[3] === 'aplica' && c[4].includes('decisión') && c[5] === 'tarea' && c[6] === 'test' && c[7] === 'evidencia';
  });
  if (cabecera === -1) return [];
  const filas = [];
  for (let i = cabecera + 2; i < lineas.length; i++) {
    const c = celdasMarkdown(lineas[i]);
    if (!c.length) break;
    filas.push({
      control: c[0], wcag: c[1], heuristica: c[2], aplica: c[3].toLowerCase(),
      decision: c[4], tarea: c[5], test: c[6], evidencia: c[7],
    });
  }
  return filas;
}

function bloqueInformeUsabilidad(contenido) {
  const match = String(contenido || '').match(
    /<!--\s*sdd-usability-report:v1\s*-->\s*```json\s*([\s\S]*?)\s*```/i,
  );
  if (!match) return { error: 'falta el bloque <!-- sdd-usability-report:v1 --> seguido de JSON' };
  try { return { data: JSON.parse(match[1]) }; }
  catch (error) { return { error: `JSON de usabilidad inválido: ${error.message}` }; }
}

// Las tablas §6 y §6 bis de design.md existían desde el principio y nadie las validaba, así que
// se entregaban vacías sin coste. Con impacto aplicable, una fila sin estado es un hueco.
function tablasDiseñoIncompletas(design) {
  const lineas = String(design || '').split('\n');
  const huecos = [];
  let seccion = null;
  for (const linea of lineas) {
    const titulo = linea.match(/^##\s+(.+)$/);
    if (titulo) {
      const t = titulo[1].toLowerCase();
      if (t.includes('accesibilidad')) seccion = 'accesibilidad';
      else if (t.includes('usabilidad')) seccion = 'usabilidad';
      else seccion = null;
      continue;
    }
    if (!seccion) continue;
    const c = celdasMarkdown(linea);
    if (c.length < 2) continue;
    const primera = c[0].toLowerCase();
    if (!primera || primera === 'comprobación' || primera === 'acción' || /^-+$/.test(primera)) continue;
    if (/^<.+>$/.test(c[0].trim())) continue; // fila de ejemplo de la plantilla
    const estado = String(c[1] || '').replace(/[`*]/g, '').trim();
    if (!estado) huecos.push(`${seccion}: '${c[0]}' sin estado`);
  }
  return huecos;
}

function impactoDocumentacion(spec) {
  const linea = String(spec || '').split('\n').find((candidata) =>
    /^\|\s*\*{0,2}Impacto de documentaci[oó]n\*{0,2}\s*\|/i.test(candidata));
  if (!linea || /\\\|/.test(linea)) return null;
  const valor = String(celdasMarkdown(linea)[1] || '').replace(/[`*]/g, '').trim();
  const normalizado = valor.toLowerCase();
  const ids = [...new Set(valor.match(/\bDOC-[A-Z0-9-]+\b/g) || [])];
  if (/^aplicable(?:\s|·|-|:)/i.test(valor) || normalizado === 'aplicable')
    return { estado: 'aplicable', ids, motivo: null, valor };
  if (/^docs-pending$/i.test(valor)) return { estado: 'docs-pending', ids: [], motivo: null, valor };
  if (/^no-aplica(?:\s|·|-|:)/i.test(valor)) {
    const motivo = valor.replace(/^no-aplica\s*(?:·|-|:)?\s*/i, '').trim();
    return { estado: 'no-aplica', ids: [], motivo, valor };
  }
  return { estado: 'invalido', ids, motivo: null, valor };
}

function matrizDocumentacion(plan) {
  const lineas = String(plan || '').split('\n');
  const cabecera = lineas.findIndex((linea) => {
    const c = celdasMarkdown(linea).map((x) => x.toLowerCase());
    return c.length >= 8 && c[0] === 'doc-id' && c.includes('artefacto') &&
      c.some((x) => x.includes('fuente')) && c.includes('tarea') &&
      c.some((x) => x.includes('gate') || x.includes('comprobaci')) && c.includes('evidencia');
  });
  if (cabecera === -1) return [];
  const cabeceras = celdasMarkdown(lineas[cabecera]).map((x) => x.toLowerCase());
  const indice = (fragmento) => cabeceras.findIndex((x) => x.includes(fragmento));
  const filas = [];
  for (let i = cabecera + 2; i < lineas.length; i++) {
    const c = celdasMarkdown(lineas[i]);
    if (!c.length) break;
    filas.push({
      id: c[0],
      fuente: c[indice('fuente')],
      artefacto: c[indice('artefacto')],
      tarea: c[indice('tarea')],
      comprobacion: c[Math.max(indice('gate'), indice('comprobaci'))],
      evidencia: c[indice('evidencia')],
    });
  }
  return filas;
}

function enlacesMarkdownValidos(rutaRelativa, contenido) {
  for (const match of String(contenido || '').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const bruto = match[1].trim().replace(/^<|>$/g, '').split(/\s+["']/)[0];
    const destino = bruto.split('#')[0].split('?')[0];
    if (!destino || /^(?:https?:|mailto:|tel:|#|\/)/i.test(destino)) continue;
    let decodificado = destino;
    try { decodificado = decodeURIComponent(destino); } catch { /* se valida tal cual */ }
    const absoluta = resolve(ROOT, dirname(rutaRelativa), decodificado);
    const relativa = relative(ROOT, absoluta).replace(/\\/g, '/');
    let segura = true;
    try { normalizeDocPath(relativa, ROOT); }
    catch { segura = false; }
    if (!segura || relativa === '..' || relativa.startsWith('../') || !existsSync(absoluta))
      err('docs/enlace', `${rutaRelativa}: el enlace interno '${destino}' no existe o escapa del repositorio`);
  }
}

function tienePlaceholderDocumental(contenido) {
  const texto = String(contenido || '');
  return /^\s*(?:[-*]\s*)?(?:TODO|TBD)\s*(?::|$)/m.test(texto) ||
    /^\s*(?:[-*]\s*)?(?:\|\s*[^|]+\s*)?\|\s*\[NEEDS CLARIFICATION[^\]]*\]\s*\|?\s*$/m.test(texto) ||
    /^\s*(?:[-*]\s*)?(?:\|\s*[^|]+\s*)?\|\s*<\s*(?:pendiente|pending|por completar)\s*>\s*\|?\s*$/im.test(texto);
}

function matrizSeguridad(plan) {
  const lineas = String(plan || '').split('\n');
  const cabecera = lineas.findIndex((linea) => {
    const c = celdasMarkdown(linea).map((x) => x.toLowerCase());
    return c.length >= 8 && c[0] === 'control' && c[1] === 'asvs' && c[2] === 'owasp' &&
      c[3] === 'aplica' && c[4].includes('decisión') && c[5] === 'tarea' && c[6] === 'test' && c[7] === 'evidencia';
  });
  if (cabecera === -1) return [];
  const filas = [];
  for (let i = cabecera + 2; i < lineas.length; i++) {
    const c = celdasMarkdown(lineas[i]);
    if (!c.length) break;
    filas.push({
      control: c[0], asvs: c[1], owasp: c[2], aplica: c[3].toLowerCase(),
      decision: c[4], tarea: c[5], test: c[6], evidencia: c[7],
    });
  }
  return filas;
}

function bloqueInformeSeguridad(contenido) {
  const match = String(contenido || '').match(
    /<!--\s*sdd-security-report:v1\s*-->\s*```json\s*([\s\S]*?)\s*```/i,
  );
  if (!match) return { error: 'falta el bloque <!-- sdd-security-report:v1 --> seguido de JSON' };
  try { return { data: JSON.parse(match[1]) }; }
  catch (error) { return { error: `JSON de seguridad inválido: ${error.message}` }; }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 · Ecosistema de agentes: frontmatter válido y sin deriva entre superficies
// ─────────────────────────────────────────────────────────────────────────────
const AGENTES_DIR = join(ROOT, '.claude/agents');
const nombresAgentes = new Set();

// El campo `tools` es un allowlist de NOMBRES de herramienta. El único scoping
// documentado es `Agent(tipo)`. `Bash(git status:*)` no se reconoce como `Bash`
// y deja al agente sin la herramienta: el scoping va en `permissions`.
const SCOPING_INVALIDO = /\b(?!Agent\()([A-Z][A-Za-z]*)\([^)]*\)/;

for (const f of existsSync(AGENTES_DIR) ? readdirSync(AGENTES_DIR).filter((x) => x.endsWith('.md')) : []) {
  const t = leer(join(AGENTES_DIR, f)) || '';
  const fin = t.indexOf('\n---', 4);
  if (!t.startsWith('---') || fin === -1) {
    err('agente/frontmatter', `${f}: sin frontmatter cerrado`);
    continue;
  }
  const fm = Object.fromEntries(
    t.slice(4, fin).split('\n').map((l) => l.match(/^([a-zA-Z][\w-]*):\s*(.*)$/)).filter(Boolean)
      .map((m) => [m[1], m[2].trim()]),
  );

  if (!fm.name) err('agente/name', `${f}: falta 'name'`);
  else {
    nombresAgentes.add(fm.name);
    if (fm.name !== f.replace('.md', '')) err('agente/name', `${f}: name '${fm.name}' no coincide con el fichero`);
  }
  if (!fm.description) err('agente/description', `${f}: falta 'description'`);
  if (fm.model && !['opus', 'sonnet', 'haiku', 'inherit'].includes(fm.model))
    err('agente/model', `${f}: model '${fm.model}' no válido`);
  if (fm.tools && SCOPING_INVALIDO.test(fm.tools))
    err('agente/tools', `${f}: 'tools' lleva especificadores — el scoping va en permissions de settings.json. Valor: ${fm.tools}`);

  const delegadores = new Set(['orchestrator', 'planner', 'implementer']);
  const puedeDelegar = /(^|,\s*)Agent(?:\([^)]*\))?(\s*,|$)/.test(fm.tools || '');
  if (puedeDelegar && !delegadores.has(fm.name))
    err('delegacion/permiso', `${f}: '${fm.name}' puede delegar y no está en la lista de coordinadores`);
  if (delegadores.has(fm.name) && !puedeDelegar)
    err('delegacion/permiso', `${f}: '${fm.name}' debe disponer de Agent para cumplir su handoff`);
  if (!/^### HANDOFF\s*$/m.test(t))
    err('handoff/ausente', `${f}: el perfil no cierra con un bloque ### HANDOFF`);
}

// Los envoltorios de otras superficies deben apuntar a un perfil que exista.
const envueltos = {
  '.github/agents': new Set(), '.cursor/agents': new Set(), '.codex/agents': new Set(),
  '.agents/agents': new Set(), '.gemini/agents': new Set(),
};
for (const [dir, filtro] of [
  ['.github/agents', (n) => n.endsWith('.agent.md')],
  ['.cursor/agents', (n) => n.endsWith('.md')],
  ['.agents/agents', (n) => n.endsWith('.md')],
  ['.gemini/agents', (n) => n.endsWith('.md')],
]) {
  for (const p of walk(join(ROOT, dir), filtro)) {
    const t = leer(p) || '';
    const nombre = (t.match(/^name:\s*(.+)$/m) || [])[1]?.trim() || p.split(/[/\\]/).pop().replace(/\.(agent\.)?md$/, '');
    if (nombre === 'README') continue;
    if (!nombresAgentes.has(nombre))
      err('deriva/envoltorio', `${rel(p)}: '${nombre}' no tiene perfil canónico en .claude/agents/`);
    else envueltos[dir].add(nombre);
    if (!/\.claude\/agents\//.test(t))
      warn('deriva/envoltorio', `${rel(p)}: no referencia su perfil canónico; puede derivar`);
  }
}

// Codex usa TOML por proyecto. El adaptador es deliberadamente fino: registra el agente
// y remite al perfil canónico en vez de copiar sus instrucciones y crear una tercera versión.
const codexDir = join(ROOT, '.codex/agents');
const auditoresSoloLectura = new Set(['orchestrator', 'code-reviewer', 'security-auditor', 'research-analyst']);
for (const p of walk(codexDir, (n) => n.endsWith('.toml'))) {
  const t = leer(p) || '';
  const nombre = (t.match(/^name\s*=\s*"([^"]+)"\s*$/m) || [])[1];
  const descripcion = (t.match(/^description\s*=\s*"([^"]+)"\s*$/m) || [])[1];
  const instrucciones = /^developer_instructions\s*=\s*"""[\s\S]+?^"""\s*$/m.test(t);

  if (!nombre) {
    err('codex/name', `${rel(p)}: falta 'name'`);
    continue;
  }
  if (!descripcion) err('codex/description', `${rel(p)}: falta 'description'`);
  if (!instrucciones) err('codex/instructions', `${rel(p)}: falta 'developer_instructions' multilínea`);
  if (!nombresAgentes.has(nombre))
    err('deriva/envoltorio', `${rel(p)}: '${nombre}' no tiene perfil canónico en .claude/agents/`);
  else envueltos['.codex/agents'].add(nombre);
  if (!new RegExp(`\\.claude/agents/${nombre}\\.md`).test(t))
    warn('deriva/envoltorio', `${rel(p)}: no referencia su perfil canónico; puede derivar`);
  if (auditoresSoloLectura.has(nombre) && !/^sandbox_mode\s*=\s*"read-only"\s*$/m.test(t))
    err('codex/sandbox', `${rel(p)}: el auditor '${nombre}' debe usar sandbox_mode = "read-only"`);
}

if (existsSync(codexDir)) {
  const codexConfig = leer(join(ROOT, '.codex/config.toml')) || '';
  if (!/^\[agents\]\s*$/m.test(codexConfig) || !/^enabled\s*=\s*true\s*$/m.test(codexConfig))
    err('codex/config', `.codex/config.toml debe habilitar los agentes del proyecto`);
}

// Paridad de superficies. Importa porque `.vscode/settings.json` desactiva la lectura de
// `.claude/agents/` para que VS Code no muestre cada agente por duplicado: a partir de ahí,
// un agente sin envoltorio simplemente NO EXISTE en VS Code. En Cursor y Codex el fichero es
// la identidad del subagente, así que sin él no se le puede delegar.
for (const [dir, cuantos] of Object.entries(envueltos)) {
  if (!cuantos.size) continue; // superficie no usada en este repo: no se exige
  const faltan = [...nombresAgentes].filter((a) => !cuantos.has(a)).sort();
  if (faltan.length)
    err('superficie/incompleta', `${dir}: faltan ${faltan.length} agente(s), invisibles en esa superficie: ${faltan.join(', ')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 bis · Skills: el nombre declarado manda sobre la carpeta
//
// Una skill se invoca por su `name`, no por el nombre del directorio. Si divergen,
// el comando que documentas no es el que existe.
// ─────────────────────────────────────────────────────────────────────────────
const SKILLS_DIR = join(ROOT, '.agents/skills');
const SKILL_FM_PERMITIDO = new Set([
  'name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility',
]);
for (const d of dirs(SKILLS_DIR)) {
  const t = leer(join(SKILLS_DIR, d, 'SKILL.md'));
  if (t === null) {
    err('skill/estructura', `.agents/skills/${d}/: falta SKILL.md`);
    continue;
  }
  const fin = t.indexOf('\n---', 4);
  if (!t.startsWith('---') || fin === -1) {
    err('skill/frontmatter', `${d}/SKILL.md: sin frontmatter cerrado`);
    continue;
  }
  const fm = t.slice(4, fin);
  const nombre = (fm.match(/^name:\s*(.+)$/m) || [])[1]?.trim();
  if (!nombre) err('skill/name', `${d}/SKILL.md: falta 'name'`);
  else if (nombre !== d) err('skill/name', `${d}/SKILL.md: name '${nombre}' no coincide con la carpeta`);
  else if (!/^[a-z0-9-]+$/.test(nombre) || nombre.startsWith('-') || nombre.endsWith('-') || nombre.includes('--') || nombre.length > 64)
    err('skill/name', `${d}/SKILL.md: name '${nombre}' no cumple kebab-case ni el máximo de 64 caracteres`);
  const descripcionRaw = (fm.match(/^description:\s*(.+)$/m) || [])[1]?.trim() || '';
  const descripcion = descripcionRaw.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, '$1$2');
  if (!descripcion)
    err('skill/description', `${d}/SKILL.md: falta 'description' — sin ella el modelo no sabe cuándo usarla`);
  else {
    if (!/^["']/.test(descripcionRaw) && /:\s/.test(descripcionRaw))
      err('skill/frontmatter', `${d}/SKILL.md: description con ':' debe ir entre comillas para ser YAML válido`);
    if (descripcion.includes('<') || descripcion.includes('>'))
      err('skill/description', `${d}/SKILL.md: description no puede contener '<' ni '>'`);
    if (descripcion.length > 1024)
      err('skill/description', `${d}/SKILL.md: description supera 1024 caracteres`);
  }
  const claves = [...fm.matchAll(/^([a-zA-Z][\w-]*):/gm)].map((m) => m[1]);
  const noPortables = claves.filter((clave) => !SKILL_FM_PERMITIDO.has(clave));
  if (noPortables.length)
    err('skill/frontmatter', `${d}/SKILL.md: claves no portables: ${[...new Set(noPortables)].sort().join(', ')}`);
  if (t.split(/\r?\n/).length > 500)
    warn('skill/progressive-disclosure', `${d}/SKILL.md supera 500 líneas; mueve detalle a references/`);

  // Una skill canónica se importa suelta en hosts que las cargan al workspace (Lovable y
  // equivalentes). Ahí `../../../docs/x.md` no significa nada: el fichero ya no vive en el árbol
  // del repositorio. Se referencia desde la raíz, y a otra skill por su comando.
  // Los adaptadores de .claude/skills/ están exentos: su enlace al canónico es obligatorio.
  for (const enlace of t.matchAll(/\]\((\.\.\/[^)]*)\)/g))
    err('skill/ruta-relativa', `.agents/skills/${d}/SKILL.md enlaza '${enlace[1]}': usa ruta desde la raíz en backticks, o \`/nombre-de-skill\``);
}

const skillsDeclaradas = dirs(SKILLS_DIR);
let rutasGestionadas = null;
try {
  const registro = JSON.parse(leer(join(ROOT, '.sdd/installed.json')) || 'null');
  const rutas = Object.entries(registro?.files || {})
    .filter(([ruta, meta]) => /^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(ruta) && meta?.policy === 'managed')
    .map(([ruta]) => ruta.split('/')[2]);
  if (rutas.length) rutasGestionadas = new Set(rutas);
} catch {
  // La seccion de instalacion informa un installed.json invalido; aqui se conserva compatibilidad.
}
const skillsCanonicas = rutasGestionadas
  ? skillsDeclaradas.filter((skill) => rutasGestionadas.has(skill))
  : skillsDeclaradas;
const skillsPropias = rutasGestionadas
  ? skillsDeclaradas.filter((skill) => !rutasGestionadas.has(skill))
  : [];
const skillsClaude = dirs(join(ROOT, '.claude/skills'));
if (nombresAgentes.size !== 20)
  err('paridad/agentes', `se esperaban 20 agentes canónicos y hay ${nombresAgentes.size}`);
if (skillsCanonicas.length !== 27)
  err('paridad/skills', `se esperaban 27 skills canónicas y hay ${skillsCanonicas.length}`);
if (skillsPropias.length)
  warn('paridad/skills-propias', `${skillsPropias.length} skill(s) propias preservadas fuera del contrato instalado: ${skillsPropias.join(', ')}`);
const adaptersFaltantes = skillsCanonicas.filter((skill) => !skillsClaude.includes(skill));
if (adaptersFaltantes.length)
  err('paridad/skills', `.claude/skills no adapta: ${adaptersFaltantes.join(', ')}`);
for (const skill of skillsCanonicas.filter((nombre) => skillsClaude.includes(nombre))) {
  const adapter = leer(join(ROOT, '.claude/skills', skill, 'SKILL.md')) || '';
  if (!adapter.includes(`.agents/skills/${skill}/SKILL.md`))
    err('paridad/skills', `.claude/skills/${skill}/SKILL.md no referencia la fuente canónica portable`);
}

// Una skill ya aparece como comando `/` en los hosts compatibles. Mantener además un
// prompt/command homónimo produce dos entradas visibles con contratos que pueden divergir.
function nombresDeFicheros(dir, sufijo) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entrada) => entrada.isFile() && entrada.name.endsWith(sufijo))
      .map((entrada) => entrada.name.slice(0, -sufijo.length))
      .sort();
  } catch {
    return [];
  }
}

const comandosPorHost = [
  ['.github/prompts', nombresDeFicheros(join(ROOT, '.github/prompts'), '.prompt.md')],
  ['.cursor/commands', nombresDeFicheros(join(ROOT, '.cursor/commands'), '.md')],
];
for (const [superficie, nombres] of comandosPorHost) {
  const duplicados = nombres.filter((nombre) => skillsCanonicas.includes(nombre));
  if (duplicados.length)
    err('superficie/comando-duplicado', `${superficie} duplica skills canónicas: ${duplicados.join(', ')}`);
}

const vscodeSettingsRaw = leer(join(ROOT, '.vscode/settings.json'));
if (vscodeSettingsRaw) {
  try {
    const settings = parseJsonc(vscodeSettingsRaw);
    const esperadas = [
      ['chat.agentFilesLocations', '.github/agents', true],
      ['chat.agentFilesLocations', '.claude/agents', false],
      ['chat.agentSkillsLocations', '.agents/skills', true],
      ['chat.agentSkillsLocations', '.claude/skills', false],
      ['chat.hookFilesLocations', '.github/hooks', true],
      ['chat.hookFilesLocations', '.claude/settings.json', false],
    ];
    for (const [grupo, ruta, valor] of esperadas)
      if (settings[grupo]?.[ruta] !== valor)
        err('superficie/vscode-duplicada', `.vscode/settings.json debe fijar ${grupo}.${ruta} = ${valor}`);
  } catch (error) {
    err('superficie/vscode-json', `.vscode/settings.json no es JSONC vÃ¡lido: ${error.message}`);
  }
}

const contratoIntake = [
  '.agents/skills/sdd-intake/SKILL.md',
  '.claude/skills/sdd-intake/SKILL.md',
  'docs/product/PRD.md',
  'docs/product/USE-CASES.md',
  'docs/product/FEATURE-MAP.md',
  'docs/product/SOURCES.md',
];
for (const ruta of contratoIntake) {
  if (!existsSync(join(ROOT, ruta))) err('intake/estructura', `falta ${ruta}`);
}
for (const ruta of [
  '.claude/agents/orchestrator.md', '.claude/agents/spec-analyst.md', '.claude/agents/ux-designer.md',
  '.github/agents/orchestrator.agent.md', '.cursor/agents/orchestrator.md', '.codex/agents/orchestrator.toml',
  '.agents/agents/orchestrator.md', '.gemini/agents/orchestrator.md',
  '.agents/workflows/sdd-proyecto-nuevo.md', '.agents/workflows/sdd-nueva-funcionalidad.md',
]) {
  if (!/sdd-intake|\bintake\b/i.test(leer(join(ROOT, ruta)) || ''))
    err('intake/routing', `${ruta} no reconoce la fase intake`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 ter · Mapa de territorios: quién puede escribir dónde
//
// Es lo que impide que un agente haga el trabajo de otro. Si nombra agentes que ya no
// existen, deja de proteger justo donde crees que protege.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Vocabulario de gates. Un identificador libre convierte checks.json en un cajón de sastre
// donde cada proyecto inventa el suyo y ninguna herramienta puede razonar sobre el conjunto:
// ni CI sabe qué es lento, ni /sdd-verify sabe qué falta por configurar.
// ─────────────────────────────────────────────────────────────────────────────
const GATES_PERMITIDOS = new Set([
  'sdd', 'lint', 'test', 'typecheck', 'build', 'smells',
  'coverage', 'e2e', 'visual', 'a11y', 'security', 'deps-audit', 'docs', 'mutation',
]);
const checksRaw = leer(join(ROOT, '.sdd/checks.json'));
let cfgChecks = null;
if (checksRaw) {
  try {
    cfgChecks = JSON.parse(checksRaw);
  } catch (e) {
    err('checks/json', `.sdd/checks.json no es JSON válido: ${e.message}`);
  }
  if (cfgChecks) {
    // El sufijo `:lenguaje` permite `test:python` sin abrir el vocabulario.
    const base = (id) => String(id).split(':')[0];
    for (const id of Object.keys(cfgChecks.checks || {}))
      if (!GATES_PERMITIDOS.has(base(id)))
        err('checks/vocabulario', `gate '${id}' fuera del vocabulario permitido (${[...GATES_PERMITIDOS].join(', ')})`);
    for (const id of cfgChecks.unconfigured || [])
      if (!GATES_PERMITIDOS.has(base(id)))
        err('checks/vocabulario', `'${id}' en unconfigured no es un gate reconocido`);
    for (const [id, check] of Object.entries(cfgChecks.checks || {}))
      if (check?.speed && !['fast', 'slow'].includes(check.speed))
        err('checks/velocidad', `gate '${id}': speed '${check.speed}' no válido (fast | slow)`);
  }
}
const gateSeguridadConfigurado = Object.entries(cfgChecks?.checks || {}).some(([id, check]) =>
  String(id).split(':')[0] === 'security' && typeof check?.command === 'string' && check.command.trim() &&
  check.required === true && check.enabled !== false && (check.speed || 'slow') === 'slow');
// El runner concreto depende del stack. La spec decide si se exige; cuando aplica, solo una
// configuración bloqueante y lenta cuenta como gate real.
const gateA11yConfigurado = Object.entries(cfgChecks?.checks || {}).some(([id, check]) =>
  String(id).split(':')[0] === 'a11y' && typeof check?.command === 'string' && check.command.trim() &&
  check.required === true && check.enabled !== false && (check.speed || 'slow') === 'slow');

const docsRaw = leer(join(ROOT, '.sdd/docs.json'));
let cfgDocs = null;
if (docsRaw !== null) {
  try {
    cfgDocs = parseJsonc(docsRaw);
    const validacion = validateDocsConfig(cfgDocs, { root: ROOT, checks: cfgChecks || {}, requireNonEmpty: false });
    const errores = Array.isArray(validacion) ? validacion : validacion?.errors || [];
    for (const mensaje of errores) err('docs/contrato', mensaje);
  } catch (error) {
    err('docs/contrato', `.sdd/docs.json no es válido: ${error.message}`);
  }
}
const setsDocumentales = new Map((cfgDocs?.documentSets || []).map((set) => [set.id, set]));

let estadoDocsParaDiff = null;
try { estadoDocsParaDiff = JSON.parse(leer(join(ROOT, '.sdd/installed.json')) || 'null')?.documentation || null; }
catch { /* el error de installed.json se informa en su sección */ }
const docsLegacySinUmbral = estadoDocsParaDiff?.status === 'legacy-pending' &&
  !dirs(join(ROOT, 'docs/specs')).some((spec) =>
    Number.parseInt(spec.slice(0, 3), 10) >= Number(estadoDocsParaDiff.enforceFromSpec));
if (DOCS_DIFF && (cfgDocs?.mode !== 'enforce' || !cfgDocs?.documentSets?.length)) {
  if (docsLegacySinUmbral)
    warn('docs/diff-contract', `N/A: brownfield legacy-pending; el contrato se exigirá desde la spec ${estadoDocsParaDiff.enforceFromSpec}`);
  else
    err('docs/diff-contract', 'NO EJECUTADO: --docs-diff exige `.sdd/docs.json` aprobado, en modo enforce y con documentSets');
}

function artefactosDeclarados(patron) {
  const normalizado = normalizeDocPath(patron, ROOT);
  if (!/[*?]/.test(normalizado)) return [normalizado];
  return walk(ROOT, () => true).map((ruta) => rel(ruta))
    .filter((ruta) => matchesDocPattern(ruta, normalizado));
}

if (cfgDocs?.mode === 'enforce') {
  for (const set of cfgDocs.documentSets || []) {
    if (set.generated) continue;
    for (const patron of set.artifacts || []) {
      let declarados;
      try { declarados = artefactosDeclarados(patron); }
      catch (error) { err('docs/ruta', `${set.id}: ${error.message}`); continue; }
      if (!declarados.length) {
        err('docs/artefacto', `${set.id}: el patrón oficial ${patron} no resuelve ningún artefacto`);
        continue;
      }
      for (const relativa of declarados) {
        try { normalizeDocPath(relativa, ROOT); }
        catch (error) { err('docs/ruta', `${set.id}: ${error.message}`); continue; }
        const absoluta = resolve(ROOT, relativa);
        if (!existsSync(absoluta) || !statSync(absoluta).isFile()) {
          err('docs/artefacto', `${set.id}: no existe el artefacto oficial ${relativa}`);
          continue;
        }
        if (!/\.md$/i.test(relativa)) continue;
        const contenido = leer(absoluta) || '';
        enlacesMarkdownValidos(relativa, contenido);
        if (tienePlaceholderDocumental(contenido))
          err('docs/placeholder', `${set.id}: ${relativa} conserva un placeholder documental`);
      }
    }
  }
}

const territoriosRaw = leer(join(ROOT, '.sdd/territories.json'));
if (territoriosRaw) {
  let cfg;
  try {
    cfg = JSON.parse(territoriosRaw);
  } catch (e) {
    err('territorios/json', `.sdd/territories.json no es JSON válido: ${e.message}`);
  }

  if (cfg) {
    if (!['audit', 'deny', 'ask', 'off'].includes(cfg.modo))
      err('territorios/modo', `modo '${cfg.modo}' no válido (deny | ask | off)`);
    if (cfg.modo === 'off')
      warn('territorios/modo', 'el reparto de territorios está desactivado: nadie impide que un agente escriba fuera de su terreno');

    for (const a of cfg.coordinadores || [])
      if (!nombresAgentes.has(a)) err('territorios/agente', `coordinador '${a}' no existe en .claude/agents/`);

    const conDueño = new Set();
    const territorios = Array.isArray(cfg.territories)
      ? cfg.territories.map((t, i) => [t.name || `territory-${i + 1}`, { duenos: [t.agent], patrones: t.paths }])
      : Object.entries(cfg.territorios || {});
    for (const [nombre, t] of territorios) {
      if (!Array.isArray(t.duenos) || !t.duenos.length)
        err('territorios/duenos', `territorio '${nombre}' sin dueños: no protege nada`);
      for (const a of t.duenos || []) {
        if (!nombresAgentes.has(a)) err('territorios/agente', `'${a}' (dueño de '${nombre}') no existe en .claude/agents/`);
        conDueño.add(a);
      }
      if (!Array.isArray(t.patrones) || !t.patrones.length)
        err('territorios/patrones', `territorio '${nombre}' sin patrones`);
    }

    // Antes de activar ask/deny, /onboard debe gobernar a todos los agentes que escriben.
    if (['ask', 'deny'].includes(cfg.modo)) {
      const AUDITORES = new Set(['code-reviewer', 'security-auditor', 'research-analyst', 'orchestrator']);
      for (const a of nombresAgentes) {
        if (conDueño.has(a) || (cfg.coordinadores || []).includes(a) || AUDITORES.has(a)) continue;
        warn('territorios/huerfano', `'${a}' no es dueño de ningún territorio ni coordinador: puede escribir en cualquier sitio no reclamado`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · Hooks referenciados en settings.json que existan de verdad
// ─────────────────────────────────────────────────────────────────────────────
const settings = leer(join(ROOT, '.claude/settings.json'));
if (settings) {
  let cfg;
  try {
    cfg = JSON.parse(settings);
  } catch (e) {
    err('settings/json', `.claude/settings.json no es JSON válido: ${e.message}`);
  }
  for (const grupos of Object.values(cfg?.hooks || {})) {
    for (const g of grupos) {
      for (const h of g.hooks || []) {
        const m = String(h.command || '').match(/\.sdd\/hooks\/([\w-]+\.mjs)/);
        if (m && !existsSync(join(ROOT, '.sdd/hooks', m[1])))
          err('hook/inexistente', `settings.json referencia ${m[1]}, que no existe`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 · Specs: estructura, trazabilidad y evidencia
// ─────────────────────────────────────────────────────────────────────────────
const SPECS = join(ROOT, process.env.SDD_SPECS_DIR || 'docs/specs');
const specs = dirs(SPECS).filter((s) => !soloSpec || s.startsWith(soloSpec));
const ficherosTest = walk(ROOT, (n) => /\.(test|spec)\.[jt]sx?$/.test(n) || /^test_.*\.py$/.test(n));
const textoTests = ficherosTest.map((p) => leer(p) || '').join('\n');
let contratoProducto = null;
let contratoSeguridad = null;
let contratoUsabilidad = null;
let contratoDocumentacion = null;
try {
  const registro = JSON.parse(leer(join(ROOT, '.sdd/installed.json')) || 'null');
  if (registro?.product?.status === 'approved') contratoProducto = registro.product;
  if (registro?.security) contratoSeguridad = registro.security;
  if (registro?.usability) contratoUsabilidad = registro.usability;
  if (registro?.documentation) contratoDocumentacion = registro.documentation;
} catch {
  // El error de JSON se informa una sola vez en la seccion de instalacion.
}
const idsProducto = {
  objetivos: new Set([...(leer(join(ROOT, 'docs/product/PRD.md')) || '').matchAll(/\bOBJ-\d{3}\b/g)].map((m) => m[0])),
  requisitos: new Set([...(leer(join(ROOT, 'docs/product/PRD.md')) || '').matchAll(/\bPRD-RF-\d{3}\b/g)].map((m) => m[0])),
  casos: new Set([...(leer(join(ROOT, 'docs/product/USE-CASES.md')) || '').matchAll(/\bUC-\d{3}\b/g)].map((m) => m[0])),
};
const filasFeatureProducto = (leer(join(ROOT, 'docs/product/FEATURE-MAP.md')) || '')
  .split('\n').filter((linea) => /^\|\s*FEAT-\d{3}\s*\|/.test(linea));
const seguridadPorSpec = new Map();
const usabilidadPorSpec = new Map();

let tareasHechas = 0;

for (const s of specs) {
  const dir = join(SPECS, s);
  const spec = leer(join(dir, 'spec.md'));
  if (!spec) {
    err('spec/estructura', `${s}: falta spec.md`);
    continue;
  }

  const numeroSpec = Number((s.match(/^(\d{3})-/) || [])[1]);
  let referenciasProductoSpec = null;
  if (contratoProducto && Number.isFinite(numeroSpec) && numeroSpec >= contratoProducto.enforceFromSpec) {
    referenciasProductoSpec = {
      objetivos: new Set([...spec.matchAll(/\bOBJ-\d{3}\b/g)].map((m) => m[0])),
      requisitos: new Set([...spec.matchAll(/\bPRD-RF-\d{3}\b/g)].map((m) => m[0])),
      casos: new Set([...spec.matchAll(/\bUC-\d{3}\b/g)].map((m) => m[0])),
    };
    for (const [tipo, conjunto] of Object.entries(referenciasProductoSpec)) {
      if (!conjunto.size) {
        const mensaje = `${s}: falta trazabilidad de producto (${tipo})`;
        STRICT ? err('producto/trazabilidad', mensaje) : warn('producto/trazabilidad', mensaje);
      }
      const huerfanos = [...conjunto].filter((id) => !idsProducto[tipo].has(id));
      if (huerfanos.length) {
        const mensaje = `${s}: referencias de producto huerfanas: ${huerfanos.join(', ')}`;
        STRICT ? err('producto/trazabilidad', mensaje) : warn('producto/trazabilidad', mensaje);
      }
    }
    const cadenasSpec = spec.split('\n').map(cadenaTrazable).filter(Boolean);
    if (!cadenasSpec.length) {
      const mensaje = `${s}: ninguna fila enlaza OBJ → PRD-RF → UC → RF → CA`;
      STRICT ? err('producto/cadena-spec', mensaje) : warn('producto/cadena-spec', mensaje);
    }
    for (const [tipo, campo] of [['objetivos', 'objetivo'], ['requisitos', 'requisitoProducto'], ['casos', 'caso']]) {
      const fueraDeCadena = [...referenciasProductoSpec[tipo]]
        .filter((id) => !cadenasSpec.some((cadena) => cadena[campo] === id));
      if (fueraDeCadena.length) {
        const mensaje = `${s}: referencias fuera de una cadena completa: ${fueraDeCadena.join(', ')}`;
        STRICT ? err('producto/cadena-spec', mensaje) : warn('producto/cadena-spec', mensaje);
      }
    }
    const requisitosLocales = new Set([...spec.matchAll(/(?<!PRD-)\bRF-\d+\b/g)].map((m) => m[0]));
    const criteriosLocales = new Set([...spec.matchAll(/\bCA-\d+\b/g)].map((m) => m[0]));
    for (const [nombre, conjunto, campo] of [
      ['RF', requisitosLocales, 'requisitoSpec'],
      ['CA', criteriosLocales, 'criterio'],
    ]) {
      const fueraDeCadena = [...conjunto].filter((id) => !cadenasSpec.some((cadena) => cadena[campo] === id));
      if (fueraDeCadena.length) {
        const mensaje = `${s}: ${nombre} sin cadena completa de producto: ${fueraDeCadena.join(', ')}`;
        STRICT ? err('producto/cadena-spec', mensaje) : warn('producto/cadena-spec', mensaje);
      }
    }
    for (const cadena of cadenasSpec) {
      if (!filasFeatureProducto.some((fila) =>
        fila.includes(cadena.objetivo) && fila.includes(cadena.requisitoProducto) && fila.includes(cadena.caso))) {
        const mensaje = `${s}: la cadena ${cadena.objetivo}/${cadena.requisitoProducto}/${cadena.caso} no existe unida en FEATURE-MAP.md`;
        STRICT ? err('producto/cadena-feature', mensaje) : warn('producto/cadena-feature', mensaje);
      }
    }
    referenciasProductoSpec.cadenas = cadenasSpec;
  }

  // 3.1 · La spec no avanza con ambigüedades sin resolver
  const marcadores = (spec.match(/\[NEEDS CLARIFICATION/g) || []).length;
  const plan = leer(join(dir, 'plan.md')) || '';
  const tienePlan = Boolean(plan);
  if (marcadores && tienePlan)
    err('spec/clarify', `${s}: ${marcadores} marcador(es) [NEEDS CLARIFICATION] y ya existe plan.md — se planificó sobre ambigüedad`);

  // 3.1 bis · El diseño tampoco avanza con ambigüedades sin resolver
  const design = leer(join(dir, 'design.md'));
  if (design) {
    const sinUi = /no aplica|sin interfaz gr[áa]fica|dise[ñn]o se salta/i.test(design);
    const marcadoresDiseño = (design.match(/\[NEEDS CLARIFICATION/g) || []).length;
    if (marcadoresDiseño && tienePlan)
      err(
        'design/clarify',
        `${s}: ${marcadoresDiseño} marcador(es) [NEEDS CLARIFICATION] en design.md y ya existe plan.md`,
      );

    // Los gates visuales no aplican a CLI, jobs o migraciones cuya omisión esté declarada.
    if (!sinUi) {
    // Los estados no felices son la mitad del diseño y son lo primero que se olvida.
    const faltan = ['vacío', 'cargando', 'error', 'sin permiso'].filter(
      (e) => !new RegExp(e.replace('í', '[íi]'), 'i').test(design),
    );
    if (faltan.length)
      warn('design/estados', `${s}: design.md no menciona estado(s): ${faltan.join(', ')}`);

    // Cumplir accesibilidad y estados es el suelo. Sin dirección visual declarada, el
    // resultado por defecto es el MVP genérico: correcto y sin carácter.
    const direccion = leer(join(ROOT, 'docs/design/DIRECCION-VISUAL.md'));
    const filaEstado = (direccion || '').match(/^\|\s*\*{0,2}Estado\*{0,2}\s*\|([^|]*)\|/im)?.[1] || '';
    // La plantilla ofrece las dos opciones en la misma celda ("borrador | aprobada"). Solo
    // cuenta como aprobada cuando se ha elegido: queda 'aprobada' y ya no queda 'borrador'.
    const aprobada = /aprobada/i.test(filaEstado) && !/borrador/i.test(filaEstado);

    if (!direccion) {
      warn('design/direccion', `${s}: hay design.md pero no existe docs/design/DIRECCION-VISUAL.md`);
    } else if (!aprobada) {
      const m = `${s}: la dirección visual sigue sin aprobar (docs/design/DIRECCION-VISUAL.md, campo Estado)`;
      STRICT ? err('design/direccion', m) : warn('design/direccion', m);
    }
    if (!/car[áa]cter/i.test(design))
      warn('design/caracter', `${s}: ninguna pantalla declara su elemento con carácter`);
    }
  }

  // 3.1 ter · Prioridad: una spec sin prioridades es una lista de deseos
  if (/\bRF-\d+\b/.test(spec)) {
    const tienePrioridad =
      /\|\s*(M|S|C|W)\s*\|/.test(spec) || /\b(must|should|could|won't)\b/i.test(spec);
    if (!tienePrioridad)
      warn(
        'spec/prioridad',
        `${s}: hay requisitos pero ninguna prioridad MoSCoW. Sin prioridad no hay alcance negociable`,
      );
    else if (/Reparto MoSCoW/i.test(spec) && !/%/.test(spec))
      warn('spec/prioridad', `${s}: hay tabla de reparto MoSCoW sin porcentajes calculados`);
  }

  const tasks = leer(join(dir, 'tasks.md'));
  if (tienePlan && !tasks) warn('spec/estructura', `${s}: hay plan.md pero no tasks.md`);

  const impactoDocs = impactoDocumentacion(spec);
  const aplicaContratoDocs = contratoDocumentacion && Number.isFinite(numeroSpec) &&
    /^\d{3}$/.test(String(contratoDocumentacion.enforceFromSpec || '')) &&
    numeroSpec >= Number(contratoDocumentacion.enforceFromSpec);
  if (aplicaContratoDocs && !impactoDocs) {
    const mensaje = `${s}: falta Impacto de documentación (aplicable · DOC-* | no-aplica · motivo | docs-pending)`;
    STRICT ? err('docs/impacto', mensaje) : warn('docs/impacto', mensaje);
  }
  if (impactoDocs?.estado === 'invalido')
    err('docs/impacto', `${s}: Impacto de documentación no es válido: '${impactoDocs.valor}'`);
  if (impactoDocs?.estado === 'no-aplica' && !valorConcreto(impactoDocs.motivo))
    err('docs/impacto', `${s}: no-aplica necesita un motivo material`);
  if (impactoDocs?.estado === 'docs-pending' && tienePlan) {
    const mensaje = `${s}: no puede aprobar plan.md mientras el impacto documental siga docs-pending`;
    STRICT ? err('docs/impacto', mensaje) : warn('docs/impacto', mensaje);
  }

  const filasDocs = matrizDocumentacion(plan);
  if (impactoDocs?.estado === 'aplicable') {
    if (!impactoDocs.ids.length)
      err('docs/impacto', `${s}: impacto aplicable necesita al menos un DOC-ID`);
    if (!filasDocs.length) {
      const mensaje = `${s}: impacto aplicable necesita matriz DOC-ID → fuente → artefacto → tarea → comprobación → evidencia`;
      STRICT ? err('docs/matriz', mensaje) : warn('docs/matriz', mensaje);
    }
    for (const id of impactoDocs.ids) {
      if ((aplicaContratoDocs || cfgDocs?.mode === 'enforce') && !setsDocumentales.has(id))
        err('docs/contrato', `${s}: ${id} no está declarado en .sdd/docs.json`);
      const fila = filasDocs.find((candidata) => candidata.id === id);
      if (!fila) {
        const mensaje = `${s}: ${id} no aparece en la matriz documental del plan`;
        STRICT ? err('docs/matriz', mensaje) : warn('docs/matriz', mensaje);
        continue;
      }
      for (const [campo, valor] of Object.entries({
        fuente: fila.fuente, artefacto: fila.artefacto, tarea: fila.tarea,
        comprobación: fila.comprobacion, evidencia: fila.evidencia,
      })) if (!valorConcreto(valor)) err('docs/matriz', `${s}/${id}: falta ${campo} concreto`);
      if (!/\bT-\d{3}-\d+\b/.test(fila.tarea || ''))
        err('docs/matriz', `${s}/${id}: la tarea debe usar un ID T-NNN-NN`);
      if (!String(fila.evidencia || '').includes(`evidence.md#${id}`))
        err('docs/matriz', `${s}/${id}: la evidencia debe enlazar evidence.md#${id}`);
    }
  }

  const impacto = impactoSeguridad(spec);
  const impactosValidos = new Set(['sensible', 'no-sensible', 'security-pending']);
  const aplicaContratoSeguridad = contratoSeguridad && Number.isFinite(numeroSpec) &&
    /^\d{3}$/.test(String(contratoSeguridad.enforceFromSpec || '')) &&
    numeroSpec >= Number(contratoSeguridad.enforceFromSpec);
  if (aplicaContratoSeguridad && !impacto) {
    const mensaje = `${s}: falta Impacto de seguridad (sensible | no-sensible | security-pending)`;
    STRICT ? err('seguridad/impacto', mensaje) : warn('seguridad/impacto', mensaje);
  }
  if (impacto && !impactosValidos.has(impacto))
    err('seguridad/impacto', `${s}: Impacto de seguridad debe ser sensible | no-sensible | security-pending`);
  if (impacto === 'security-pending' && tienePlan) {
    const mensaje = `${s}: no puede aprobar plan.md mientras el impacto siga security-pending`;
    STRICT ? err('seguridad/impacto', mensaje) : warn('seguridad/impacto', mensaje);
  }
  const controlesSeguridad = matrizSeguridad(plan);
  if (impacto === 'sensible' && !controlesSeguridad.length) {
    const mensaje = `${s}: una spec sensible necesita la matriz Control | ASVS | OWASP | Aplica | Decisión | Tarea | Test | Evidencia`;
    STRICT ? err('seguridad/matriz', mensaje) : warn('seguridad/matriz', mensaje);
  }
  const idsControles = new Set();
  for (const control of controlesSeguridad) {
    if (Object.values(control).some((valor) => /<[^>]+>/.test(String(valor)))) {
      if (STRICT && impacto === 'sensible')
        err('seguridad/matriz', `${s}: la matriz de seguridad conserva marcadores de plantilla`);
      continue;
    }
    if (!/^SEC-[A-Z0-9]+-\d{3}$/.test(control.control))
      err('seguridad/control', `${s}: ID de control '${control.control}' inválido; usa SEC-<AREA>-NNN`);
    else if (idsControles.has(control.control)) err('seguridad/control', `${s}: control duplicado ${control.control}`);
    idsControles.add(control.control);
    if (!['sí', 'si', 'no'].includes(control.aplica))
      err('seguridad/aplica', `${s}/${control.control}: Aplica debe ser sí | no`);
    const aplica = ['sí', 'si'].includes(control.aplica);
    if (aplica) {
      for (const [campo, valor] of Object.entries({
        ASVS: control.asvs, OWASP: control.owasp, decisión: control.decision,
        tarea: control.tarea, test: control.test, evidencia: control.evidencia,
      })) {
        if (!valorConcreto(valor)) err('seguridad/matriz', `${s}/${control.control}: falta ${campo} concreto`);
      }
      const sinFormato = (valor) => String(valor || '').replace(/[`*]/g, '').trim();
      if (!/5\.0\.0/.test(sinFormato(control.asvs)))
        err('seguridad/matriz', `${s}/${control.control}: ASVS debe conservar la versión 5.0.0`);
      if (!/(?:A\d{2}|Top 10):2025/.test(sinFormato(control.owasp)))
        err('seguridad/matriz', `${s}/${control.control}: OWASP debe usar un identificador :2025`);
      if (!/^T-\d{3}-\d+$/.test(sinFormato(control.tarea)))
        err('seguridad/matriz', `${s}/${control.control}: Tarea debe ser un ID T-NNN-NN`);
      if (!/[/.][^\s]*::[^\s]+/.test(sinFormato(control.test)))
        err('seguridad/matriz', `${s}/${control.control}: Test debe ser una referencia concreta ruta::caso`);
      if (sinFormato(control.evidencia) !== `evidence.md#${control.control}`)
        err('seguridad/matriz', `${s}/${control.control}: Evidencia debe enlazar evidence.md#${control.control}`);
    } else if (!valorConcreto(control.decision)) {
      err('seguridad/matriz', `${s}/${control.control}: un control no aplicable necesita justificación concreta`);
    }
  }
  seguridadPorSpec.set(s, { impacto, controles: controlesSeguridad, tasks: tasks || '', testPlan: '', evidence: '' });

  // ── Usabilidad: mismo contrato que seguridad, sobre WCAG 2.2 AA y las diez heurísticas ──
  const impactoUX = impactoUsabilidad(spec);
  const aplicaContratoUsabilidad = contratoUsabilidad && Number.isFinite(numeroSpec) &&
    /^\d{3}$/.test(String(contratoUsabilidad.enforceFromSpec || '')) &&
    numeroSpec >= Number(contratoUsabilidad.enforceFromSpec);
  if (aplicaContratoUsabilidad && !impactoUX) {
    const mensaje = `${s}: falta Impacto de usabilidad (aplicable | sin-ui · <motivo material> | ux-pending)`;
    STRICT ? err('usabilidad/impacto', mensaje) : warn('usabilidad/impacto', mensaje);
  }
  if (impactoUX?.estado === 'invalido')
    err('usabilidad/impacto', `${s}: Impacto de usabilidad debe ser aplicable | sin-ui · <motivo> | ux-pending; valor '${impactoUX.valor}'`);
  if (impactoUX?.estado === 'sin-ui' && !valorConcreto(impactoUX.motivo))
    err('usabilidad/impacto', `${s}: un Impacto de usabilidad sin-ui necesita un motivo material, no "no procede"`);
  if (impactoUX?.estado === 'ux-pending' && tienePlan) {
    const mensaje = `${s}: no puede aprobar plan.md mientras el impacto siga ux-pending`;
    STRICT ? err('usabilidad/impacto', mensaje) : warn('usabilidad/impacto', mensaje);
  }
  const controlesUsabilidad = matrizUsabilidad(plan);
  if (impactoUX?.estado === 'aplicable' && !controlesUsabilidad.length) {
    const mensaje = `${s}: una spec con usabilidad aplicable necesita la matriz Control | WCAG 2.2 | Heurística | Aplica | Decisión | Tarea | Test | Evidencia`;
    STRICT ? err('usabilidad/matriz', mensaje) : warn('usabilidad/matriz', mensaje);
  }
  const idsUX = new Set();
  for (const control of controlesUsabilidad) {
    if (Object.values(control).some((valor) => /<[^>]+>/.test(String(valor)))) {
      if (STRICT && impactoUX?.estado === 'aplicable')
        err('usabilidad/matriz', `${s}: la matriz de usabilidad conserva marcadores de plantilla`);
      continue;
    }
    if (!/^UX-(?:A11Y|FORM|COPY|PERF)-\d{3}$/.test(control.control))
      err('usabilidad/control', `docs/specs/${s}/plan.md: el control '${control.control}' no cumple el formato ` +
        'UX-<A11Y|FORM|COPY|PERF>-NNN. Corrige el ID en la matriz de usabilidad y sus referencias');
    else if (idsUX.has(control.control)) err('usabilidad/control', `${s}: control duplicado ${control.control}`);
    idsUX.add(control.control);
    if (!['sí', 'si', 'no'].includes(control.aplica))
      err('usabilidad/aplica', `${s}/${control.control}: Aplica debe ser sí | no`);
    const aplica = ['sí', 'si'].includes(control.aplica);
    const sinFormato = (valor) => String(valor || '').replace(/[`*]/g, '').trim();
    if (aplica) {
      for (const [campo, valor] of Object.entries({
        decisión: control.decision, tarea: control.tarea, test: control.test, evidencia: control.evidencia,
      })) {
        if (!valorConcreto(valor)) err('usabilidad/matriz', `${s}/${control.control}: falta ${campo} concreto`);
      }
      // Un control de accesibilidad sin criterio WCAG es una casilla vacía con nombre bonito.
      // Fuera de A11Y, `n/a` es una respuesta legítima: el microcopy no tiene criterio WCAG.
      if (control.control.startsWith('UX-A11Y-') && !/2\.2/.test(sinFormato(control.wcag)))
        err('usabilidad/matriz', `${s}/${control.control}: un control de accesibilidad debe citar un criterio WCAG 2.2`);
      if (!sinFormato(control.wcag))
        err('usabilidad/matriz', `${s}/${control.control}: WCAG 2.2 vacío; usa el criterio o n/a`);
      if (!/^(?:H(?:10|[1-9])|n\/a)/i.test(sinFormato(control.heuristica)))
        err('usabilidad/matriz', `${s}/${control.control}: Heurística debe ser H1…H10 o n/a`);
      if (!/^T-\d{3}-\d+$/.test(sinFormato(control.tarea)))
        err('usabilidad/matriz', `${s}/${control.control}: Tarea debe ser un ID T-NNN-NN`);
      if (!/[/.][^\s]*::[^\s]+/.test(sinFormato(control.test)))
        err('usabilidad/matriz', `${s}/${control.control}: Test debe ser una referencia concreta ruta::caso`);
      if (sinFormato(control.evidencia) !== `evidence.md#${control.control}`)
        err('usabilidad/matriz', `${s}/${control.control}: Evidencia debe enlazar evidence.md#${control.control}`);
    } else if (!valorConcreto(control.decision)) {
      err('usabilidad/matriz', `${s}/${control.control}: un control no aplicable necesita justificación concreta`);
    }
  }
  if (STRICT && impactoUX?.estado === 'aplicable') {
    const design = leer(join(dir, 'design.md'));
    if (design) {
      for (const hueco of tablasDiseñoIncompletas(design))
        err('diseno/tabla', `${s}: design.md deja una comprobación sin estado — ${hueco}`);
    }
  }
  usabilidadPorSpec.set(s, {
    impacto: impactoUX, controles: controlesUsabilidad, tasks: tasks || '', testPlan: '', evidence: '',
  });

  if (!tasks) {
    if (STRICT && impactoUX?.estado === 'aplicable' && controlesUsabilidad.some((c) => ['sí', 'si'].includes(c.aplica)))
      err('usabilidad/trazabilidad', `${s}: una spec con usabilidad aplicable necesita tasks.md para propagar sus controles`);
    if (STRICT && impacto === 'sensible')
      err('seguridad/trazabilidad', `${s}: una spec sensible necesita tasks.md para propagar sus controles`);
    if (STRICT && impactoDocs?.estado === 'aplicable')
      err('docs/trazabilidad', `${s}: una spec con documentación aplicable necesita tasks.md`);
    continue;
  }
  if (referenciasProductoSpec) {
    const noPropagadas = Object.entries(referenciasProductoSpec).filter(([tipo]) => tipo !== 'cadenas')
      .map(([, conjunto]) => conjunto)
      .flatMap((conjunto) => [...conjunto].filter((id) => !tasks.includes(id)));
    if (noPropagadas.length) {
      const mensaje = `${s}: tasks.md no propaga la trazabilidad de producto: ${noPropagadas.join(', ')}`;
      STRICT ? err('producto/tareas', mensaje) : warn('producto/tareas', mensaje);
    }
    const bloquesTarea = tasks.split(/^### /m).slice(1);
    for (const cadena of referenciasProductoSpec.cadenas || []) {
      if (!bloquesTarea.some((bloque) => coincideCadena(bloque, cadena, { conTarea: true, conTest: true }))) {
        const mensaje = `${s}: ninguna tarea enlaza completa la cadena de ${cadena.requisitoProducto}/${cadena.criterio} con su test`;
        STRICT ? err('producto/cadena-tarea', mensaje) : warn('producto/cadena-tarea', mensaje);
      }
    }
  }

  // 3.2 · Todo criterio de aceptación necesita un test que lo referencie
  const criterios = [...spec.matchAll(/\bCA-(\d+)\b/g)].map((m) => `CA-${m[1]}`);
  const unicos = [...new Set(criterios)];
  const evidence = leer(join(dir, 'evidence.md')) || '';
  const testPlan = leer(join(dir, 'test-plan.md')) || '';
  Object.assign(seguridadPorSpec.get(s), { testPlan, evidence });
  Object.assign(usabilidadPorSpec.get(s), { testPlan, evidence });
  if (impactoDocs?.estado === 'aplicable') {
    const bloquesTareaDocs = tasks.split(/^### /m).slice(1);
    for (const id of impactoDocs.ids) {
      const fila = filasDocs.find((candidata) => candidata.id === id);
      if (!fila) continue;
      const tareas = [...new Set(String(fila.tarea || '').match(/\bT-\d{3}-\d+\b/g) || [])];
      const bloqueTarea = bloquesTareaDocs.find((bloque) =>
        tareas.some((tarea) => bloque.startsWith(tarea)) &&
        new RegExp(`Documentaci[oó]n[^\n]*${escaparRegex(id)}`, 'i').test(bloque));
      const filaTestDocs = testPlan.split('\n').find((linea) =>
        linea.includes(id) && String(fila.comprobacion || '').split(/[,;]/)[0]
          .replace(/[`*]/g, '').trim().split('::').pop() &&
        linea.includes(String(fila.comprobacion || '').replace(/[`*]/g, '').trim().split('::').pop()));
      const filaEvidenceDocs = evidence.split('\n').find((linea) =>
        linea.includes(id) && tareas.some((tarea) => linea.includes(tarea)) &&
        String(fila.artefacto || '').split(/[,;]/).some((artefacto) =>
          linea.includes(artefacto.replace(/[`*]/g, '').trim())));
      const incidencias = [];
      if (!bloqueTarea) incidencias.push('tasks.md no enlaza DOC-ID con una tarea documental');
      if (!filaTestDocs) incidencias.push('test-plan.md no conserva la comprobación documental');
      if (!filaEvidenceDocs) incidencias.push('evidence.md no enlaza DOC-ID, tarea y artefacto');
      else if (STRICT && !tieneResultadoConcreto(filaEvidenceDocs))
        incidencias.push('evidence.md no contiene un resultado documental ejecutado');
      for (const incidencia of incidencias) {
        const mensaje = `${s}/${id}: ${incidencia}`;
        STRICT ? err('docs/trazabilidad', mensaje) : warn('docs/trazabilidad', mensaje);
      }
    }
  }
  for (const control of controlesSeguridad.filter((fila) => ['sí', 'si'].includes(fila.aplica))) {
    const limpiar = (valor) => String(valor || '').replace(/[`*]/g, '').trim();
    const tareaId = limpiar(control.tarea);
    const testRef = limpiar(control.test);
    const bloqueTarea = tasks.split(/^### /m).slice(1)
      .find((bloque) => new RegExp(`^${escaparRegex(tareaId)}(?:\\s|[·—-]|$)`).test(bloque));
    const filaTest = testPlan.split('\n')
      .find((linea) => linea.includes(control.control) && linea.includes(testRef));
    const filaEvidence = evidence.split('\n')
      .find((linea) => linea.includes(control.control) && linea.includes(tareaId) && linea.includes(testRef));
    control.traza = { tareaId, testRef, bloqueTarea, filaTest, filaEvidence };

    const incidencias = [];
    if (!bloqueTarea || !bloqueTarea.includes(control.control) || !bloqueTarea.includes(testRef))
      incidencias.push(`tasks.md no enlaza ${tareaId}, el control y ${testRef}`);
    if (!filaTest) incidencias.push(`test-plan.md no conserva ${testRef}`);
    if (!filaEvidence) incidencias.push('evidence.md no enlaza control, tarea y test');
    for (const incidencia of incidencias) {
      const mensaje = `${s}/${control.control}: ${incidencia}`;
      STRICT ? err('seguridad/trazabilidad', mensaje) : warn('seguridad/trazabilidad', mensaje);
    }
  }
  for (const control of controlesUsabilidad.filter((fila) => ['sí', 'si'].includes(fila.aplica))) {
    const limpiar = (valor) => String(valor || '').replace(/[`*]/g, '').trim();
    const tareaId = limpiar(control.tarea);
    const testRef = limpiar(control.test);
    // Sin tarea o sin test la fila ya se ha reportado como incompleta arriba. Volver a quejarse
    // aquí produce un mensaje con huecos ("no enlaza , el control y ") que no ayuda a nadie.
    if (!tareaId || !testRef) continue;
    const bloqueTarea = tasks.split(/^### /m).slice(1)
      .find((bloque) => new RegExp(`^${escaparRegex(tareaId)}(?:\\s|[·—-]|$)`).test(bloque));
    const filaTest = testPlan.split('\n')
      .find((linea) => linea.includes(control.control) && linea.includes(testRef));
    const filaEvidence = evidence.split('\n')
      .find((linea) => linea.includes(control.control) && linea.includes(tareaId) && linea.includes(testRef));
    control.traza = { tareaId, testRef, bloqueTarea, filaTest, filaEvidence };

    const incidencias = [];
    if (!bloqueTarea || !bloqueTarea.includes(control.control) || !bloqueTarea.includes(testRef))
      incidencias.push(`tasks.md no enlaza ${tareaId}, el control y ${testRef}`);
    if (!filaTest) incidencias.push(`test-plan.md no conserva ${testRef}`);
    if (!filaEvidence) incidencias.push('evidence.md no enlaza control, tarea y test');
    for (const incidencia of incidencias) {
      const mensaje = `${s}/${control.control}: ${incidencia}`;
      STRICT ? err('usabilidad/trazabilidad', mensaje) : warn('usabilidad/trazabilidad', mensaje);
    }
  }
  for (const ca of unicos) {
    const enTests = textoTests.includes(ca);
    const enArtefactos = tasks.includes(ca) || evidence.includes(ca) || testPlan.includes(ca);
    if (!enTests && !enArtefactos) {
      const m = `${s}: ${ca} no aparece en ninguna tarea, test, plan de test ni evidencia`;
      STRICT ? err('trazabilidad/CA', m) : warn('trazabilidad/CA', m);
    }
  }

  // 3.3 · Tareas hechas: evidencia y ejecución registrada
  const bloques = tasks.split(/^### /m).slice(1);
  const log = leer(join(dir, 'execution-log.jsonl')) || '';
  const hayEventos = log.trim().length > 0;

  for (const b of bloques) {
    const id = (b.match(/^(T-[\w-]+)/) || [])[1];
    if (!id) continue;
    const estado = (b.match(/Estado\**:\s*\**\s*(\w[\w\s]*)/i) || [])[1]?.trim().toLowerCase() || '';
    if (!estado.startsWith('hecho')) continue;
    tareasHechas++;

    if (!/Test que la define|Cubre/i.test(b))
      err('tarea/trazabilidad', `${s}/${id}: marcada hecho sin test asociado ni criterio que cubra`);

    if (STRICT) {
      if (!evidence.includes(id))
        err('tarea/evidencia', `${s}/${id}: marcada hecho pero no aparece en evidence.md`);
      const ejecucionDirecta = evidence.split('\n').some(
        (linea) => linea.includes(id) && /\bdeclared-direct\b/i.test(linea),
      );
      const ejecucionNoVerificada = evidence.split('\n').some(
        (linea) => linea.includes(id) && /\bunverified\b/i.test(linea) &&
          /motivo|no observad|sin hooks?|no expone|limitaci[oó]n|porque/i.test(linea),
      );
      if (!hayEventos && !ejecucionDirecta && !ejecucionNoVerificada)
        err(
          'tarea/ejecucion',
          `${s}/${id}: marcada hecho sin evento observado, declared-direct ni unverified con motivo para la tarea`,
        );
      if (referenciasProductoSpec) {
        const cadenasDeTarea = (referenciasProductoSpec.cadenas || []).filter((cadena) => coincideCadena(b, cadena));
        for (const cadena of cadenasDeTarea) {
          const filaEvidencia = evidence.split('\n').some((linea) =>
            linea.includes(id) && coincideCadena(linea, cadena, { conResultado: true }));
          if (!filaEvidencia)
            err('producto/cadena-evidencia', `${s}/${id}: evidence.md no enlaza la tarea con ${cadena.objetivo} → ${cadena.criterio}`);
        }
      }
    }
  }

  // 3.4 · Delegaciones no verificadas y decisión de entrega
  if (STRICT && evidence) {
    const sinVerificar = (evidence.match(/\bunverified\b/gi) || []).length;
    if (sinVerificar && !/no observad|limitaci[óo]n|motivo|porque/i.test(evidence))
      err('evidencia/unverified', `${s}: ${sinVerificar} delegación(es) 'unverified' sin justificación escrita`);

    if (!/##\s*3\.[\s\S]*?\|\s*\S/.test(evidence) && !/Controles NO ejecutados[\s\S]{0,400}\|\s*\w/i.test(evidence))
      warn('evidencia/no-ejecutado', `${s}: la sección de controles NO ejecutados está vacía. Si de verdad se ejecutó todo, dilo explícitamente`);
  }

  // 3.5 · El log de ejecución no se edita a mano
  for (const linea of log.split('\n').filter((l) => l.trim())) {
    try {
      JSON.parse(linea);
    } catch {
      err('log/formato', `${s}: execution-log.jsonl tiene una línea que no es JSON — ¿se editó a mano?`);
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Higiene del repositorio
// ─────────────────────────────────────────────────────────────────────────────
// Una plantilla instalada hace un año y nunca actualizada es deuda silenciosa.
const instalado = leer(join(ROOT, '.sdd/installed.json'));
if (instalado) {
  try {
    const reg = JSON.parse(instalado);
    const product = reg.product || {
      schemaVersion: 1,
      status: reg.mode === 'greenfield' ? 'bootstrap' : 'legacy-pending',
      approvedAt: null,
      approvedBy: null,
      enforceFromSpec: null,
      hashes: {},
    };
    if (product.schemaVersion !== 1 || !['bootstrap', 'legacy-pending', 'approved'].includes(product.status))
      err('producto/estado', 'el contrato product de .sdd/installed.json no tiene una version o estado validos');
    else if (product.status === 'legacy-pending')
      warn('producto/legacy-pending', 'el proyecto conserva su contexto, pero debe ejecutar /sdd-intake antes de exigir trazabilidad de producto nueva');
    else if (product.status === 'bootstrap') {
      const mensaje = 'el baseline de producto aun no esta aprobado; el siguiente paso es /sdd-intake';
      if (STRICT && specs.length) err('producto/bootstrap', `${mensaje}; no puede haber specs activas en un greenfield bootstrap`);
      else warn('producto/bootstrap', mensaje);
    }
    else {
      if (!product.approvedAt || !product.approvedBy || !Number.isInteger(product.enforceFromSpec))
        err('producto/aprobacion', 'un producto approved necesita fecha, persona y enforceFromSpec');
      const drift = [];
      for (const ruta of contratoIntake.slice(2)) {
        const contenido = leer(join(ROOT, ruta));
        const esperado = product.hashes?.[ruta];
        const actual = contenido === null ? null : createHash('sha256').update(contenido).digest('hex').slice(0, 16);
        if (!esperado || actual !== esperado) drift.push(ruta);
      }
      if (drift.length) {
        const mensaje = `baseline de producto aprobado con drift/hash distinto: ${drift.join(', ')}`;
        if (STRICT) err('producto/drift', mensaje);
        else warn('producto/drift', mensaje);
      }
    }
    const security = reg.security;
    if (!security) {
      warn('seguridad/estado', 'la instalación es anterior al contrato security; ejecuta `sdd update`');
    } else {
      if (security.schemaVersion !== 1 || !['bootstrap', 'legacy-pending'].includes(security.status))
        err('seguridad/estado', 'el contrato security de .sdd/installed.json no tiene versión o estado válidos');
      if (security.standards?.owaspTop10 !== '2025' || security.standards?.asvs !== '5.0.0' ||
          !['L1', 'L2', 'L3'].includes(security.standards?.level))
        err('seguridad/estado', 'security.standards debe declarar OWASP 2025, ASVS 5.0.0 y nivel L1 | L2 | L3');
      if (!/^\d{3}$/.test(String(security.enforceFromSpec || '')))
        err('seguridad/estado', 'security.enforceFromSpec debe ser un ID NNN');
      if (security.status === 'legacy-pending')
        warn('seguridad/legacy-pending', `el baseline histórico no se reinterpreta; el contrato se exige desde la spec ${security.enforceFromSpec}`);
    }
    const usability = reg.usability;
    if (!usability) {
      warn('usabilidad/estado', 'la instalación es anterior al contrato usability; ejecuta `sdd update`');
    } else {
      if (usability.schemaVersion !== 1 || !['bootstrap', 'legacy-pending'].includes(usability.status))
        err('usabilidad/estado', 'el contrato usability de .sdd/installed.json no tiene versión o estado válidos');
      if (usability.standards?.wcag !== '2.2' || usability.standards?.level !== 'AA' ||
          usability.standards?.heuristics !== 'nielsen-10')
        err('usabilidad/estado', 'usability.standards debe declarar WCAG 2.2, nivel AA y heurísticas nielsen-10');
      if (!/^\d{3}$/.test(String(usability.enforceFromSpec || '')))
        err('usabilidad/estado', 'usability.enforceFromSpec debe ser un ID NNN');
      if (usability.status === 'legacy-pending')
        warn('usabilidad/legacy-pending', `el baseline histórico no se reinterpreta; el contrato se exige desde la spec ${usability.enforceFromSpec}`);
    }
    const documentation = reg.documentation;
    if (!documentation) {
      warn('docs/estado', 'la instalación es anterior al contrato documental; ejecuta `sdd update`');
    } else {
      if (documentation.schemaVersion !== 1 ||
          !['bootstrap', 'legacy-pending', 'approved'].includes(documentation.status))
        err('docs/estado', 'installed.documentation debe usar schemaVersion 1 y estado bootstrap | legacy-pending | approved');
      if (!/^\d{3}$/.test(String(documentation.enforceFromSpec || '')))
        err('docs/estado', 'documentation.enforceFromSpec debe ser un ID NNN');
      if (documentation.status === 'approved') {
        if (!documentation.approvedAt || !documentation.approvedBy || !documentation.configHash)
          err('docs/aprobacion', 'documentation approved necesita fecha, persona y configHash');
        if (cfgDocs?.mode !== 'enforce')
          err('docs/aprobacion', 'documentation approved exige .sdd/docs.json en modo enforce');
        const actual = docsRaw === null ? null : createHash('sha256').update(docsRaw).digest('hex').slice(0, 16);
        if (documentation.configHash && actual !== documentation.configHash) {
          const mensaje = 'el contrato documental aprobado tiene drift respecto de .sdd/docs.json';
          (STRICT || DOCS_DIFF) ? err('docs/drift', mensaje) : warn('docs/drift', mensaje);
        }
      } else if (documentation.status === 'legacy-pending') {
        warn('docs/legacy-pending', `la documentación histórica se conserva; el contrato se exige desde la spec ${documentation.enforceFromSpec}`);
      } else if (documentation.status === 'bootstrap') {
        warn('docs/bootstrap', 'el baseline documental necesita `/docs-sync bootstrap` y aprobación humana');
      }
    }
    const modificados = Object.entries(reg.ficheros || {}).filter(([r, h]) => {
      const t = leer(join(ROOT, r));
      return t !== null && h !== createHash('sha256').update(t).digest('hex').slice(0, 16);
    });
    if (modificados.length)
      warn('instalacion/local', `${modificados.length} fichero(s) de la plantilla modificados en local: 'sdd update' no los tocará`);
  } catch (e) {
    err('instalacion/json', `.sdd/installed.json no es JSON válido: ${e.message}`);
  }
}

if (!existsSync(join(ROOT, 'AGENTS.md'))) err('repo/AGENTS', 'falta AGENTS.md, la fuente de verdad');
const envRastreado = spawnSync('git', ['ls-files', '--error-unmatch', '--', '.env'], {
  cwd: ROOT,
  stdio: 'ignore',
}).status === 0;
if (envRastreado) err('repo/secretos', '.env está versionado; retíralo del índice sin exponer su contenido');

const gitignore = leer(join(ROOT, '.gitignore')) || '';
if (!/^\.env\s*$/m.test(gitignore)) err('repo/secretos', '.gitignore no excluye .env');

for (const p of walk(join(ROOT, 'docs/specs'), (n) => n.endsWith('.md'))) {
  const t = leer(p) || '';
  if (/\bsk-ant-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}/.test(t))
    err('repo/secretos', `${rel(p)}: contiene algo con forma de credencial real`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 · Invariantes de una instalación virgen
// ─────────────────────────────────────────────────────────────────────────────
if (VIRGIN) {
  const changelog = leer(join(ROOT, 'CHANGELOG.md')) || '';
  if (!/## \[Unreleased\]/.test(changelog) || /^## \[(?!Unreleased\])/m.test(changelog))
    err('virgin/changelog', 'CHANGELOG.md debe contener solo [Unreleased], sin versiones');

  const decisiones = leer(join(ROOT, 'docs/bitacora/DECISIONS.md')) || '';
  if (!/decisiones:insertar-aqui/.test(decisiones) || /^## \d{4}-\d{2}-\d{2}/m.test(decisiones))
    err('virgin/bitacora', 'DECISIONS.md contiene decisiones heredadas o no tiene marcador');

  if ((leer(join(ROOT, '.sdd/agent-audit.jsonl')) || '').length)
    err('virgin/auditoria', '.sdd/agent-audit.jsonl no está vacío');

  const gruposVacios = [
    ['docs/bitacora/sessions', () => false],
    ['docs/quality/reports', () => false],
    ['docs/security/reports', () => false],
    ['docs/specs', (n) => n === '_TEMPLATE'],
    ['docs/architecture/adr', (n) => n === '_TEMPLATE.md'],
  ];
  for (const [ruta, permitida] of gruposVacios) {
    const extras = existsSync(join(ROOT, ruta))
      ? readdirSync(join(ROOT, ruta)).filter((n) => n !== '.gitkeep' && !permitida(n))
      : [];
    if (extras.length) err('virgin/historia', `${ruta} contiene historia: ${extras.join(', ')}`);
  }

  if (walk(join(ROOT, 'docs/specs'), (n) => n === 'execution-log.jsonl').length)
    err('virgin/execution-log', 'no debe existir execution-log.jsonl antes de la primera ejecución');

  try {
    const externas = JSON.parse(leer(join(ROOT, '.sdd/external-skills.json')) || '{}');
    const entries = externas.entries;
    const validas = Array.isArray(entries) && entries.every((entrada) =>
      entrada.status === 'approved-vendored' &&
      /^[0-9a-f]{40}$/.test(entrada.commit || '') &&
      entrada.license && entrada.path && existsSync(join(ROOT, entrada.path))
    );
    if (!validas)
      err('virgin/skills-externas', 'solo se permiten skills base vendorizadas, aprobadas, licenciadas y fijadas a commit');
  } catch (error) {
    err('virgin/skills-externas', `.sdd/external-skills.json inválido: ${error.message}`);
  }

  try {
    const mapa = JSON.parse(leer(join(ROOT, '.sdd/territories.json')) || '{}');
    if (mapa.modo !== 'audit' || /src\/|supabase|prisma|\.tsx|\.sql/i.test(JSON.stringify(mapa)))
      err('virgin/territorios', 'los territorios deben estar en audit y sin rutas de aplicación asumidas');
  } catch (error) {
    err('virgin/territorios', `.sdd/territories.json inválido: ${error.message}`);
  }

  for (const ruta of ['.mcp.json', '.vscode/mcp.json', '.agents/mcp_config.json'])
    if (existsSync(join(ROOT, ruta))) err('virgin/mcp', `${ruta} no debe activarse por defecto`);

  const ci = leer(join(ROOT, '.github/workflows/sdd-gates.yml')) || '';
  if (!ci || /npm ci|npm run|pytest|gradle|mvn /i.test(ci))
    err('virgin/ci', 'el CI universal ejecuta comandos de un stack no configurado');

  const contaminacion = /001-agentes-codex|Estructura_inicial_claude|2026-0[78]-/;
  for (const ruta of ['README.md', 'CHANGELOG.md', 'docs/README.md', 'docs/bitacora/DECISIONS.md']) {
    if (contaminacion.test(leer(join(ROOT, ruta)) || ''))
      err('virgin/contaminacion', `${ruta} contiene contexto de la plantilla`);
  }

  for (const ruta of ['README.md', 'docs/README.md']) {
    const absoluta = join(ROOT, ruta);
    const contenido = leer(absoluta) || '';
    for (const match of contenido.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const enlace = match[1].trim().replace(/^<|>$/g, '').split('#')[0].split('?')[0];
      if (!enlace || /^(?:https?:|mailto:|#|\/)/i.test(enlace)) continue;
      let decodificado = enlace;
      try { decodificado = decodeURIComponent(enlace); } catch { /* se comprobará tal cual */ }
      if (!existsSync(resolve(dirname(absoluta), decodificado)))
        err('virgin/enlace', `${ruta}: el enlace interno '${enlace}' no existe`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bit de ejecución de los git hooks.
//
// Se comprueba sobre el **índice de git**, no sobre el sistema de ficheros: en Windows
// `core.fileMode = false` hace que el bit local sea irrelevante y un hook en 644 parece correcto.
// El índice es lo único que viaja al clonar, y por tanto lo único agnóstico de sistema operativo.
//
// Un hook sin bit de ejecución no lo corre git en Linux ni en macOS —en algunas versiones, en
// silencio—, así que el gate está donde no se puede ignorar.
// ─────────────────────────────────────────────────────────────────────────────
{
  const indice = spawnSync('git', ['ls-files', '-s', '.sdd/githooks'], { cwd: ROOT, encoding: 'utf8' });
  if (indice.status === 0) {
    for (const linea of indice.stdout.split('\n').filter(Boolean)) {
      const [modo, , , ...resto] = linea.split(/\s+/);
      const ruta = resto.join(' ');
      if (ruta.endsWith('.md')) continue; // el README no se ejecuta
      if (modo !== '100755')
        err('githooks/permiso', `${ruta} está en el índice como ${modo}: git no lo ejecutará en Linux ni macOS. Corrige con \`git update-index --chmod=+x ${ruta}\``);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Artefactos de entrega, exigidos por el diff (solo --strict).
//
// "La documentación se actualiza en el mismo cambio" y "toda decisión relevante entra en la
// bitácora" ya son reglas vinculantes; hasta ahora dependían de que alguien se acordara. Aquí se
// traducen a máquina, que es lo único que funciona igual en todos los hosts — incluidos los que
// no tienen hooks ni agentes.
// ─────────────────────────────────────────────────────────────────────────────
if (STRICT && !VIRGIN) {
  const base = process.env.SDD_DIFF_BASE || 'origin/main';
  const diff = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: ROOT, encoding: 'utf8' });

  if (diff.status !== 0) {
    warn('entrega/diff', `no se pudo comparar contra '${base}': se omiten los gates de CHANGELOG y bitácora`);
  } else {
    const tocados = diff.stdout.split('\n').map((r) => r.trim()).filter(Boolean);

    // Documentación, plantillas de spec y ficheros de prueba no obligan a tocar el CHANGELOG:
    // exigirlo en cada corrección de una errata convierte el gate en ruido y se acaba esquivando.
    const esProducto = (r) =>
      !r.startsWith('docs/') && !r.endsWith('.md') &&
      !/(^|\/)(test|tests|__tests__)\//.test(r) && !/\.(test|spec)\./.test(r);
    const produccion = tocados.filter(esProducto);
    if (produccion.length && !tocados.includes('CHANGELOG.md'))
      err('entrega/changelog', `el cambio toca código (${produccion[0]}${produccion.length > 1 ? ` y ${produccion.length - 1} más` : ''}) y no actualiza CHANGELOG.md`);

    // El contrato de agentes y skills gobierna todas las sesiones futuras: cambiarlo sin dejar
    // constancia del porqué es exactamente lo que la bitácora existe para impedir.
    const contrato = tocados.filter((r) =>
      r.startsWith('.claude/agents/') || r.startsWith('.agents/skills/') ||
      r === 'AGENTS.md' || r === 'docs/architecture/constitution.md');
    if (contrato.length && !tocados.includes('docs/bitacora/DECISIONS.md'))
      err('entrega/bitacora', `el cambio toca el contrato (${contrato[0]}) y no añade entrada en docs/bitacora/DECISIONS.md`);
  }
}

function parsearNameStatusNul(salida) {
  const tokens = String(salida || '').split('\0').filter((token) => token.length);
  const cambios = new Map();
  for (let i = 0; i < tokens.length;) {
    let estado = tokens[i++];
    let ruta = null;
    const tab = estado.match(/^([A-Z][0-9]*)\t(.+)$/);
    if (tab) { estado = tab[1]; ruta = tab[2]; }
    else ruta = tokens[i++];
    if (!ruta) break;
    cambios.set(ruta.replace(/\\/g, '/'), estado);
    if (/^[RC]/.test(estado)) {
      const nueva = tokens[i++];
      if (nueva) cambios.set(nueva.replace(/\\/g, '/'), estado);
    }
  }
  return cambios;
}

if (DOCS_DIFF) {
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(String(BASE_DOCS || ''))) {
    err('docs/diff-base', 'NO EJECUTADO: --base debe ser un SHA hexadecimal completo');
  } else {
    const objeto = spawnSync('git', ['cat-file', '-e', `${BASE_DOCS}^{commit}`], {
      cwd: ROOT, encoding: 'utf8',
    });
    if (objeto.status !== 0) {
      err('docs/diff-base', `NO EJECUTADO: no se pudo resolver el SHA base ${BASE_DOCS}`);
    } else {
      const acumulado = spawnSync('git', [
        'diff', '--name-status', '-z', '--find-renames', `${BASE_DOCS}...HEAD`, '--',
      ], { cwd: ROOT, encoding: 'utf8' });
      const trabajo = spawnSync('git', [
        'diff', '--name-status', '-z', '--find-renames', 'HEAD', '--',
      ], { cwd: ROOT, encoding: 'utf8' });
      if (acumulado.status !== 0 || trabajo.status !== 0) {
        err('docs/diff-base', `NO EJECUTADO: Git no pudo comparar el árbol contra ${BASE_DOCS}`);
      } else {
        const cambios = parsearNameStatusNul(acumulado.stdout);
        for (const [ruta, estado] of parsearNameStatusNul(trabajo.stdout)) cambios.set(ruta, estado);
        for (const set of cfgDocs?.documentSets || []) {
          const fuentes = [...cambios.keys()].filter((ruta) =>
            (set.sources || []).some((patron) => matchesDocPattern(ruta, patron)));
          if (!fuentes.length) continue;
          const artefactos = [...cambios.keys()].filter((ruta) =>
            (set.artifacts || []).some((patron) => matchesDocPattern(ruta, patron)));
          if (!set.generated && !artefactos.length) {
            err('docs/diff', `${set.id}: cambió ${fuentes[0]} pero ningún artefacto documental del conjunto cambió en el PR`);
            continue;
          }
          const eliminados = set.generated ? [] : artefactos.filter((ruta) =>
            cambios.get(ruta)?.startsWith('D') || !existsSync(resolve(ROOT, ruta)));
          if (eliminados.length)
            err('docs/diff', `${set.id}: artefacto documental eliminado o renombrado sin actualizar el contrato: ${eliminados[0]}`);
        }
      }
    }
  }
}

// Informes de la spec que se entrega: existen los directorios y `/sdd-verify` los produce, pero
// nada comprobaba que se hubieran escrito. Un veredicto de auditoría que solo vive en el chat no
// es evidencia, y en hosts sin aislamiento el auditor puede además haber escrito el código.
//
// Solo se exigen cuando alguien ha declarado `GO` en evidence.md §5: `--strict --spec` también se
// usa a media implementación, y pedir artefactos de entrega ahí convierte el gate en ruido.
if (STRICT && soloSpec) {
  const carpeta = dirs(SPECS).find((d) => d.startsWith(`${soloSpec}-`) || d === soloSpec);
  const evidencia = carpeta ? leer(join(SPECS, carpeta, 'evidence.md')) || '' : '';
  const decididoGo = /^\|\s*\*{0,2}Estado\*{0,2}\s*\|\s*`?GO`?\s*\|\s*$/im.test(evidencia);
  if (carpeta && decididoGo) {
    let informesCalidad = [];
    try { informesCalidad = readdirSync(join(ROOT, 'docs/quality/reports')); } catch { /* ausente */ }
    if (!informesCalidad.some((f) => f.includes(carpeta)))
      err('entrega/informe', `la spec ${carpeta} está en GO y no tiene informe de calidad en docs/quality/reports/`);

    const contrato = seguridadPorSpec.get(carpeta) || { impacto: null, controles: [] };
    if (contrato.impacto === 'security-pending')
      err('seguridad/impacto', `${carpeta}: no puede declarar GO con Impacto de seguridad security-pending`);

    if (!contrato.impacto) {
      // Compatibilidad: las specs anteriores al contrato 007 conservan el gate por nombre,
      // pero no se reinterpretan ni se fuerzan a adoptar una matriz retroactivamente.
      let informesSeguridad = [];
      try { informesSeguridad = readdirSync(join(ROOT, 'docs/security/reports')); } catch { /* ausente */ }
      if (!informesSeguridad.some((f) => f.includes(carpeta)))
        err('entrega/informe', `la spec legacy ${carpeta} está en GO y no tiene informe de seguridad`);
    } else {
      if (!gateSeguridadConfigurado)
        err('seguridad/gate', `${carpeta}: GO exige un gate security configurado, required y slow en .sdd/checks.json`);

      const rutaDeclarada = evidencia.match(
        /\*\*Informe de seguridad\*\*\s*:\s*`([^`]+)`/i,
      )?.[1]?.replace(/\\/g, '/');
      let rutaInforme = null;
      if (!rutaDeclarada) {
        err('seguridad/informe', `${carpeta}: evidence.md debe declarar **Informe de seguridad** con ruta exacta`);
      } else if (
        rutaDeclarada.startsWith('/') || /^[A-Za-z]:\//.test(rutaDeclarada) ||
        rutaDeclarada.split('/').includes('..') || !rutaDeclarada.startsWith('docs/security/reports/') ||
        !rutaDeclarada.endsWith('.md')
      ) {
        err('seguridad/informe', `${carpeta}: ruta de informe no permitida: ${rutaDeclarada}`);
      } else {
        rutaInforme = resolve(ROOT, rutaDeclarada);
        const raizInformes = resolve(ROOT, 'docs/security/reports');
        if (dirname(rutaInforme) !== raizInformes)
          err('seguridad/informe', `${carpeta}: el informe debe estar directamente en docs/security/reports/`);
        else if (!existsSync(rutaInforme)) err('seguridad/informe', `${carpeta}: no existe ${rutaDeclarada}`);
      }

      if (rutaInforme && existsSync(rutaInforme)) {
        const parseado = bloqueInformeSeguridad(leer(rutaInforme));
        if (parseado.error) {
          err('seguridad/informe', `${carpeta}: ${parseado.error}`);
        } else {
          const informe = parseado.data;
          if (informe?.schemaVersion !== 1) err('seguridad/informe', `${carpeta}: schemaVersion debe ser 1`);
          if (informe?.spec !== carpeta) err('seguridad/informe', `${carpeta}: el informe declara spec '${informe?.spec}'`);
          if (informe?.standards?.owaspTop10 !== '2025' || informe?.standards?.asvs !== '5.0.0')
            err('seguridad/estandar', `${carpeta}: el informe debe usar OWASP Top 10:2025 y ASVS 5.0.0`);
          if (!['L1', 'L2', 'L3'].includes(informe?.standards?.level))
            err('seguridad/estandar', `${carpeta}: nivel ASVS debe ser L1 | L2 | L3`);
          if (!valorConcreto(informe?.scope)) err('seguridad/informe', `${carpeta}: alcance vacío o pendiente`);
          if (!Array.isArray(informe?.controlsEvaluated) ||
              new Set(informe?.controlsEvaluated || []).size !== (informe?.controlsEvaluated || []).length)
            err('seguridad/informe', `${carpeta}: controlsEvaluated debe ser un array sin duplicados`);
          if (!Array.isArray(informe?.controlsNotExecuted))
            err('seguridad/informe', `${carpeta}: controlsNotExecuted debe ser un array`);
          else if (informe.controlsNotExecuted.length) {
            for (const control of informe.controlsNotExecuted) {
              if (!['control', 'reason', 'risk', 'owner', 'nextStep'].every((campo) => valorConcreto(control?.[campo])))
                err('seguridad/informe', `${carpeta}: cada control no ejecutado necesita control, reason, risk, owner y nextStep`);
            }
            err('seguridad/veredicto', `${carpeta}: GO bloqueado por controles de seguridad no ejecutados`);
          }
          const aplicables = contrato.controles
            .filter((fila) => ['sí', 'si'].includes(fila.aplica)).map((fila) => fila.control);
          const noEvaluados = aplicables.filter((id) => !informe?.controlsEvaluated?.includes(id));
          if (noEvaluados.length) err('seguridad/informe', `${carpeta}: controles aplicables no evaluados: ${noEvaluados.join(', ')}`);
          for (const control of contrato.controles.filter((fila) => ['sí', 'si'].includes(fila.aplica))) {
            const { tareaId, testRef, bloqueTarea, filaTest, filaEvidence } = control.traza || {};
            const estadoTarea = bloqueTarea?.match(/Estado\**:\s*\**\s*([^\n]+)/i)?.[1]
              ?.replace(/[`*]/g, '').trim().toLowerCase();
            if (bloqueTarea && !estadoTarea?.startsWith('hecho'))
              err('seguridad/trazabilidad', `${carpeta}/${control.control}: la tarea ${tareaId} no está hecha`);
            if (testRef && !referenciaTestResuelta(testRef))
              err('seguridad/trazabilidad', `${carpeta}/${control.control}: no se resuelve el test ${testRef}`);
            if (filaEvidence && !tieneResultadoSeguridadVerde(filaEvidence))
              err('seguridad/trazabilidad', `${carpeta}/${control.control}: evidence.md no aporta un resultado verde ejecutado`);
          }

          const conteos = informe?.openFindings || {};
          const niveles = ['critical', 'high', 'medium', 'low'];
          for (const nivel of niveles) {
            if (!Number.isInteger(conteos[nivel]) || conteos[nivel] < 0)
              err('seguridad/informe', `${carpeta}: openFindings.${nivel} debe ser entero no negativo`);
          }
          if (!['PASS', 'CONDITIONAL', 'BLOCKED'].includes(informe?.verdict))
            err('seguridad/veredicto', `${carpeta}: veredicto inválido`);
          if ((conteos.critical || 0) > 0 || (conteos.high || 0) > 0)
            err('seguridad/veredicto', `${carpeta}: GO bloqueado por hallazgos CRÍTICO/ALTO abiertos`);
          if (informe?.verdict === 'BLOCKED') err('seguridad/veredicto', `${carpeta}: el informe declara BLOCKED`);
          if (informe?.verdict === 'PASS' && (conteos.medium || 0) > 0)
            err('seguridad/veredicto', `${carpeta}: PASS exige cero hallazgos MEDIO abiertos`);
          if (informe?.verdict === 'CONDITIONAL') {
            const riesgos = informe?.acceptedRisks;
            if (!(conteos.medium > 0) || !Array.isArray(riesgos) || riesgos.length !== conteos.medium)
              err('seguridad/riesgo', `${carpeta}: CONDITIONAL exige una aceptación por cada MEDIO abierto`);
            else {
              const ids = riesgos.map((riesgo) => riesgo?.id);
              if (new Set(ids).size !== ids.length)
                err('seguridad/riesgo', `${carpeta}: los IDs de riesgos aceptados deben ser únicos`);
              for (const riesgo of riesgos) {
              if (!valorConcreto(riesgo?.id) || !valorConcreto(riesgo?.owner) ||
                  !valorConcreto(riesgo?.justification) || !fechaIsoValida(riesgo?.reviewDate) ||
                  !referenciaDecisionExiste(riesgo?.decisionRef))
                err('seguridad/riesgo', `${carpeta}: riesgo aceptado sin id, owner, justification, reviewDate o decisionRef`);
              }
            }
          }
        }
      }
    }

    // ── Puerta de usabilidad, con la misma forma que la de seguridad ──
    const contratoUX = usabilidadPorSpec.get(carpeta) || { impacto: null, controles: [] };
    if (contratoUX.impacto?.estado === 'ux-pending')
      err('usabilidad/impacto', `${carpeta}: no puede declarar GO con Impacto de usabilidad ux-pending`);

    if (contratoUX.impacto?.estado === 'aplicable') {
      const controlesConInterfaz = contratoUX.controles.filter((control) =>
        ['sí', 'si'].includes(control.aplica) && /^UX-(?:A11Y|FORM)-/.test(control.control));
      // No se presupone herramienta. Se exige cuando la matriz declara una superficie A11Y/FORM;
      // microcopy de CLI y otros controles sin interfaz no inventan un runner.
      if (controlesConInterfaz.length && !gateA11yConfigurado)
        err('usabilidad/gate', `${carpeta}: falta un gate a11y real en .sdd/checks.json. ` +
          'Añade checks.a11y con command no vacío, required: true, speed: "slow" y enabled distinto de false; ' +
          'después ejecuta `node scripts/sdd-project.mjs run --slow`');

      const rutaDeclaradaUX = evidencia.match(
        /\*\*Informe de usabilidad\*\*\s*:\s*`([^`]+)`/i,
      )?.[1]?.replace(/\\/g, '/');
      let rutaInformeUX = null;
      if (!rutaDeclaradaUX) {
        err('usabilidad/informe', `${carpeta}: evidence.md debe declarar **Informe de usabilidad** con ruta exacta`);
      } else if (
        rutaDeclaradaUX.startsWith('/') || /^[A-Za-z]:\//.test(rutaDeclaradaUX) ||
        rutaDeclaradaUX.split('/').includes('..') || !rutaDeclaradaUX.startsWith('docs/design/reports/') ||
        !rutaDeclaradaUX.endsWith('.md')
      ) {
        err('usabilidad/informe', `${carpeta}: ruta de informe no permitida: ${rutaDeclaradaUX}`);
      } else {
        rutaInformeUX = resolve(ROOT, rutaDeclaradaUX);
        const raizInformesUX = resolve(ROOT, 'docs/design/reports');
        if (dirname(rutaInformeUX) !== raizInformesUX)
          err('usabilidad/informe', `${carpeta}: el informe debe estar directamente en docs/design/reports/`);
        else if (!existsSync(rutaInformeUX)) err('usabilidad/informe', `${carpeta}: no existe ${rutaDeclaradaUX}`);
      }

      if (rutaInformeUX && existsSync(rutaInformeUX)) {
        const parseado = bloqueInformeUsabilidad(leer(rutaInformeUX));
        if (parseado.error) {
          err('usabilidad/informe', `${carpeta}: ${parseado.error}`);
        } else {
          const informe = parseado.data;
          if (informe?.schemaVersion !== 1) err('usabilidad/informe', `${carpeta}: schemaVersion debe ser 1`);
          if (informe?.spec !== carpeta) err('usabilidad/informe', `${carpeta}: el informe declara spec '${informe?.spec}'`);
          if (informe?.standards?.wcag !== '2.2' || informe?.standards?.level !== 'AA' ||
              informe?.standards?.heuristics !== 'nielsen-10')
            err('usabilidad/estandar', `${carpeta}: el informe debe usar WCAG 2.2, nivel AA y heurísticas nielsen-10`);
          if (!valorConcreto(informe?.scope)) err('usabilidad/informe', `${carpeta}: alcance vacío o pendiente`);
          if (!Array.isArray(informe?.controlsEvaluated) ||
              new Set(informe?.controlsEvaluated || []).size !== (informe?.controlsEvaluated || []).length)
            err('usabilidad/informe', `${carpeta}: controlsEvaluated debe ser un array sin duplicados`);
          if (!Array.isArray(informe?.controlsNotExecuted))
            err('usabilidad/informe', `${carpeta}: controlsNotExecuted debe ser un array`);
          else if (informe.controlsNotExecuted.length) {
            for (const control of informe.controlsNotExecuted) {
              if (!['control', 'reason', 'risk', 'owner', 'nextStep'].every((campo) => valorConcreto(control?.[campo])))
                err('usabilidad/informe', `${carpeta}: cada control no ejecutado necesita control, reason, risk, owner y nextStep`);
            }
            err('usabilidad/veredicto', `${carpeta}: GO bloqueado por controles de usabilidad no ejecutados`);
          }
          const aplicablesUX = contratoUX.controles
            .filter((fila) => ['sí', 'si'].includes(fila.aplica)).map((fila) => fila.control);
          const noEvaluadosUX = aplicablesUX.filter((id) => !informe?.controlsEvaluated?.includes(id));
          if (noEvaluadosUX.length)
            err('usabilidad/informe', `${carpeta}: controles aplicables no evaluados: ${noEvaluadosUX.join(', ')}`);
          for (const control of contratoUX.controles.filter((fila) => ['sí', 'si'].includes(fila.aplica))) {
            const { tareaId, testRef, bloqueTarea, filaEvidence } = control.traza || {};
            const estadoTarea = bloqueTarea?.match(/Estado\**:\s*\**\s*([^\n]+)/i)?.[1]
              ?.replace(/[`*]/g, '').trim().toLowerCase();
            if (bloqueTarea && !estadoTarea?.startsWith('hecho'))
              err('usabilidad/trazabilidad', `${carpeta}/${control.control}: la tarea ${tareaId} no está hecha`);
            if (testRef && !referenciaTestResuelta(testRef))
              err('usabilidad/trazabilidad', `${carpeta}/${control.control}: no se resuelve el test ${testRef}`);
            if (filaEvidence && !tieneResultadoSeguridadVerde(filaEvidence))
              err('usabilidad/trazabilidad', `${carpeta}/${control.control}: evidence.md no aporta un resultado verde ejecutado`);
          }

          const conteosUX = informe?.openFindings || {};
          for (const nivel of ['critical', 'high', 'medium', 'low']) {
            if (!Number.isInteger(conteosUX[nivel]) || conteosUX[nivel] < 0)
              err('usabilidad/informe', `${carpeta}: openFindings.${nivel} debe ser entero no negativo`);
          }
          if (!['PASS', 'CONDITIONAL', 'BLOCKED'].includes(informe?.verdict))
            err('usabilidad/veredicto', `${carpeta}: veredicto inválido`);
          if ((conteosUX.critical || 0) > 0 || (conteosUX.high || 0) > 0)
            err('usabilidad/veredicto', `${carpeta}: GO bloqueado por hallazgos CRÍTICO/ALTO abiertos`);
          if (informe?.verdict === 'BLOCKED') err('usabilidad/veredicto', `${carpeta}: el informe declara BLOCKED`);
          if (informe?.verdict === 'PASS' && (conteosUX.medium || 0) > 0)
            err('usabilidad/veredicto', `${carpeta}: PASS exige cero hallazgos MEDIO abiertos`);
          if (informe?.verdict === 'CONDITIONAL') {
            const riesgos = informe?.acceptedRisks;
            if (!(conteosUX.medium > 0) || !Array.isArray(riesgos) || riesgos.length !== conteosUX.medium)
              err('usabilidad/riesgo', `${carpeta}: CONDITIONAL exige una aceptación por cada MEDIO abierto`);
            else {
              const ids = riesgos.map((riesgo) => riesgo?.id);
              if (new Set(ids).size !== ids.length)
                err('usabilidad/riesgo', `${carpeta}: los IDs de riesgos aceptados deben ser únicos`);
              for (const riesgo of riesgos) {
                if (!valorConcreto(riesgo?.id) || !valorConcreto(riesgo?.owner) ||
                    !valorConcreto(riesgo?.justification) || !fechaIsoValida(riesgo?.reviewDate) ||
                    !referenciaDecisionExiste(riesgo?.decisionRef))
                  err('usabilidad/riesgo', `${carpeta}: riesgo aceptado sin id, owner, justification, reviewDate o decisionRef`);
              }
            }
          }
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Informe
// ─────────────────────────────────────────────────────────────────────────────
const modo = VIRGIN ? 'virgen' : STRICT ? 'estricto' : 'normal';
const nSkills = dirs(SKILLS_DIR).length;
if (JSON_OUT) {
  const salida = {
    schemaVersion: 1,
    ok: problemas.length === 0,
    mode: modo,
    scope: {
      spec: soloSpec || null,
      virgin: VIRGIN,
      strict: STRICT,
      docsDiff: DOCS_DIFF,
      base: BASE_DOCS || null,
    },
    counts: {
      specs: specs.length,
      tasksDone: tareasHechas,
      agents: nombresAgentes.size,
      skills: nSkills,
      warnings: avisos.length,
      problems: problemas.length,
    },
    warnings: avisos,
    problems: problemas,
  };
  console.log(JSON.stringify(salida));
  if (problemas.length) process.exitCode = 1;
} else {
console.log(
  `check-sdd (${modo}) · ${specs.length} spec(s) · ${tareasHechas} tarea(s) hecha(s) · ` +
    `${nombresAgentes.size} agente(s) · ${nSkills} skill(s)\n`,
);

if (avisos.length) {
  console.log('Avisos:');
  for (const a of avisos) console.log(`  ~ [${a.regla}] ${a.msg}`);
  console.log('');
}

if (problemas.length) {
  console.log('Problemas:');
  for (const p of problemas) console.log(`  ✗ [${p.regla}] ${p.msg}`);
  console.log(`\n${problemas.length} problema(s). El circuito SDD no está en un estado entregable.`);
  process.exitCode = 1;
} else console.log(
    STRICT
      ? '✅ Estricto: estructura, trazabilidad y evidencia verificadas.'
      : '✅ Estructura y coherencia correctas. Usa --strict antes de entregar.',
  );
}
