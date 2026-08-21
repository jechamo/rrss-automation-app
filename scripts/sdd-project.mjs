#!/usr/bin/env node
/**
 * Operaciones deterministas del proyecto instalado.
 *
 *   node scripts/sdd-project.mjs --help
 *
 * La lista de subcomandos vive en la constante `USO` y en ningún otro sitio: mantenerla por
 * duplicado en este comentario es cómo se quedó desactualizada durante cinco versiones.
 *
 * Detectar no equivale a aprobar: `detect` nunca escribe. `configure` requiere la bandera
 * explícita y conserva cualquier comando ya definido por el proyecto.
 */
import {
  existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync,
  appendFileSync, lstatSync, realpathSync, openSync, closeSync, unlinkSync, fstatSync,
} from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { validateDocsConfig, matchesDocPattern } from './lib/docs-contract.mjs';
import { PATRONES_SECRETO } from '../.sdd/hooks/_lib.mjs';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const comando = argv.find((a) => !a.startsWith('-')) || 'status';
const indiceComando = argv.indexOf(comando);
const operando = argv.slice(indiceComando + 1).find((a) => !a.startsWith('-')) || null;
const JSON_OUT = argv.includes('--json');
const DRY = argv.includes('--dry-run');
const CHECKS_PATH = join(ROOT, '.sdd', 'checks.json');
const DOCS_PATH = join(ROOT, '.sdd', 'docs.json');
const GENERATORS_PATH = join(ROOT, '.sdd', 'generators.json');

/**
 * Vocabulario cerrado de gates. Un identificador libre convierte `checks.json` en un cajón de
 * sastre donde cada proyecto inventa el suyo y ninguna herramienta puede razonar sobre el
 * conjunto. `check-sdd.mjs` valida contra esta lista.
 */
const GATES = {
  sdd: 'fast', // el gate propio del circuito; siempre presente
  lint: 'fast',
  test: 'fast',
  typecheck: 'fast',
  build: 'fast',
  smells: 'fast',
  coverage: 'slow',
  e2e: 'slow',
  visual: 'slow',
  a11y: 'slow',
  security: 'slow',
  'deps-audit': 'slow',
  docs: 'slow',
  mutation: 'slow',
};
const GATE_IDS = Object.keys(GATES);
/** El sufijo `:lenguaje` permite `test:python` sin abrir el vocabulario. */
const gateBase = (id) => String(id).split(':')[0];
const velocidadDe = (check, id) => check?.speed || GATES[gateBase(id)] || 'slow';
const INSTALLED_PATH = join(ROOT, '.sdd', 'installed.json');
const PRODUCT_FILES = [
  'docs/product/PRD.md',
  'docs/product/USE-CASES.md',
  'docs/product/FEATURE-MAP.md',
  'docs/product/SOURCES.md',
];

const leer = (ruta) => (existsSync(ruta) ? readFileSync(ruta, 'utf8') : null);
const hash = (contenido) => createHash('sha256').update(contenido).digest('hex').slice(0, 16);

/**
 * Uso del CLI. Es la única lista de subcomandos del fichero: si un comando no aparece aquí,
 * para quien lo usa no existe.
 */
const USO = `Operaciones deterministas del proyecto instalado.

  node scripts/sdd-project.mjs <comando> [opciones]

Estado y diagnóstico
  status [--json] [--spec NNN]        panorama del circuito; es el comando por defecto
  detect [--json]                     detecta stacks y herramientas sin escribir nada
  inventory [--json]                  inventario de agentes, skills y artefactos
  trace-status --spec NNN [--json]    trazabilidad de una spec
  debt [--json]                       conteo de marcadores de deuda

Gates de producto y documentación
  product-status [--json]             estado del baseline de producto
  approve-product --approved-by <persona> [--json]
  docs-status [--json]                estado del contrato documental
  approve-docs --approved-by <persona> [--json]

Trabajo sobre specs
  new-spec <nombre> [--json]          crea la siguiente spec numerada
  new-adr <titulo> [--json]           crea el siguiente ADR numerado
  scaffold --spec NNN --phase design|plan|tasks|verify [--dry-run]
  trace-correct --from-spec NNN --to-spec NNN --session <id> --reason <texto> [--json]

Ejecución y configuración
  run [--ci] [--fast|--slow]          ejecuta los gates declarados en .sdd/checks.json
  verify [--json]                     verificación completa antes de entregar
  configure --accept-detected [--dry-run]
  generate <id> [--dry-run] [--json]  ejecuta un generador declarado
  skills-export [--json]              exporta las skills canónicas

  --help, -h, help                    muestra esta ayuda
  --json                              salida legible por máquina, también en los errores`;

function opcion(nombre) {
  const indice = argv.indexOf(nombre);
  return indice >= 0 ? argv[indice + 1] : null;
}

function validarArgumentos({ valores = [], banderas = [], operandoPermitido = false } = {}) {
  const conValor = new Set(valores);
  const sinValor = new Set(banderas);
  const vistos = new Set();
  let operandos = 0;
  for (let i = indiceComando + 1; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      if (!operandoPermitido || operandos) throw new Error(`Argumento inesperado para ${comando}: ${token}.`);
      operandos += 1;
      continue;
    }
    if (sinValor.has(token)) {
      if (vistos.has(token)) throw new Error(`Argumento duplicado: ${token}.`);
      vistos.add(token);
      continue;
    }
    if (!conValor.has(token)) throw new Error(`Argumento desconocido para ${comando}: ${token}.`);
    if (vistos.has(token)) throw new Error(`Argumento duplicado: ${token}.`);
    const valor = argv[i + 1];
    if (valor === undefined || valor.startsWith('--')) throw new Error(`${token} requiere un valor.`);
    vistos.add(token);
    i += 1;
  }
  return { vistos, operandos };
}

function validarArgumentosTraceCorrect() {
  const conValor = new Set(['--from-spec', '--to-spec', '--session', '--reason']);
  const sinValor = new Set(['--json']);
  const vistos = new Set();
  for (let i = indiceComando + 1; i < argv.length; i++) {
    const token = argv[i];
    if (sinValor.has(token)) {
      if (vistos.has(token)) throw new Error(`Argumento duplicado: ${token}.`);
      vistos.add(token);
      continue;
    }
    if (!conValor.has(token)) throw new Error(`Argumento desconocido para trace-correct: ${token}.`);
    if (vistos.has(token)) throw new Error(`Argumento duplicado: ${token}.`);
    const valor = argv[i + 1];
    if (valor === undefined || valor.startsWith('--')) throw new Error(`${token} requiere un valor.`);
    vistos.add(token);
    i += 1;
  }
  for (const obligatorio of conValor) if (!vistos.has(obligatorio))
    throw new Error(`trace-correct requiere ${obligatorio}.`);
}

function validarRutaSinEnlaces(ruta, base = ROOT) {
  const raiz = realpathSync(base);
  const relativa = ruta.slice(base.length).replace(/^[\\/]+/, '').split(/[\\/]+/).filter(Boolean);
  let actual = base;
  for (const segmento of relativa) {
    actual = join(actual, segmento);
    let stat;
    try { stat = lstatSync(actual); }
    catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink > 1))
      throw new Error(`Ruta no permitida: contiene symlink, junction o hardlink (${actual}).`);
    const real = realpathSync(actual);
    const prefijo = `${raiz}${process.platform === 'win32' ? '\\' : '/'}`;
    if (real !== raiz && !real.startsWith(prefijo))
      throw new Error(`Ruta no permitida: escapa del proyecto (${actual}).`);
  }
}

function resolverSpecPorId(valor, etiqueta) {
  const id = String(valor || '');
  if (!/^\d{3}$/.test(id))
    throw new Error(`${etiqueta} debe ser un ID de spec de tres dígitos, no una ruta.`);
  const specsDir = join(ROOT, 'docs', 'specs');
  validarRutaSinEnlaces(specsDir);
  const candidatas = nombres('docs/specs', (entrada) => entrada.isDirectory() && entrada.name.startsWith(`${id}-`));
  if (!candidatas.length) throw new Error(`No existe una spec que resuelva el ID ${id}.`);
  if (candidatas.length !== 1) throw new Error(`El ID ${id} es ambiguo: resuelve varias specs.`);
  const nombre = candidatas[0];
  if (!new RegExp(`^${id}-[a-z0-9]+(?:-[a-z0-9]+)*$`).test(nombre))
    throw new Error(`La spec ${nombre} no usa un nombre canónico seguro.`);
  const dir = join(specsDir, nombre);
  validarRutaSinEnlaces(dir);
  const log = join(dir, 'execution-log.jsonl');
  validarRutaSinEnlaces(log);
  return { id, nombre, dir, log };
}

function leerJsonlEstricto(ruta) {
  return (leer(ruta) || '').split(/\r?\n/).filter(Boolean).map((linea, indice) => {
    try { return JSON.parse(linea); }
    catch { throw new Error(`${ruta}: línea JSONL inválida ${indice + 1}; no se modifica el log.`); }
  });
}

function appendJsonlSeguro(ruta, evento) {
  validarRutaSinEnlaces(ruta);
  appendFileSync(ruta, `${JSON.stringify(evento)}\n`, 'utf8');
}

const TRACE_LOCK_WAIT = new Int32Array(new SharedArrayBuffer(4));

/**
 * Serializa el comando completo entre procesos. El lock es global porque dos correcciones
 * distintas también pueden compartir logs o bitácora. `wx` aporta exclusión atómica; quien
 * pierde la carrera espera, relee todo bajo el lock y converge mediante los IDs durables.
 */
