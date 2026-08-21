#!/usr/bin/env node
/**
 * PreToolUse (Bash) — controla comandos.
 *
 *   deny  → destructivo o irreversible sin recuperación
 *   ask   → afecta infraestructura, datos remotos o historial compartido
 *   allow → adelante
 *
 * Distinguir `deny` de `ask` importa: bloquear un `terraform apply` legítimo
 * frustra; dejarlo pasar sin preguntar, arruina.
 */
import { readHookInput, decide, gatesEnabled, toolCall, comandosDe, hostDestino, projectRoot, readIfExists } from './_lib.mjs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const input = await readHookInput();
const { entrada } = toolCall(input);
const host = hostDestino();
const comandos = comandosDe(entrada);
if (!comandos.length || !gatesEnabled()) decide('allow', 'Sin comando que evaluar.', host);

// ── deny: destructivo sin vuelta atrás ───────────────────────────────────────
const destructivos = [
  { re: /\brm\s+(-[a-z]*[rf][a-z]*\s+)+(\/|\/\*|~|\$HOME)(\s|$)/, motivo: 'Borrado recursivo de raíz o del home.' },
  { re: /\brm\s+-[a-z]*[rf]/, motivo: 'Borrado recursivo forzado. Enumera los ficheros.' },
  { re: /\bRemove-Item\b[^\r\n]*(-Recurse[^\r\n]*-Force|-Force[^\r\n]*-Recurse)/i, motivo: 'Borrado recursivo forzado (PowerShell).' },
  { re: /\bgit\s+reset\s+--hard\b/, motivo: 'Descarta cambios sin recuperación.' },
  { re: /\bgit\s+clean\s+-[a-z]*f/, motivo: 'Borra ficheros no rastreados de forma irreversible.' },
  { re: /\b(DROP|TRUNCATE)\s+(DATABASE|SCHEMA)\b/i, motivo: 'DDL destructivo sobre la base completa.' },
  { re: /\bDELETE\s+FROM\b(?![\s\S]*\bWHERE\b)/i, motivo: 'DELETE sin WHERE.' },
  { re: /\bUPDATE\s+\w+\s+SET\b(?![\s\S]*\bWHERE\b)/i, motivo: 'UPDATE sin WHERE.' },
  { re: /\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba)?sh\b/, motivo: 'Descargar y ejecutar a ciegas. Descarga, revisa y luego ejecuta.' },
  { re: /\bchmod\s+(-R\s+)?777\b/, motivo: 'Permisos 777.' },
  { re: /\bmkfs\b|\bdd\s+.*of=\/dev\//, motivo: 'Escritura directa sobre dispositivo.' },
  { re: /\bhistory\s+-c\b|\bshred\b/, motivo: 'Borrado de rastro.' },
  { re: /\b(cat|type|less|more|head|tail)\s+[^|;&]*\.env(\s|$)/, motivo: 'Lectura de secretos. Usa `.env.example`.' },
];

for (const cmd of comandos) {
  for (const d of destructivos) {
    if (d.re.test(cmd)) {
      decide(
        'deny',
        `Comando bloqueado: ${cmd.slice(0, 120)}\nMotivo: ${d.motivo}\n` +
          'Si es realmente necesario, explícaselo al usuario y que lo ejecute él.',
        host,
      );
    }
  }
}

// ── ask: reversible, pero con consecuencias fuera de tu máquina ──────────────
const sensibles = [
  { re: /\bgit\s+push\b[^\r\n]*(--force|-f)\b(?!\S*with-lease)/, motivo: 'Reescribe historia compartida. Considera --force-with-lease.' },
  { re: /\bgit\s+push\b/, motivo: 'Publica en el remoto.' },
  { re: /\bgit\s+(commit|merge|rebase)\b/, motivo: 'Modifica el historial local del repositorio.' },
  { re: /\bgit\s+branch\s+-D\b/, motivo: 'Borrado forzado de rama.' },
  { re: /\bDROP\s+TABLE\b/i, motivo: 'Elimina una tabla.' },
  { re: /\b(terraform|tofu|pulumi)\s+(apply|destroy)\b/, motivo: 'Cambia infraestructura real. Muestra el plan primero.' },
  { re: /\b(kubectl|helm)\b[^\r\n]*(delete|apply|upgrade)\b/, motivo: 'Cambia recursos en el clúster.' },
  { re: /\b(npm|pnpm|yarn)\s+publish\b|\bcargo\s+publish\b|\btwine\s+upload\b/, motivo: 'Publicación pública e irreversible.' },
  { re: /\bdocker\s+system\s+prune\b.*-a/, motivo: 'Purga total de Docker.' },
  { re: /\bgh\s+(pr\s+(create|merge)|release\s+create)\b/, motivo: 'Acción pública en GitHub.' },
  { re: /\bskills\s+add\b|\bplugin\s+marketplace\s+add\b/,
    motivo: 'Instala una skill de terceros: instrucciones que este agente obedecerá y scripts que ' +
            'puede ejecutar. Auditala y fíjala primero (docs/agents/SKILLS-EXTERNAS.md).' },
];