function adquirirBloqueoTraceCorrect() {
  const stateDir = join(ROOT, '.sdd', 'state');
  validarRutaSinEnlaces(join(ROOT, '.sdd'));
  validarRutaSinEnlaces(stateDir);
  mkdirSync(stateDir, { recursive: true });
  validarRutaSinEnlaces(stateDir);
  const lockPath = join(stateDir, 'trace-correct.lock');
  const requestedTimeout = Number(process.env.SDD_TRACE_LOCK_TIMEOUT_MS || 15_000);
  const timeout = Number.isFinite(requestedTimeout) ? Math.min(15_000, Math.max(100, requestedTimeout)) : 15_000;
  const deadline = Date.now() + timeout;

  while (true) {
    try {
      const fd = openSync(lockPath, 'wx', 0o600);
      const token = randomBytes(16).toString('hex');
      try {
        writeFileSync(fd, `${JSON.stringify({ pid: process.pid, token, createdAt: new Date().toISOString() })}\n`, 'utf8');
        return { fd, lockPath, token, identity: fstatSync(fd) };
      } catch (error) {
        try { closeSync(fd); } catch { /* conservar el error original */ }
        try { unlinkSync(lockPath); } catch { /* no ocultar el error original */ }
        throw error;
      }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      validarRutaSinEnlaces(lockPath);
      if (Date.now() >= deadline)
        throw new Error(`trace-correct no pudo obtener el lock exclusivo en ${timeout} ms; no se escribió nada. Revisa manualmente ${lockPath} y no lo borres si otro proceso sigue activo.`);
      Atomics.wait(TRACE_LOCK_WAIT, 0, 0, 25);
    }
  }
}

function liberarBloqueoTraceCorrect(lock) {
  let pathname;
  try {
    const descriptor = fstatSync(lock.fd);
    pathname = lstatSync(lock.lockPath);
    const contenido = readFileSync(lock.lockPath, 'utf8');
    if (pathname.isSymbolicLink() || pathname.nlink > 1 ||
        descriptor.dev !== pathname.dev || descriptor.ino !== pathname.ino ||
        descriptor.dev !== lock.identity.dev || descriptor.ino !== lock.identity.ino ||
        !contenido.includes(lock.token))
      throw new Error('El lock de trace-correct fue reemplazado o ya no pertenece a este proceso; no se elimina.');
  } finally {
    closeSync(lock.fd);
  }
  const actual = lstatSync(lock.lockPath);
  if (actual.isSymbolicLink() || actual.nlink > 1 || actual.dev !== pathname.dev || actual.ino !== pathname.ino ||
      !readFileSync(lock.lockPath, 'utf8').includes(lock.token))
    throw new Error('El lock de trace-correct cambió durante la liberación; no se elimina.');
  unlinkSync(lock.lockPath);
}

function corregirTraza() {
  validarArgumentosTraceCorrect();
  const from = resolverSpecPorId(opcion('--from-spec'), '--from-spec');
  const to = resolverSpecPorId(opcion('--to-spec'), '--to-spec');
  if (from.nombre === to.nombre) throw new Error('La spec de origen y la de destino deben ser distintas.');

  const session = String(opcion('--session') || '');
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(session))
    throw new Error('session debe usar 3-64 caracteres ASCII alfanuméricos, guion o guion bajo.');
  const reason = String(opcion('--reason') || '').trim();
  if (!reason) throw new Error('reason/motivo es obligatorio y no puede estar vacío.');
  if (Buffer.byteLength(reason, 'utf8') > 500 || /[\u0000-\u001f\u007f]/.test(reason))
    throw new Error('reason/motivo debe ocupar como máximo 500 bytes y no contener controles, CR, LF o NUL.');
  if (PATRONES_SECRETO.some(({ re }) => re.test(reason)))
    throw new Error('reason/motivo parece contener una credencial; usa una descripción sin secretos.');

  const lock = adquirirBloqueoTraceCorrect();
  try {

  const sourceEvents = leerJsonlEstricto(from.log);
  const destinationEvents = leerJsonlEstricto(to.log);
  // Los hooks históricos usan `sesion`; el contrato nuevo expone `session`. La búsqueda acepta
  // ambas claves con igualdad exacta para poder rectificar el historial sin reescribirlo.
  const matched = sourceEvents.filter((event) =>
    (event?.sesion === session || event?.session === session) &&
    !['trace-correction', 'trace-attribution'].includes(event?.evento));
  if (!matched.length) throw new Error('La sesión indicada no tiene eventos exactos en la spec de origen.');
  const months = [...new Set(matched.map((event) => {
    if (typeof event.ts !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(event.ts) || Number.isNaN(Date.parse(event.ts)))
      throw new Error('Un evento fuente no tiene timestamp ISO válido; no puede derivarse la bitácora mensual.');
    return event.ts.slice(0, 7);
  }))].sort();
  const correctionId = `TRACE-${createHash('sha256')
    .update(JSON.stringify({ from: from.nombre, to: to.nombre, session, reason, events: matched }))
    .digest('hex').slice(0, 16)}`;
  const baseEvent = {
    correctionId, fromSpec: from.nombre, toSpec: to.nombre, session, reason,
    eventsMatched: matched.length,
  };
  const hasCorrection = sourceEvents.some((event) =>
    event?.evento === 'trace-correction' && event?.correctionId === correctionId);
  const hasAttribution = destinationEvents.some((event) =>
    event?.evento === 'trace-attribution' && event?.correctionId === correctionId);

  const sessionsDir = join(ROOT, 'docs', 'bitacora', 'sessions');
  validarRutaSinEnlaces(join(ROOT, 'docs', 'bitacora'));
  validarRutaSinEnlaces(sessionsDir);
  mkdirSync(sessionsDir, { recursive: true });
  validarRutaSinEnlaces(sessionsDir);
  const diaryPaths = months.map((month) => join(sessionsDir, `${month}.md`));
  for (const path of diaryPaths) validarRutaSinEnlaces(path);
  const reasonMarkdown = reason.replace(/\\/g, '\\\\').replace(/`/g, '\\`')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|');
  const diaryLine = (month) => `- Rectificación \`${correctionId}\` · sesión \`${session}\` · ${from.nombre} → ${to.nombre} · ${reasonMarkdown} · eventos ${matched.length} · mes ${month}`;
  const diaryMissing = diaryPaths.filter((path, index) =>
    !(leer(path) || '').split(/\r?\n/).includes(diaryLine(months[index])));

  const writes = [];
  const now = new Date().toISOString();
  if (!hasCorrection) {
    appendJsonlSeguro(from.log, { ts: now, evento: 'trace-correction', ...baseEvent });
    writes.push(`docs/specs/${from.nombre}/execution-log.jsonl`);
  }
  if (!hasAttribution) {
    appendJsonlSeguro(to.log, { ts: now, evento: 'trace-attribution', ...baseEvent });
    writes.push(`docs/specs/${to.nombre}/execution-log.jsonl`);
  }
  for (const path of diaryMissing) {
    validarRutaSinEnlaces(path);
    const month = path.slice(-10, -3);
    if (!existsSync(path)) appendFileSync(path, `# Sesiones de agente — ${month}\n\n`, 'utf8');
    appendFileSync(path, `${diaryLine(month)}\n`, 'utf8');
    writes.push(`docs/bitacora/sessions/${month}.md`);
  }

  imprimir({
    status: writes.length ? 'corrected' : 'already-corrected', fromSpec: from.nombre,
    toSpec: to.nombre, session, eventsMatched: matched.length, writes,
  });
  } finally {
    liberarBloqueoTraceCorrect(lock);
  }
}

function packageManager() {
  if (existsSync(join(ROOT, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(ROOT, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function detectar() {
  const stacks = [];
  const suggestions = {};
  const evidence = {};

  const pkgText = leer(join(ROOT, 'package.json'));
  if (pkgText !== null) {
    stacks.push('node');
    evidence.node = ['package.json'];
    try {
      const pkg = JSON.parse(pkgText);
      const gestor = packageManager();
      const scripts = pkg.scripts || {};
      const sugerirScript = (id, nombreScript) => {
        if (!scripts[nombreScript]) return;
        suggestions[id] = {
          command: `${gestor} run ${nombreScript}`,
          required: true,
          speed: GATES[gateBase(id)],
          detectedFrom: `package.json#scripts.${nombreScript}`,
        };
      };
      for (const id of ['lint', 'test', 'typecheck', 'build']) sugerirScript(id, id);
      // Solo se sugiere un gate cuando existe un comando real que ejecutar. Un gate sin comando
      // no es un control: es una casilla que alguien dará por buena.
      for (const [id, candidatos] of Object.entries({
        coverage: ['test:coverage', 'coverage'],
        e2e: ['test:e2e', 'e2e'],
        visual: ['test:visual', 'visual'],
        a11y: ['test:a11y', 'a11y', 'axe', 'pa11y', 'lighthouse', 'test:accessibility'],
        security: ['security', 'security:scan', 'test:security'],
        docs: ['docs:check', 'docs:lint'],
        mutation: ['test:mutation', 'mutation'],
      })) {
        const encontrado = candidatos.find((nombre) => scripts[nombre]);
        if (encontrado) sugerirScript(id, encontrado);
      }
      for (const nombre of ['docs:openapi', 'docs:storybook', 'docs:typedoc', 'docs:links']) {
        if (scripts[nombre]) sugerirScript(nombre, nombre);
      }
      // Solo con lockfile real: auditar sin árbol de dependencias fijado da un resultado que
      // cambia entre ejecuciones, y `detectedFrom` tiene que poder señalar el fichero.
      const lockfile = ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'].find((f) => existsSync(join(ROOT, f)));
      const comandoAudit = gestor === 'npm' ? 'npm audit --audit-level=high' :
        gestor === 'pnpm' ? 'pnpm audit --audit-level high' : null;
      if (lockfile && comandoAudit) {
        suggestions['deps-audit'] = {
          command: comandoAudit,
          required: true,
          speed: GATES['deps-audit'],
          detectedFrom: lockfile,
        };
      }
    } catch (error) {
      evidence.node.push(`package.json inválido: ${error.message}`);
    }
  }

  // Complejidad y duplicación: solo si la configuración de lint declara ya una regla. Activar el
  // gate sin regla configurada produce un check que siempre pasa, que es peor que no tenerlo.
  const configsLint = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', '.eslintrc.json', '.eslintrc.cjs', '.eslintrc.js', '.eslintrc.yml']
    .filter((f) => existsSync(join(ROOT, f)));
  const textoLint = configsLint.map((f) => leer(join(ROOT, f)) || '').join('\n');
  if (configsLint.length && /sonarjs|cognitive-complexity|["']complexity["']/i.test(textoLint) && suggestions.lint) {
    suggestions.smells = { ...suggestions.lint, speed: GATES.smells, detectedFrom: `${configsLint[0]} declara umbral de complejidad` };
  }

  const pythonFiles = ['pyproject.toml', 'setup.cfg', 'requirements.txt'].filter((f) => existsSync(join(ROOT, f)));
  if (pythonFiles.length) {
    stacks.push('python');
    evidence.python = pythonFiles;
    const config = pythonFiles.map((f) => leer(join(ROOT, f)) || '').join('\n');
    if (/\bpytest\b/i.test(config)) suggestions['test:python'] = { command: 'python -m pytest', required: true, speed: 'fast', detectedFrom: pythonFiles.join(', ') };
    if (/\bruff\b/i.test(config)) suggestions['lint:python'] = { command: 'python -m ruff check .', required: true, speed: 'fast', detectedFrom: pythonFiles.join(', ') };
    if (/\bmypy\b/i.test(config)) suggestions['typecheck:python'] = { command: 'python -m mypy .', required: true, speed: 'fast', detectedFrom: pythonFiles.join(', ') };
    if (/\bpip-audit\b/i.test(config)) suggestions['deps-audit:python'] = { command: 'python -m pip_audit', required: true, speed: 'slow', detectedFrom: pythonFiles.join(', ') };
  }

  if (existsSync(join(ROOT, 'Cargo.toml'))) {
    stacks.push('rust');
    evidence.rust = ['Cargo.toml'];
    suggestions['test:rust'] = { command: 'cargo test', required: true, speed: 'fast', detectedFrom: 'Cargo.toml' };
  }
  if (existsSync(join(ROOT, 'go.mod'))) {
    stacks.push('go');
    evidence.go = ['go.mod'];
    suggestions['test:go'] = { command: 'go test ./...', required: true, speed: 'fast', detectedFrom: 'go.mod' };
    const goMod = leer(join(ROOT, 'go.mod')) || '';
    if (/\btool\s+golang\.org\/x\/vuln\/cmd\/govulncheck\b/.test(goMod))
      suggestions['deps-audit:go'] = { command: 'go tool govulncheck ./...', required: true, speed: 'slow', detectedFrom: 'go.mod#tool' };
  }
  if (existsSync(join(ROOT, 'pom.xml'))) {
    stacks.push('java-maven');
    evidence['java-maven'] = ['pom.xml'];
    suggestions['test:java'] = { command: 'mvn test', required: true, speed: 'fast', detectedFrom: 'pom.xml' };
  }
  if (existsSync(join(ROOT, 'gradlew')) || existsSync(join(ROOT, 'gradlew.bat'))) {
    stacks.push('java-gradle');
    evidence['java-gradle'] = [existsSync(join(ROOT, 'gradlew')) ? 'gradlew' : 'gradlew.bat'];
    suggestions['test:java'] = { command: process.platform === 'win32' ? 'gradlew.bat test' : './gradlew test', required: true, speed: 'fast', detectedFrom: evidence['java-gradle'][0] };
  }

  return { stacks, suggestions, evidence, writes: false };
}

function cargarChecks() {
  const contenido = leer(CHECKS_PATH);
  if (contenido === null) return { version: 1, checks: {}, unconfigured: ['lint', 'test', 'typecheck', 'build', 'security', 'mutation'] };
  try { return JSON.parse(contenido); }
  catch (error) { throw new Error(`.sdd/checks.json no es JSON válido: ${error.message}`); }
}

function imprimir(valor) {
  if (JSON_OUT) console.log(JSON.stringify(valor));
  else console.log(JSON.stringify(valor, null, 2));
}

function nombres(dir, filtro = () => true) {
  try {
    return readdirSync(join(ROOT, dir), { withFileTypes: true }).filter(filtro).map((x) => x.name).sort();
  } catch { return []; }
}

function inventario() {
  const config = cargarChecks();
  return {
    agents: nombres('.claude/agents', (x) => x.isFile() && x.name.endsWith('.md')).length,
    skills: nombres('.agents/skills', (x) => x.isDirectory() && !x.name.startsWith('_')).length,
    specs: nombres('docs/specs', (x) => x.isDirectory() && !x.name.startsWith('_')),
    adrs: nombres('docs/architecture/adr', (x) => x.isFile() && /^ADR-\d{4}-/.test(x.name)),
    checks: Object.keys(config.checks || {}).sort(),
    unconfigured: config.unconfigured || [],
    stacks: detectar().stacks,
  };
}

function cargarInstalacion() {
  const contenido = leer(INSTALLED_PATH);
  if (contenido === null) throw new Error('No existe .sdd/installed.json; ejecuta primero `sdd init`.');
  try { return JSON.parse(contenido); }
  catch (error) { throw new Error(`.sdd/installed.json no es JSON válido: ${error.message}`); }
}

/**
 * El registro cuando existe; el estado neutro de plantilla cuando todavía no.
 *
 * Preguntar por el estado no puede exigir que el estado exista: consultar es la primera cosa
 * que hace cualquiera, humano o agente, antes de instalar nada. Un registro corrupto sí sigue
 * siendo un error, porque es un problema real y no debe confundirse con "aún no instalado".
 */
function cargarInstalacionOPlantilla() {
  if (leer(INSTALLED_PATH) === null) return { mode: 'template' };
  return cargarInstalacion();
}

function estadoProducto() {
  const registro = cargarInstalacionOPlantilla();
  return registro.product || {
    schemaVersion: 1,
    status: registro.mode === 'greenfield' ? 'bootstrap' : 'legacy-pending',
    approvedAt: null,
    approvedBy: null,
    enforceFromSpec: null,
    hashes: {},
  };
}

function estadoSeguridad() {
  const registro = cargarInstalacionOPlantilla();
  return registro.security || {
    schemaVersion: 1,
    status: 'legacy-pending',
    standards: { owaspTop10: '2025', asvs: '5.0.0', level: 'L2' },
    enforceFromSpec: null,
  };
}

function estadoUsabilidad() {
  const registro = cargarInstalacionOPlantilla();
  return registro.usability || {
    schemaVersion: 1,
    status: 'legacy-pending',
    standards: { wcag: '2.2', level: 'AA', heuristics: 'nielsen-10' },
    enforceFromSpec: null,
  };
}

function estadoDocumentacion() {
  const registro = cargarInstalacionOPlantilla();
  return registro.documentation || {
    schemaVersion: 1,
    status: registro.mode === 'greenfield' ? 'bootstrap' : 'legacy-pending',
    approvedAt: null,
    approvedBy: null,
    enforceFromSpec: null,
    configHash: null,
  };
}

function aprobarDocumentacion() {
  const indice = argv.indexOf('--approved-by');
  const approvedBy = indice >= 0 ? argv[indice + 1]?.trim() : null;
  if (!approvedBy || approvedBy.startsWith('--'))
    throw new Error('approve-docs requiere `--approved-by <persona>` como confirmación explícita.');
  if (approvedBy.length > 100 || /[\r\n|<>]/.test(approvedBy))
    throw new Error('approved-by debe ser una identidad breve, sin saltos, etiquetas ni separadores de tabla.');
  const raw = leer(DOCS_PATH);
  if (raw === null) throw new Error('Falta .sdd/docs.json; ejecuta primero `/docs-sync bootstrap`.');
  let config;
  try { config = JSON.parse(raw); }
  catch (error) { throw new Error(`.sdd/docs.json no es JSON válido: ${error.message}`); }
  config = { ...config, mode: 'enforce' };
  const validacion = validateDocsConfig(config, {
    root: ROOT, checks: cargarChecks(), requireNonEmpty: true,
  });
  const errores = Array.isArray(validacion) ? validacion : validacion?.errors || [];
  if (errores.length) throw new Error(`Contrato documental no aprobable: ${errores.join('; ')}`);
  const contenido = `${JSON.stringify(config, null, 2)}\n`;
  const registro = cargarInstalacionOPlantilla();
  const previo = estadoDocumentacion();
  const ahora = new Date().toISOString();
  const documentation = {
    ...previo,
    schemaVersion: 1,
    status: 'approved',
    approvedAt: ahora,
    approvedBy,
    enforceFromSpec: previo.enforceFromSpec,
    configHash: hash(contenido),
  };
  if (!DRY) {
    writeFileSync(DOCS_PATH, contenido, 'utf8');
    registro.documentation = documentation;
    writeFileSync(INSTALLED_PATH, `${JSON.stringify(registro, null, 2)}\n`, 'utf8');
  }
  imprimir({ ...documentation, dryRun: DRY });
}

function ids(texto, patron) {
  return new Set([...(texto || '').matchAll(patron)].map((m) => m[0]));
}

function idsRepetidos(texto, patron) {
  const vistos = new Set();
  const repetidos = new Set();
  for (const coincidencia of (texto || '').matchAll(patron)) {
    const id = coincidencia[1];
    if (vistos.has(id)) repetidos.add(id);
    vistos.add(id);
  }
  return [...repetidos];
}

function bloquesCasosDeUso(texto) {
  const bloques = String(texto || '').split(/(?=^##+\s+UC-\d{3}\b)/gm);
  const resultado = new Map();
  for (const bloque of bloques) {
    const id = bloque.match(/^##+\s+(UC-\d{3})\b/m)?.[1];
    if (id) resultado.set(id, new Set([...bloque.matchAll(/\bPRD-RF-\d{3}\b/g)].map((m) => m[0])));
  }
  return resultado;
}

function filasFeatureMap(texto) {
  return String(texto || '').split('\n').flatMap((linea) => {
    const id = linea.match(/^\|\s*(FEAT-\d{3})\s*\|/)?.[1];
    if (!id) return [];
    return [{
      id,
      objetivos: ids(linea, /\bOBJ-\d{3}\b/g),
      requisitos: ids(linea, /\bPRD-RF-\d{3}\b/g),
      casos: ids(linea, /\bUC-\d{3}\b/g),
    }];
  });
}

function hostUrlNoPublico(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      host.endsWith('.internal') || host === '0.0.0.0' || host === '::' || host === '::1') return true;
  const ipv4Mapeada = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  const ipv4 = ipv4Mapeada || (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ? host : null);
  if (ipv4) {
    const octetos = ipv4.split('.').map(Number);
    if (octetos.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    const [a, b] = octetos;
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (host.includes(':')) return /^(?:::ffff:|f[cd]|fe[89ab]|ff|2001:db8:)/i.test(host);
  return false;
}

function validarProducto() {
  const contenidos = Object.fromEntries(PRODUCT_FILES.map((ruta) => [ruta, leer(join(ROOT, ruta))]));
  const ausentes = PRODUCT_FILES.filter((ruta) => contenidos[ruta] === null);
  if (ausentes.length) throw new Error(`Faltan artefactos de producto: ${ausentes.join(', ')}`);

  const filasGate = [
    /^\|\s*Estado\s*\|\s*`?(?:pending|bootstrap|legacy-pending)`?\s*\|\s*$/im,
    /^\|\s*Aprobado por\s*\|[^\n]*\|\s*$/im,
    /^\|\s*Fecha de aprobaci[oó]n\s*\|[^\n]*\|\s*$/im,
    /^\|\s*Alcance aprobado\s*\|[^\n]*\|\s*$/im,
  ];
  if (filasGate.some((patron) => !patron.test(contenidos['docs/product/PRD.md'])))
    throw new Error('PRD.md debe declarar estado, aprobador, fecha y alcance del gate de producto.');
  const alcanceGate = contenidos['docs/product/PRD.md']
    .match(/^\|\s*Alcance aprobado\s*\|\s*([^|\n]*)\|\s*$/im)?.[1]?.replace(/`/g, '').trim();
  if (!alcanceGate) throw new Error('PRD.md debe concretar el alcance aprobado antes del gate.');
  const combinado = Object.values(contenidos).join('\n');
  const validable = combinado
    .replace(/^\|\s*Aprobado por\s*\|[^\n]*$/im, '')
    .replace(/^\|\s*Fecha de aprobaci[oó]n\s*\|[^\n]*$/im, '');
  if (/<[^>\n]+>|\[NEEDS CLARIFICATION/i.test(validable))
    throw new Error('El baseline contiene placeholders o aclaraciones pendientes.');

  const prd = contenidos['docs/product/PRD.md'];
  const casos = contenidos['docs/product/USE-CASES.md'];
  const mapa = contenidos['docs/product/FEATURE-MAP.md'];
  const fuentes = contenidos['docs/product/SOURCES.md'];
  const objetivos = ids(prd, /\bOBJ-\d{3}\b/g);
  const requisitos = ids(prd, /\bPRD-RF-\d{3}\b/g);
  const usos = ids(casos, /\bUC-\d{3}\b/g);
  const fuentesDeclaradas = ids(fuentes, /\bSRC-\d{3}\b/g);
  if (!objetivos.size || !requisitos.size || !usos.size || !fuentesDeclaradas.size)
    throw new Error('El baseline necesita al menos un OBJ, PRD-RF, UC y SRC identificados.');

  const repetidos = [
    ...idsRepetidos(prd, /^\|\s*(OBJ-\d{3})\s*\|/gm),
    ...idsRepetidos(prd, /^\|\s*(PRD-RF-\d{3})\s*\|/gm),
    ...idsRepetidos(casos, /^##+\s+(UC-\d{3})\b/gm),
    ...idsRepetidos(mapa, /^\|\s*(FEAT-\d{3})\s*\|/gm),
    ...idsRepetidos(fuentes, /^\|\s*((?:SRC|DISC)-\d{3})\s*\|/gm),
  ];
  if (repetidos.length)
    throw new Error(`IDs duplicados en producto: ${[...new Set(repetidos)].join(', ')}`);

  const huerfanos = [];
  for (const id of ids(`${casos}\n${mapa}`, /\bPRD-RF-\d{3}\b/g)) if (!requisitos.has(id)) huerfanos.push(id);
  for (const id of ids(mapa, /\bUC-\d{3}\b/g)) if (!usos.has(id)) huerfanos.push(id);
  for (const id of ids(mapa, /\bOBJ-\d{3}\b/g)) if (!objetivos.has(id)) huerfanos.push(id);
  for (const id of ids(prd, /\bSRC-\d{3}\b/g)) if (!fuentesDeclaradas.has(id)) huerfanos.push(id);
  if (huerfanos.length) throw new Error(`IDs huérfanos en producto: ${[...new Set(huerfanos)].join(', ')}`);

  const objetivosPorRequisito = new Map();
  for (const linea of prd.split('\n')) {
    const enlace = linea.match(/^\|\s*(PRD-RF-\d{3})\s*\|\s*(OBJ-\d{3})\s*\|/);
    if (enlace) objetivosPorRequisito.set(enlace[1], enlace[2]);
  }
  const casosPorId = bloquesCasosDeUso(casos);
  const features = filasFeatureMap(mapa);
  if (!features.length)
    throw new Error('FEATURE-MAP.md necesita al menos una fila FEAT-* estructurada en su tabla.');
  for (const feature of features) {
    if (!feature.objetivos.size || !feature.requisitos.size || !feature.casos.size)
      throw new Error(`${feature.id} debe enlazar al menos un OBJ, PRD-RF y UC en la misma fila.`);
  }

  for (const requisito of requisitos) {
    if (!casos.includes(requisito) || !mapa.includes(requisito))
      throw new Error(`${requisito} no está cubierto por caso de uso y feature map.`);
    const objetivo = objetivosPorRequisito.get(requisito);
    if (!objetivo)
      throw new Error(`${requisito} no declara su OBJ en la tabla de requisitos del PRD.`);
    const casosEnlazados = [...casosPorId.entries()]
      .filter(([, requisitosCaso]) => requisitosCaso.has(requisito)).map(([caso]) => caso);
    if (!casosEnlazados.length)
      throw new Error(`${requisito} no está enlazado desde ningún bloque UC-*.`);
    const cadenaCompleta = features.some((feature) =>
      feature.requisitos.has(requisito) && feature.objetivos.has(objetivo) &&
      casosEnlazados.some((caso) => feature.casos.has(caso)));
    if (!cadenaCompleta)
      throw new Error(`Cadena inconexa para ${requisito}: su OBJ y uno de sus UC deben coincidir en una fila FEAT-*.`);
  }
  for (const objetivo of objetivos)
    if (!mapa.includes(objetivo)) throw new Error(`${objetivo} no esta cubierto por el feature map.`);
  for (const uso of usos)
    if (!mapa.includes(uso)) throw new Error(`${uso} no esta cubierto por el feature map.`);
  if (/^\|\s*DISC-\d{3}[^\n]*\babierta\b[^\n]*$/im.test(fuentes))
    throw new Error('Hay discrepancias de producto abiertas.');
  if (/^\|\s*SRC-\d{3}[^\n]*\binaccesible\b[^\n]*$/im.test(fuentes))
    throw new Error('Hay fuentes inaccesibles pendientes de decisión humana.');
  for (const raw of fuentes.match(/https?:\/\/[^\s|)>]+/gi) || []) {
    let url;
    try { url = new URL(raw); } catch { continue; }
    if (!['http:', 'https:'].includes(url.protocol) || hostUrlNoPublico(url.hostname))
      throw new Error('SOURCES.md contiene una URL que no apunta a un destino HTTP(S) público.');
    if (url.username || url.password || url.search || url.hash)
      throw new Error('SOURCES.md debe guardar una URL saneada, sin credenciales, query ni fragmento.');
  }
  return contenidos;
}

function aprobarProducto() {
  const indice = argv.indexOf('--approved-by');
  const approvedBy = indice >= 0 ? argv[indice + 1]?.trim() : null;
  if (!approvedBy || approvedBy.startsWith('--'))
    throw new Error('approve-product requiere `--approved-by <persona>` como confirmación explícita.');
  if (approvedBy.length > 100 || /[\r\n|<>]/.test(approvedBy))
    throw new Error('approved-by debe ser una identidad breve, sin saltos, etiquetas ni separadores de tabla.');
  const contenidos = validarProducto();
  const ahora = new Date().toISOString();
  const rutaPrd = join(ROOT, 'docs/product/PRD.md');
  const prdAprobado = contenidos['docs/product/PRD.md']
    .replace(/(\|\s*Estado\s*\|\s*)`?(?:pending|bootstrap|legacy-pending)`?(\s*\|)/i, '$1`approved`$2')
    .replace(/(\|\s*Aprobado por\s*\|\s*)[^|\n]*(\s*\|)/i, `$1${approvedBy}$2`)
    .replace(/(\|\s*Fecha de aprobación\s*\|\s*)[^|\n]*(\s*\|)/i, `$1${ahora}$2`);
  if (!DRY && prdAprobado !== contenidos['docs/product/PRD.md']) writeFileSync(rutaPrd, prdAprobado, 'utf8');
  contenidos['docs/product/PRD.md'] = prdAprobado;

  // Se llega aquí solo con el baseline ya validado: una degradación jamás concede aprobación.
  const registro = cargarInstalacionOPlantilla();
  const numeros = nombres('docs/specs', (x) => x.isDirectory())
    .map((nombre) => Number((nombre.match(/^(\d{3})-/) || [])[1])).filter(Number.isFinite);
  const product = {
    schemaVersion: 1,
    status: 'approved',
    approvedAt: ahora,
    approvedBy,
    enforceFromSpec: (numeros.length ? Math.max(...numeros) : 0) + 1,
    hashes: Object.fromEntries(Object.entries(contenidos).map(([ruta, contenido]) => [ruta, hash(contenido)])),
  };
  if (!DRY) {
    registro.product = product;
    mkdirSync(dirname(INSTALLED_PATH), { recursive: true });
    writeFileSync(INSTALLED_PATH, `${JSON.stringify(registro, null, 2)}\n`, 'utf8');
  }
  imprimir(product);
}

function slugSeguro(valor) {
  const slug = String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) throw new Error('Falta un slug válido. Ejemplo: new-spec checkout-invitado');
  return slug;
}

function siguienteNumero(nombresExistentes, patron) {
  const numeros = nombresExistentes.map((x) => Number((x.match(patron) || [])[1])).filter(Number.isFinite);
  return String((numeros.length ? Math.max(...numeros) : 0) + 1).padStart(3, '0');
}

function nuevaSpec() {
  const product = estadoProducto();
  if (product.status === 'bootstrap')
    throw new Error('Producto en bootstrap: ejecuta /sdd-intake y aprueba el baseline antes de crear specs.');
  const slug = slugSeguro(operando);
  const base = nombres('docs/specs', (x) => x.isDirectory());
  const numero = siguienteNumero(base, /^(\d{3})-/);
  const nombre = `${numero}-${slug}`;
  const origen = join(ROOT, 'docs/specs/_TEMPLATE');
  const destino = join(ROOT, 'docs/specs', nombre);
  if (!existsSync(origen)) throw new Error('No existe docs/specs/_TEMPLATE');
  if (existsSync(destino)) throw new Error(`La spec ya existe: docs/specs/${nombre}`);
  if (!DRY) {
    mkdirSync(destino, { recursive: false });
    for (const fichero of ['spec.md', 'clarifications.md']) {
      const fuente = join(origen, fichero);
      if (existsSync(fuente)) cpSync(fuente, join(destino, fichero), { errorOnExist: true });
    }
  }
  imprimir({
    created: !DRY,
    dryRun: DRY,
    spec: nombre,
    path: `docs/specs/${nombre}`,
    productStatus: product.status,
    ...(product.status === 'legacy-pending' ? { warning: 'Producto legacy-pending: normaliza con /sdd-intake sin reespecificar historia.' } : {}),
  });
}

function nuevoAdr() {
  const slug = slugSeguro(operando);
  const base = nombres('docs/architecture/adr', (x) => x.isFile());
  const numero = siguienteNumero(base, /^ADR-(\d{4})-/).padStart(4, '0');
  const ruta = `docs/architecture/adr/ADR-${numero}-${slug}.md`;
  const destino = join(ROOT, ruta);
  if (existsSync(destino)) throw new Error(`El ADR ya existe: ${ruta}`);
  const plantilla = leer(join(ROOT, 'docs/architecture/adr/_TEMPLATE.md'));
  if (plantilla === null) throw new Error('No existe docs/architecture/adr/_TEMPLATE.md');
  const titulo = slug.split('-').map((x) => x[0].toUpperCase() + x.slice(1)).join(' ');
  const contenido = plantilla
    .replace(/^# ADR-NNNN — <Título de la decisión>/m, `# ADR-${numero} — ${titulo}`)
    .replace(/^- Fecha: AAAA-MM-DD$/m, `- Fecha: ${new Date().toISOString().slice(0, 10)}`);
  if (!DRY) {
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, contenido, 'utf8');
  }
  imprimir({ created: !DRY, dryRun: DRY, adr: `ADR-${numero}`, path: ruta });
}

function idSpecRequerido() {
  const valor = String(opcion('--spec') || '');
  if (!/^\d{3}$/.test(valor)) throw new Error('--spec requiere un ID de tres dígitos, no una ruta.');
  return valor;
}

function tituloDesdeSpec(nombre) {
  return nombre.replace(/^\d{3}-/, '').split('-')
    .map((parte) => parte ? parte[0].toUpperCase() + parte.slice(1) : '')
    .join(' ');
}

function instanciarPlantilla(contenido, spec) {
  const fecha = new Date().toISOString().slice(0, 10);
  return contenido
    .replaceAll('NNN-slug', spec.nombre)
    .replaceAll('T-NNN', `T-${spec.id}`)
    .replaceAll('UX-<AREA>-NNN', `UX-<AREA>-${spec.id}`)
    .replace(/\bNNN\b/g, spec.id)
    .replaceAll('<Título de la funcionalidad>', tituloDesdeSpec(spec.nombre))
    .replaceAll('<YYYY-MM-DD>', fecha)
    .replaceAll('YYYY-MM-DD', fecha);
}

const FASES_SCAFFOLD = {
  design: [['design.md', 'design.md']],
  plan: [
    ['plan.md', 'plan.md'],
    ['data-model.md', 'data-model.md'],
    ['research.md', 'research.md'],
    ['contracts/.gitkeep', 'contracts/.gitkeep'],
  ],
  tasks: [['tasks.md', 'tasks.md'], ['test-plan.md', 'test-plan.md']],
  verify: [['evidence.md', 'evidence.md']],
};

function estadoGate(texto, titulo) {
  const contenido = String(texto || '');
  const inicio = contenido.search(titulo);
  if (inicio < 0) return null;
  return contenido.slice(inicio).match(/^\|\s*\*{0,2}Estado\*{0,2}\s*\|\s*`?([^|`\n]+)`?\s*\|/im)?.[1]
    ?.replace(/\*+/g, '').trim().toLowerCase() || null;
}

function impactoSinUiJustificado(specTexto) {
  const valor = String(specTexto || '').match(
    /^\|\s*\*{0,2}Impacto de usabilidad\*{0,2}\s*\|\s*([^|\n]+?)\s*\|/im,
  )?.[1]?.replace(/[`*]/g, '').trim() || '';
  const motivo = valor.match(/^sin-ui\s*(?:\u00b7|\u2014|-)\s*(.+)$/i)?.[1]?.trim() || '';
  return motivo.length >= 8 && !/^(?:motivo|pendiente|tbd|todo|por definir|no aplica)$/i.test(motivo);
}

function validarGateScaffold(spec, phase) {
  const specTexto = leer(join(spec.dir, 'spec.md')) || '';
  if (!/^(?:aprobada|approved|en implementaci[oó]n|implementada)/i.test(estadoSpec(specTexto)))
    throw new Error(`Gate de scaffold: la spec ${spec.id} debe estar aprobada antes de crear ${phase}.`);
  if (phase === 'design') return;

  if (phase === 'plan') {
    const design = leer(join(spec.dir, 'design.md'));
    const sinUi = impactoSinUiJustificado(specTexto);
    if (!design && sinUi) return;
    const estado = estadoGate(design, /##\s+\d+\.\s+Gate humano de dise[ñn]o/i);
    if (!/^(?:approved|aprobado|skipped-no-ui)/i.test(estado || ''))
      throw new Error('Gate de scaffold: plan requiere diseño aprobado o skipped-no-ui justificado.');
    return;
  }

  if (phase === 'tasks') {
    const plan = leer(join(spec.dir, 'plan.md'));
    const estado = estadoGate(plan, /##\s+\d+\.\s+Gate humano del plan t[eé]cnico/i);
    if (!/^(?:approved|aprobado)/i.test(estado || ''))
      throw new Error('Gate de scaffold: tasks requiere el plan técnico aprobado.');
    return;
  }

  if (phase === 'verify') {
    const tareas = estadoTareas(leer(join(spec.dir, 'tasks.md')) || '');
    if (!tareas.total || tareas.done !== tareas.total)
      throw new Error('Gate de scaffold: verify requiere todas las tareas explícitamente terminadas.');
  }
}

function scaffold() {
  validarArgumentos({ valores: ['--spec', '--phase'], banderas: ['--dry-run', '--json'] });
  const spec = resolverSpecPorId(idSpecRequerido(), '--spec');
  const phase = String(opcion('--phase') || '');
  const ficheros = FASES_SCAFFOLD[phase];
  if (!ficheros) throw new Error('--phase debe ser design, plan, tasks o verify.');
  validarGateScaffold(spec, phase);
  const operaciones = ficheros.map(([origenRel, destinoRel]) => {
    const origen = join(ROOT, 'docs/specs/_TEMPLATE', origenRel);
    const destino = join(spec.dir, destinoRel);
    if (!existsSync(origen)) throw new Error(`Falta la plantilla canónica: docs/specs/_TEMPLATE/${origenRel}`);
    validarRutaSinEnlaces(origen);
    validarRutaSinEnlaces(destino);
    if (existsSync(destino)) throw new Error(`Scaffold conservador: ya existe docs/specs/${spec.nombre}/${destinoRel}; no se sobrescribe.`);
    const contenido = readFileSync(origen, 'utf8');
    return { destino, destinoRel, contenido: instanciarPlantilla(contenido, spec) };
  });
  if (!DRY) for (const operacion of operaciones) {
    mkdirSync(dirname(operacion.destino), { recursive: true });
    validarRutaSinEnlaces(dirname(operacion.destino));
    writeFileSync(operacion.destino, operacion.contenido, 'utf8');
  }
  imprimir({
    schemaVersion: 1,
    spec: spec.nombre,
    phase,
    dryRun: DRY,
    created: !DRY,
    files: operaciones.map((x) => `docs/specs/${spec.nombre}/${x.destinoRel}`),
    decisions: 'pending-human-input',
  });
}

function estadoTareas(texto) {
  const bloques = String(texto || '').split(/(?=^###\s+T-\d{3}-\d+\b)/gm)
    .filter((bloque) => /^###\s+T-\d{3}-\d+\b/m.test(bloque));
  const items = bloques.map((bloque) => {
    const cabecera = bloque.match(/^###\s+(T-\d{3}-\d+)\s*[·—-]?\s*([^\n]*)/m);
    const estado = bloque.match(/^-\s+(?:\*\*)?Estado(?:\*\*)?\s*:\s*([^\n]+)/im)?.[1]
      ?.replace(/[`*]/g, '').split(/\s*(?:\u00b7|\u2014|\|)\s*/, 1)[0].trim().toLowerCase() || 'sin-estado';
    return { id: cabecera?.[1] || null, title: cabecera?.[2]?.trim() || '', status: estado };
  });
  const cuenta = (patron) => items.filter((item) => patron.test(item.status)).length;
  return {
    total: items.length,
    done: cuenta(/^(?:hecho|completad[oa]|done)$/i),
    pending: cuenta(/^pendiente$/i),
    inProgress: cuenta(/^en curso$/i),
    blocked: cuenta(/^bloquead[oa]$/i),
    unknown: items.filter((item) => !/^(?:hecho|completad[oa]|done|pendiente|en curso|bloquead[oa])$/i.test(item.status)).length,
    items,
  };
}

function estadoSpec(texto) {
  return String(texto || '').match(/^\|\s*\*{0,2}Estado\*{0,2}\s*\|\s*`?([^|`\n]+)`?\s*\|/im)?.[1]
    ?.replace(/\*+/g, '').trim().toLowerCase() || 'desconocido';
}

function faseSpec(spec, tareas, artefactos) {
  if (/entregad[ao]|released|cerrad[ao]/i.test(spec.state)) return 'delivered';
  if (tareas.pending || tareas.inProgress || tareas.blocked) return 'implement';
  if (artefactos.evidence) return 'verify';
  if (artefactos.tasks) return 'verify';
  if (artefactos.plan) return 'tasks';
  if (artefactos.design) return 'plan';
  if (artefactos.spec) return 'design';
  return 'specify';
}

function snapshotSpecs(filtro = null) {
  const nombresSpecs = nombres('docs/specs', (entrada) =>
    entrada.isDirectory() && /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entrada.name));
  const todos = nombresSpecs.map((nombre) => {
    const id = nombre.slice(0, 3);
    const dir = join(ROOT, 'docs/specs', nombre);
    validarRutaSinEnlaces(dir);
    const artefactos = Object.fromEntries([
      'spec', 'clarifications', 'design', 'plan', 'data-model', 'tasks', 'test-plan', 'evidence', 'research',
    ].map((idArtefacto) => [idArtefacto.replace('-', ''), existsSync(join(dir, `${idArtefacto}.md`))]));
    artefactos.contracts = existsSync(join(dir, 'contracts'));
    const specTexto = leer(join(dir, 'spec.md')) || '';
    const tareas = estadoTareas(leer(join(dir, 'tasks.md')) || '');
    const item = { id, name: nombre, state: estadoSpec(specTexto), phase: null, tasks: tareas, artifacts: artefactos };
    item.phase = faseSpec(item, tareas, artefactos);
    item.active = tareas.pending > 0 || tareas.inProgress > 0 || tareas.blocked > 0;
    return item;
  });
  const items = filtro ? todos.filter((item) => item.id === filtro) : todos;
  if (filtro && !items.length) throw new Error(`No existe una spec que resuelva el ID ${filtro}.`);
  const abiertasGlobales = todos.filter((item) => item.active);
  return {
    total: items.length,
    activeCount: abiertasGlobales.length,
    active: abiertasGlobales.map((item) => item.name),
    ambiguous: abiertasGlobales.length > 1,
    items,
  };
}

function gitSnapshot() {
  const resultado = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  if (resultado.status !== 0) return { available: false, dirty: null, changedFiles: [] };
  const lineas = (resultado.stdout || '').split(/\r?\n/).filter(Boolean);
  return { available: true, dirty: lineas.length > 0, changedFiles: lineas.map((linea) => linea.slice(3)) };
}

function snapshotEstado() {
  validarArgumentos({ valores: ['--spec'], banderas: ['--json'] });
  const filtro = opcion('--spec') ? idSpecRequerido() : null;
  let registro;
  try { registro = cargarInstalacion(); } catch { registro = { mode: 'template' }; }
  const product = registro.product || {
    schemaVersion: 1, status: registro.mode === 'greenfield' ? 'bootstrap' : 'legacy-pending',
  };
  const specs = snapshotSpecs(filtro);
  const constitucion = leer(join(ROOT, 'docs/architecture/constitution.md'));
  const architecture = {
    exists: constitucion !== null,
    status: constitucion?.match(/^\|\s*Estado\s*\|\s*([^|\n]+)/im)?.[1]?.trim() || (constitucion ? 'declared' : 'missing'),
  };
  let next;
  if (product.status === 'bootstrap' || product.status === 'pending' || product.status === 'pending-approval')
    next = { skill: '/sdd-intake', reason: 'product-baseline-not-approved' };
  else if (product.status === 'approved' && (!architecture.exists || /bootstrap/i.test(architecture.status)))
    next = { skill: '/sdd-init', reason: 'greenfield-architecture-pending' };
  else if (specs.activeCount > 1)
    next = { skill: '/sdd-status', reason: 'multiple-active-specs-require-human-priority' };
  else if (specs.activeCount === 1) {
    const activa = specs.items.find((item) => item.active) || snapshotSpecs().items.find((item) => item.active);
    const porFase = { design: '/sdd-design', plan: '/sdd-plan', tasks: '/sdd-tasks', implement: '/sdd-implement', verify: '/sdd-verify' };
    next = { skill: porFase[activa?.phase] || '/sdd-status', reason: `spec-${activa?.id || 'active'}-${activa?.phase || 'unknown'}` };
  } else if (registro.documentation?.status === 'bootstrap')
    next = { skill: '/docs-sync bootstrap', reason: 'documentation-baseline-pending' };
  else next = { skill: '/sdd-specify', reason: 'no-active-spec' };
  return {
    schemaVersion: 1,
    product,
    architecture,
    specs,
    checks: cargarChecks(),
    security: registro.security || null,
    usability: registro.usability || null,
    documentation: registro.documentation || null,
    git: gitSnapshot(),
    next,
  };
}

const FAMILIAS_TRAZA = {
  OBJ: /\bOBJ-\d{3}\b/g,
  'PRD-RF': /\bPRD-RF-\d{3}\b/g,
  UC: /\bUC-\d{3}\b/g,
  RF: /\bRF-\d+\b/g,
  CA: /\bCA-\d+\b/g,
  SEC: /\bSEC-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g,
  UX: /\bUX-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g,
  DOC: /\bDOC-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g,
};

function extraerIdsFamilia(texto, familia) {
  const encontrados = [...String(texto || '').matchAll(FAMILIAS_TRAZA[familia])]
    .filter((match) => familia !== 'RF' || String(texto).slice(Math.max(0, match.index - 4), match.index) !== 'PRD-')
    .map((match) => match[0])
    .filter((id) => !['SEC-ID', 'UX-ID', 'DOC-ID'].includes(id));
  return [...new Set(encontrados)].sort();
}

function contieneId(texto, id) {
  return new RegExp(`(?:^|[^A-Z0-9-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^A-Z0-9-])`, 'm')
    .test(String(texto || ''));
}

function traceStatus() {
  validarArgumentos({ valores: ['--spec'], banderas: ['--json'] });
  const spec = resolverSpecPorId(idSpecRequerido(), '--spec');
  const specTexto = leer(join(spec.dir, 'spec.md')) || '';
  const planTexto = leer(join(spec.dir, 'plan.md')) || '';
  const ejecucion = ['tasks.md', 'test-plan.md', 'evidence.md']
    .map((ruta) => leer(join(spec.dir, ruta)) || '').join('\n');
  const families = {};
  for (const familia of Object.keys(FAMILIAS_TRAZA)) {
    const fuente = ['SEC', 'UX', 'DOC'].includes(familia) ? `${specTexto}\n${planTexto}` : specTexto;
    const declared = extraerIdsFamilia(fuente, familia);
    const referenced = extraerIdsFamilia(ejecucion, familia);
    const covered = declared.filter((id) => contieneId(ejecucion, id));
    families[familia] = {
      declared,
      referenced,
      covered,
      orphans: declared.filter((id) => !covered.includes(id)),
      unresolved: referenced.filter((id) => !declared.includes(id)),
    };
  }
  const missing = Object.values(families).reduce((total, family) => total + family.orphans.length + family.unresolved.length, 0);
  imprimir({ schemaVersion: 1, spec: spec.nombre, complete: missing === 0, missing, families });
}

function normalizarPatronProyecto(valor, etiqueta) {
  if (typeof valor !== 'string' || !valor.trim() || /[\u0000-\u001f\u007f]/.test(valor))
    throw new Error(`${etiqueta} debe ser una ruta relativa no vacía y sin controles.`);
  const ruta = valor.replace(/\\/g, '/').replace(/^\.\//, '');
  if (isAbsolute(ruta) || /^[A-Za-z]:\//.test(ruta) || ruta.startsWith('//'))
    throw new Error(`${etiqueta} no admite rutas absolutas ni UNC.`);
  if (/[\[\]{}]/.test(ruta)) throw new Error(`${etiqueta} usa un glob no soportado; solo *, ** y ?.`);
  const segmentos = ruta.split('/');
  if (segmentos.some((parte) => !parte || parte === '.' || parte === '..'))
    throw new Error(`${etiqueta} contiene traversal o segmentos vacíos.`);
  if (['.git', '.sdd', 'node_modules'].includes(segmentos[0]) || /^\.env(?:\.|$)/i.test(segmentos.at(-1)))
    throw new Error(`${etiqueta} apunta a estado interno, dependencias o secretos.`);
  const primerGlob = ruta.search(/[?*]/);
  const prefijo = (primerGlob < 0 ? ruta : ruta.slice(0, primerGlob)).replace(/\/$/, '');
  if (prefijo) resolverRutaProyecto(prefijo, etiqueta);
  return ruta;
}

function resolverRutaProyecto(ruta, etiqueta) {
  const absoluta = resolve(ROOT, ruta);
  const rel = relative(ROOT, absoluta);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
    throw new Error(`${etiqueta} escapa de la raíz del proyecto.`);
  validarRutaSinEnlaces(absoluta);
  return absoluta;
}

function recorrerFicheros(dir = ROOT, salida = []) {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(entrada.name) || (dir === ROOT && entrada.name === '.sdd')) continue;
    const absoluta = join(dir, entrada.name);
    if (entrada.isSymbolicLink()) continue;
    if (entrada.isDirectory()) recorrerFicheros(absoluta, salida);
    else if (entrada.isFile()) salida.push(relative(ROOT, absoluta).replace(/\\/g, '/'));
  }
  return salida;
}

function resolverPatrones(patrones, { exigirCadaUno = true } = {}) {
  let todos = null;
  const salida = new Set();
  for (const patronOriginal of patrones) {
    const patron = normalizarPatronProyecto(patronOriginal, 'ruta de generador');
    let coincidencias;
    if (/[?*]/.test(patron)) {
      todos ||= recorrerFicheros();
      coincidencias = todos.filter((ruta) => matchesDocPattern(ruta, patron));
    } else coincidencias = existsSync(resolverRutaProyecto(patron, 'ruta de generador')) ? [patron] : [];
    for (const ruta of coincidencias) {
      const absoluta = resolverRutaProyecto(ruta, 'ruta de generador');
      const stat = lstatSync(absoluta);
      if (!stat.isFile() || stat.nlink > 1) throw new Error(`Ruta de generador no es un fichero regular seguro: ${ruta}.`);
      salida.add(ruta);
    }
    if (exigirCadaUno && !coincidencias.length) throw new Error(`La entrada/salida declarada no existe: ${patron}.`);
  }
  return [...salida].sort();
}

function hashRutas(rutas) {
  const huella = createHash('sha256');
  for (const ruta of rutas) huella.update(ruta).update('\0').update(readFileSync(resolverRutaProyecto(ruta, 'hash de generador'))).update('\0');
  return huella.digest('hex');
}

function validarGenerador(entrada, idsVistos) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new Error('Cada generador debe ser un objeto.');
  const claves = Object.keys(entrada);
  const permitidas = ['id', 'program', 'args', 'inputs', 'outputs', 'owner', 'timeoutMs'];
  const desconocidas = claves.filter((clave) => !permitidas.includes(clave));
  if (desconocidas.length) throw new Error(`Generador con claves desconocidas: ${desconocidas.join(', ')}.`);
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(String(entrada.id || ''))) throw new Error('ID de generador no canónico.');
  if (idsVistos.has(entrada.id)) throw new Error(`ID de generador duplicado: ${entrada.id}.`);
  idsVistos.add(entrada.id);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(entrada.program || '')))
    throw new Error(`${entrada.id}: programa debe ser un ejecutable por nombre, sin ruta ni shell.`);
  if (/^(?:sh|bash|zsh|fish|cmd|powershell|pwsh|wscript|cscript|npx)$/i.test(entrada.program))
    throw new Error(`${entrada.id}: programa de shell o instalación implícita no permitido.`);
  if (!Array.isArray(entrada.args) || entrada.args.some((arg) => typeof arg !== 'string' || !arg ||
      Buffer.byteLength(arg, 'utf8') > 500 || /[\u0000-\u001f\u007f;&|`<>]|\$\(/.test(arg)))
    throw new Error(`${entrada.id}: argumento hostil o no canónico.`);
  if (/^(?:npm|pnpm|yarn|bun)$/i.test(entrada.program) && !/^run$/.test(String(entrada.args[0] || '')))
    throw new Error(`${entrada.id}: gestores de paquetes solo pueden ejecutar scripts existentes con run; no instalar dependencias.`);
  if (!Array.isArray(entrada.inputs) || !entrada.inputs.length || !Array.isArray(entrada.outputs) || !entrada.outputs.length)
    throw new Error(`${entrada.id}: inputs y outputs deben ser arrays no vacíos.`);
  for (const input of entrada.inputs) normalizarPatronProyecto(input, `${entrada.id}.inputs`);
  for (const output of entrada.outputs) normalizarPatronProyecto(output, `${entrada.id}.outputs`);
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(String(entrada.owner || '')) ||
      !existsSync(join(ROOT, '.claude/agents', `${entrada.owner}.md`)))
    throw new Error(`${entrada.id}: owner debe ser un agente instalado.`);
  if (entrada.timeoutMs !== undefined &&
      (!Number.isInteger(entrada.timeoutMs) || entrada.timeoutMs < 1_000 || entrada.timeoutMs > 300_000))
    throw new Error(`${entrada.id}: timeoutMs debe ser un entero entre 1000 y 300000.`);
  return entrada;
}

function cargarGeneradores() {
  const contenido = leer(GENERATORS_PATH);
  if (contenido === null) throw new Error('Falta .sdd/generators.json; actualiza la instalación SDD.');
  let config;
  try { config = JSON.parse(contenido); }
  catch (error) { throw new Error(`.sdd/generators.json no es JSON válido: ${error.message}`); }
  if (config?.schemaVersion !== 1 || !Array.isArray(config.generators))
    throw new Error('.sdd/generators.json requiere schemaVersion 1 y generators array.');
  const vistos = new Set();
  return { ...config, generators: config.generators.map((entrada) => validarGenerador(entrada, vistos)) };
}

function generar() {
  validarArgumentos({ banderas: ['--dry-run', '--json'], operandoPermitido: true });
  if (!operando) throw new Error('generate requiere el ID de un generador aprobado.');
  const config = cargarGeneradores();
  const generador = config.generators.find((entrada) => entrada.id === operando);
  if (!generador) throw new Error(`Generador no registrado: ${operando}.`);
  const trustBoundary = 'approved-program-not-os-sandboxed';
  const inputs = resolverPatrones(generador.inputs);
  const outputsAntes = resolverPatrones(generador.outputs, { exigirCadaUno: false });
  const inputsHash = hashRutas(inputs);
  const outputsHashAntes = outputsAntes.length ? hashRutas(outputsAntes) : null;
  const stateDir = resolverRutaProyecto('.sdd/state/generators', 'estado de generador');
  const statePath = join(stateDir, `${generador.id}.json`);
  validarRutaSinEnlaces(statePath);
  let previo = null;
  if (existsSync(statePath)) {
    try { previo = JSON.parse(readFileSync(statePath, 'utf8')); }
    catch (error) { throw new Error(`Estado de ${generador.id} inválido; no se ejecuta: ${error.message}`); }
    if (previo.outputsHash !== outputsHashAntes)
      throw new Error(`${generador.id}: output drift detectado; revisa cambios manuales antes de regenerar.`);
    if (previo.inputsHash === inputsHash) {
      imprimir({ schemaVersion: 1, id: generador.id, status: 'up-to-date', dryRun: DRY, trustBoundary, inputs, outputs: outputsAntes });
      return;
    }
  }
  if (DRY) {
    imprimir({ schemaVersion: 1, id: generador.id, status: 'planned', dryRun: true, trustBoundary, program: generador.program, args: generador.args, inputs, outputs: generador.outputs });
    return;
  }
  const inicio = Date.now();
  const timeoutMs = generador.timeoutMs ?? 120_000;
  const resultado = spawnSync(generador.program, generador.args, {
    cwd: ROOT,
    shell: false,
    encoding: 'utf8',
    timeout: timeoutMs,
    killSignal: 'SIGTERM',
  });
  if (resultado.error?.code === 'ETIMEDOUT')
    throw new Error(`${generador.id}: timeout tras ${timeoutMs} ms; no se materializa estado ni éxito.`);
  if (resultado.error) throw new Error(`${generador.id}: no se pudo iniciar ${generador.program}: ${resultado.error.message}`);
  if (resultado.status !== 0) throw new Error(`${generador.id}: el generador falló con exit code ${resultado.status}.`);
  const outputs = resolverPatrones(generador.outputs);
  const outputsHash = hashRutas(outputs);
  mkdirSync(stateDir, { recursive: true });
  validarRutaSinEnlaces(stateDir);
  writeFileSync(statePath, `${JSON.stringify({ schemaVersion: 1, id: generador.id, inputsHash, outputsHash, outputs }, null, 2)}\n`, 'utf8');
  imprimir({ schemaVersion: 1, id: generador.id, status: 'generated', dryRun: false, trustBoundary, durationMs: Date.now() - inicio, inputs, outputs });
}

function verificar() {
  const argumentos = [join(ROOT, 'scripts/check-sdd.mjs')];
  if (argv.includes('--strict')) argumentos.push('--strict');
  const specIndex = argv.indexOf('--spec');
  if (specIndex >= 0 && argv[specIndex + 1]) argumentos.push('--spec', argv[specIndex + 1]);
  if (argv.includes('--docs-diff')) argumentos.push('--docs-diff');
  const baseIndex = argv.indexOf('--base');
  if (baseIndex >= 0 && argv[baseIndex + 1]) argumentos.push('--base', argv[baseIndex + 1]);
  const resultado = spawnSync(process.execPath, argumentos, { cwd: ROOT, stdio: 'inherit' });
  process.exitCode = resultado.status ?? 1;
}

function configurar() {
  if (!argv.includes('--accept-detected'))
    throw new Error('configure no toma decisiones implícitas: usa --accept-detected después de revisar `detect`.');
  const deteccion = detectar();
  const actual = cargarChecks();
  const anadidos = [];
  for (const [id, check] of Object.entries(deteccion.suggestions)) {
    if (actual.checks?.[id]) continue;
    actual.checks ||= {};
    actual.checks[id] = check;
    anadidos.push(id);
  }
  const configuradas = new Set(Object.keys(actual.checks || {}).map((x) => x.split(':')[0]));
  actual.unconfigured = (actual.unconfigured || []).filter((id) => !configuradas.has(id));
  if (!DRY) {
    mkdirSync(dirname(CHECKS_PATH), { recursive: true });
    writeFileSync(CHECKS_PATH, `${JSON.stringify(actual, null, 2)}\n`, 'utf8');
  }
  imprimir({ dryRun: DRY, added: anadidos, stacks: deteccion.stacks, checks: actual });
}

/**
 * Huella del árbol de trabajo: qué está a punto de commitearse.
 *
 * Incluye HEAD, estado, bytes del diff staged/unstaged y contenido no rastreado. Lo que importa
 * no es el nombre del estado (`M`), sino que sean exactamente los mismos bytes sobre los que
 * corrieron los gates.
 */
function huellaArbol() {
  // Un repositorio recién creado no tiene HEAD, y su primer commit merece control igual que
  // cualquier otro: se toma el HEAD como cadena vacía en vez de renunciar a la huella.
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  const sucio = spawnSync('git', ['status', '--porcelain', '-z'], { cwd: ROOT });
  if (sucio.status !== 0) return null; // esto sí significa que no hay repositorio
  const ref = head.status === 0 ? (head.stdout || '').trim() : '';
  const argumentosDiff = head.status === 0
    ? ['diff', '--binary', '--no-ext-diff', 'HEAD', '--']
    : ['diff', '--binary', '--no-ext-diff', '--'];
  const diff = spawnSync('git', argumentosDiff, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  const staged = head.status === 0 ? null :
    spawnSync('git', ['diff', '--cached', '--binary', '--no-ext-diff', '--'], {
      cwd: ROOT, maxBuffer: 64 * 1024 * 1024,
    });
  const otros = spawnSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (diff.status !== 0 || (staged && staged.status !== 0) || otros.status !== 0) return null;
  const huella = createHash('sha256')
    .update(ref).update('\0').update(sucio.stdout || '').update('\0')
    .update(diff.stdout || '').update('\0').update(staged?.stdout || '').update('\0');
  for (const ruta of (otros.stdout || '').split('\0').filter(Boolean).sort()) {
    huella.update(ruta).update('\0');
    try { huella.update(readFileSync(join(ROOT, ruta))); } catch { return null; }
    huella.update('\0');
  }
  return huella.digest('hex').slice(0, 16);
}

const SELLO_PATH = join(ROOT, '.sdd', 'state', 'last-gate-run.json');

/**
 * Sello de la última ejecución de gates.
 *
 * Existe para distinguir "los gates pasaron" de "el agente dice que pasaron", que es la
 * distinción sobre la que se sostiene todo este sistema. Lo lee `guard-bash.mjs` antes de dejar
 * pasar un commit o un push.
 */
function escribirSello(velocidad, ok, resultados) {
  const huella = huellaArbol();
  if (huella === null) return; // fuera de un repositorio git no hay nada que sellar
  const previo = (() => { try { return JSON.parse(leer(SELLO_PATH) || '{}'); } catch { return {}; } })();
  const registro = {
    ...previo,
    [velocidad || 'all']: { ok, tree: huella, at: new Date().toISOString(), checks: resultados.map((r) => r.id) },
  };
  try {
    mkdirSync(dirname(SELLO_PATH), { recursive: true });
    writeFileSync(SELLO_PATH, `${JSON.stringify(registro, null, 2)}\n`, 'utf8');
  } catch { /* el sello es una ayuda, no un requisito: si no se puede escribir, no se rompe el run */ }
}

function ejecutarChecks() {
  const config = cargarChecks();
  // Sin bandera se ejecuta todo: el comportamiento anterior no cambia. `--fast` y `--slow`
  // existen para partir el coste entre el commit y el push.
  const filtro = argv.includes('--fast') ? 'fast' : argv.includes('--slow') ? 'slow' : null;
  const resultados = [];
  const omitidos = [];
  let fallo = false;
  for (const [id, check] of Object.entries(config.checks || {})) {
    if (!check?.command || check.enabled === false) continue;
    const velocidad = velocidadDe(check, id);
    if (filtro && velocidad !== filtro) { omitidos.push(id); continue; }
    const inicio = Date.now();
    const resultado = spawnSync(check.command, { cwd: ROOT, shell: true, encoding: 'utf8', stdio: 'inherit' });
    resultados.push({ id, command: check.command, speed: velocidad, status: resultado.status, durationMs: Date.now() - inicio });
    if (resultado.status !== 0 && check.required !== false) fallo = true;
  }
  const noConfigurados = (config.unconfigured || []).filter((id) =>
    !filtro || (GATES[gateBase(id)] || 'fast') === filtro);
  const estado = fallo ? 'fail' : resultados.length ? 'pass' : 'unconfigured';
  if (!JSON_OUT) {
    const alcance = filtro ? ` (${filtro})` : '';
    const veredicto = estado === 'fail' ? 'FAIL' : estado === 'pass' ? 'PASS' : 'NO EJECUTADO';
    console.log(`\n${resultados.length} check(s) ejecutado(s)${alcance}: ${veredicto}`);
    for (const r of resultados) console.log(`  ${r.status === 0 ? '✓' : '✗'} ${r.id} — ${r.command}`);
    if (omitidos.length) console.log(`  · omitidos por velocidad: ${omitidos.join(', ')}`);
    if (noConfigurados.length) console.log(`  · no configurados: ${noConfigurados.join(', ')}`);
  } else console.log(JSON.stringify({
    ok: !fallo, status: estado, speed: filtro, results: resultados, skipped: omitidos, unconfigured: noConfigurados,
  }));
  if (resultados.length) escribirSello(filtro, !fallo, resultados);
  if (fallo) process.exitCode = 1;
}

/**
 * Conteo de marcadores de deuda sobre ficheros versionados.
 *
 * Determinista y agnóstico de lenguaje a propósito: la deuda con adjetivo no se prioriza nunca,
 * y una estimación del modelo no es una medida. Lo opinable es cuánto cuesta saldarla; el conteo
 * no lo es.
 */
function medirDeuda() {
  const listado = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  // Sin git no se inventa un recorrido del sistema de ficheros: acabaría contando dependencias
  // y artefactos de build como deuda propia. Se dice que no se pudo medir, que es un resultado.
  if (listado.status !== 0) {
    return { available: false, reason: 'no es un repositorio git o git no está disponible', total: null, byMarker: null, byDirectory: [], filesScanned: 0 };
  }
  const ficheros = listado.stdout.split('\0').filter(Boolean);
  // El marcador cuenta solo si abre un comentario. Sin esa condición, una variable llamada
  // `TODO` o la propia expresión de este fichero se cuentan como deuda, y una métrica que
  // empieza midiendo ruido se ignora el primer día. Preferimos quedarnos cortos.
  const patron = /(?:\/\/|#|--|\/\*|\*|<!--)[ \t]*(TODO|FIXME|HACK|XXX)\b/g;
  const porDirectorio = new Map();
  const porMarcador = { TODO: 0, FIXME: 0, HACK: 0, XXX: 0 };
  let total = 0;
  let revisados = 0;

  for (const relativo of ficheros) {
    let contenido;
    try { contenido = readFileSync(join(ROOT, relativo), 'utf8'); } catch { continue; }
    if (contenido.includes('\0')) continue; // binario
    revisados += 1;
    const coincidencias = [...contenido.matchAll(patron)];
    if (!coincidencias.length) continue;
    const directorio = relativo.includes('/') ? relativo.slice(0, relativo.lastIndexOf('/')) : '.';
    porDirectorio.set(directorio, (porDirectorio.get(directorio) || 0) + coincidencias.length);
    for (const coincidencia of coincidencias) porMarcador[coincidencia[1]] += 1;
    total += coincidencias.length;
  }

  const directorios = [...porDirectorio.entries()]
    .map(([path, markers]) => ({ path, markers }))
    .sort((a, b) => b.markers - a.markers || a.path.localeCompare(b.path));

  return { available: true, total, byMarker: porMarcador, byDirectory: directorios, filesScanned: revisados };
}

/**
 * URLs de importación de skills para hosts que las cargan al workspace en vez de leerlas del
 * repositorio sincronizado (Lovable y equivalentes).
 *
 * El hash corto existe por la deriva: la copia importada no se actualiza sola, y sin una forma
 * de comparar versiones nadie sabe si el workspace tiene la skill de hace tres meses.
 */
function exportarSkills() {
  const remoto = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' });
  const url = (remoto.stdout || '').trim().replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/');
  const rama = (spawnSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).stdout || 'main').trim() || 'main';

  const skills = nombres('.agents/skills', (x) => x.isDirectory() && !x.name.startsWith('_'));
  const entradas = [];
  for (const skill of skills) {
    const ruta = join(ROOT, '.agents/skills', skill, 'SKILL.md');
    const contenido = leer(ruta);
    if (contenido === null) continue;
    const relativas = [...contenido.matchAll(/\]\((\.\.\/[^)]*)\)/g)].map((m) => m[1]);
    entradas.push({
      skill,
      importUrl: url ? `${url}/tree/${rama}/.agents/skills/${skill}` : null,
      sha: hash(contenido).slice(0, 8),
      bytes: Buffer.byteLength(contenido, 'utf8'),
      relativeLinks: relativas,
    });
  }

  const conRelativas = entradas.filter((e) => e.relativeLinks.length);
  const salida = { remote: url || null, branch: rama, count: entradas.length, skills: entradas };

  if (JSON_OUT) { console.log(JSON.stringify(salida)); if (conRelativas.length) process.exitCode = 1; return; }

  if (!url) {
    console.log('Sin remoto `origin`: no se pueden generar URLs de importación.');
    console.log('Alternativa: sube cada carpeta de .agents/skills/ como .zip al host.');
    return;
  }
  console.log(`${entradas.length} skill(s) · rama ${rama}`);
  console.log('\nImporta cada una en el host (en Lovable: Settings → Skills → Import from GitHub):\n');
  for (const e of entradas) console.log(`  ${e.sha}  ${e.importUrl}`);

  if (conRelativas.length) {
    console.log('\n⚠ Estas skills enlazan con rutas relativas y se romperán al importarse sueltas:');
    for (const e of conRelativas) console.log(`  ${e.skill}: ${e.relativeLinks.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  console.log('\nEl hash identifica la versión: compáralo para saber si el workspace está al día.');
  console.log('La copia importada no se actualiza sola — reimporta tras cambiar una skill.');
}

function informeDeuda() {
  const deuda = medirDeuda();
  if (JSON_OUT) { console.log(JSON.stringify(deuda)); return; }
  if (!deuda.available) {
    console.log(`No se pudo medir la deuda: ${deuda.reason}.`);
    console.log('"No medido" es un resultado válido y se escribe; "cero" sin medir, no.');
    return;
  }
  console.log(`Marcadores de deuda: ${deuda.total} en ${deuda.filesScanned} fichero(s) versionado(s)`);
  console.log(`  TODO ${deuda.byMarker.TODO} · FIXME ${deuda.byMarker.FIXME} · HACK ${deuda.byMarker.HACK} · XXX ${deuda.byMarker.XXX}`);
  if (!deuda.total) return;
  console.log('\nPor directorio:');
  for (const { path, markers } of deuda.byDirectory.slice(0, 15)) console.log(`  ${String(markers).padStart(4)}  ${path}`);
  if (deuda.byDirectory.length > 15) console.log(`  … y ${deuda.byDirectory.length - 15} directorio(s) más`);
  console.log('\nEl conteo es el dato; el esfuerzo para saldarlo es una estimación humana.');
  console.log('Ratio y banderas: docs/quality/TECH-DEBT.md');
}

// La ayuda se resuelve antes de validar argumentos: hasta ahora `--help` moría como "argumento
// desconocido", que es exactamente el momento en que alguien necesita la ayuda.
if (argv.includes('--help') || argv.includes('-h') || comando === 'help') {
  console.log(USO);
  process.exit(0);
}

try {
  if (comando === 'detect') imprimir(detectar());
  else if (comando === 'inventory') imprimir(inventario());
  else if (comando === 'product-status') imprimir(estadoProducto());
  else if (comando === 'approve-product') aprobarProducto();
  else if (comando === 'docs-status') imprimir(estadoDocumentacion());
  else if (comando === 'approve-docs') aprobarDocumentacion();
  else if (comando === 'trace-correct') corregirTraza();
  else if (comando === 'new-spec') nuevaSpec();
  else if (comando === 'new-adr') nuevoAdr();
  else if (comando === 'scaffold') scaffold();
  else if (comando === 'trace-status') traceStatus();
  else if (comando === 'generate') generar();
  else if (comando === 'verify') verificar();
  else if (comando === 'configure') configurar();
  else if (comando === 'run') ejecutarChecks();
  else if (comando === 'debt') informeDeuda();
  else if (comando === 'skills-export') exportarSkills();
  else if (comando === 'status') imprimir(snapshotEstado());
  else throw new Error(`Comando desconocido: ${comando}. Prueba \`--help\`.`);
} catch (error) {
  // Quien pidió JSON necesita JSON también cuando algo falla: un agente que recibe prosa en
  // stderr solo puede adivinar. El mensaje describe el fallo, nunca el sistema de ficheros
  // del host ni la traza de pila.
  if (JSON_OUT) console.error(JSON.stringify({ schemaVersion: 1, ok: false, command: comando, error: error.message }));
  else console.error(error.message);
  process.exit(1);
}