/**
 * Estado de los gates para lo que se está a punto de commitear o empujar.
 *
 * Los git hooks solo existen donde hay git local: en un host sin ellos, un agente puede commitear
 * sin haber pasado un solo control. Esto lo comprueba desde el lado del agente, que sí está en
 * todas partes.
 *
 * Devuelve un aviso, nunca un bloqueo: hay commits legítimos sin gates —una errata en un
 * documento— y una guarda que impide lo razonable se desactiva el primer día. Lo que consigue es
 * que el humano vea el hueco **antes** de aprobar, en vez de enterarse en CI.
 */
function estadoDeGates(velocidad, root) {
  const sello = (() => {
    try { return JSON.parse(readIfExists(join(root, '.sdd/state/last-gate-run.json')) || 'null'); }
    catch { return null; }
  })();
  const entrada = sello?.[velocidad];
  if (!entrada) return `no consta que hayan pasado los gates \`${velocidad}\``;
  if (!entrada.ok) return `la última ejecución de \`${velocidad}\` salió en rojo`;

  // Mismo cálculo que `huellaArbol()` en sdd-project.mjs. Un repositorio sin commits todavía no
  // tiene HEAD, y su primer commit también se controla: el ref se toma vacío.
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const sucio = spawnSync('git', ['status', '--porcelain', '-z'], { cwd: root });
  if (sucio.status !== 0) return null; // sin repositorio no hay nada que comparar
  const ref = head.status === 0 ? (head.stdout || '').trim() : '';
  const argumentosDiff = head.status === 0
    ? ['diff', '--binary', '--no-ext-diff', 'HEAD', '--']
    : ['diff', '--binary', '--no-ext-diff', '--'];
  const diff = spawnSync('git', argumentosDiff, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  const staged = head.status === 0 ? null :
    spawnSync('git', ['diff', '--cached', '--binary', '--no-ext-diff', '--'], {
      cwd: root, maxBuffer: 64 * 1024 * 1024,
    });
  const otros = spawnSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (diff.status !== 0 || (staged && staged.status !== 0) || otros.status !== 0)
    return 'no se pudo calcular la huella material del árbol';
  const hasher = createHash('sha256')
    .update(ref).update('\0').update(sucio.stdout || '').update('\0')
    .update(diff.stdout || '').update('\0').update(staged?.stdout || '').update('\0');
  for (const ruta of (otros.stdout || '').split('\0').filter(Boolean).sort()) {
    hasher.update(ruta).update('\0');
    try { hasher.update(readFileSync(join(root, ruta))); }
    catch { return 'no se pudo leer un fichero no rastreado para validar la huella'; }
    hasher.update('\0');
  }
  const actual = hasher.digest('hex').slice(0, 16);
  if (actual !== entrada.tree) return `los gates \`${velocidad}\` pasaron sobre otro estado del árbol`;

  let configuracion;
  try { configuracion = JSON.parse(readIfExists(join(root, '.sdd/checks.json')) || '{}'); }
  catch { return 'no se puede validar el sello porque .sdd/checks.json no es JSON válido'; }
  const lentos = new Set(['coverage', 'e2e', 'visual', 'a11y', 'security', 'deps-audit', 'docs', 'mutation']);
  const requeridos = Object.entries(configuracion?.checks || {})
    .filter(([id, check]) => {
      if (check?.required !== true || check.enabled === false || typeof check?.command !== 'string' || !check.command.trim()) return false;
      const base = String(id).split(':')[0];
      const speed = check.speed || (lentos.has(base) ? 'slow' : 'fast');
      return speed === velocidad;
    })
    .map(([id]) => id)
    .sort();
  const ejecutados = new Set(Array.isArray(entrada.checks) ? entrada.checks : []);
  const ausentes = requeridos.filter((id) => !ejecutados.has(id));
  if (ausentes.length)
    return `el sello \`${velocidad}\` no incluye gates obligatorios configurados: ${ausentes.join(', ')}`;
  return null;
}

const root = projectRoot(input);
const VELOCIDAD_POR_COMANDO = [
  { re: /\bgit\s+push\b/, velocidad: 'slow', gate: 'run --slow' },
  { re: /\bgit\s+commit\b/, velocidad: 'fast', gate: 'run --fast' },
];

for (const cmd of comandos) {
  for (const s of sensibles) {
    if (s.re.test(cmd)) {
      const aplica = VELOCIDAD_POR_COMANDO.find((v) => v.re.test(cmd));
      const pendiente = aplica ? estadoDeGates(aplica.velocidad, root) : null;
      const extra = pendiente
        ? `\n\n⚠ Gates: ${pendiente}.\n  Ejecuta primero: node scripts/sdd-project.mjs ${aplica.gate}`
        : aplica ? '\n\n✓ Gates: pasados sobre este mismo estado del árbol.' : '';
      decide('ask', `${s.motivo}\nComando: ${cmd.slice(0, 160)}${extra}`, host);
    }
  }
}

decide('allow', 'Comando permitido por la guarda SDD.', host);
