#!/usr/bin/env node
/**
 * skills-sync — gobierno de las skills de terceros.
 *
 * Una skill es instrucciones que el agente obedece más un directorio de scripts que puede
 * ejecutar: es una dependencia ejecutable. Este script la trata como tal.
 *
 * Deliberadamente **no instala nada**. Imprime el comando para que lo ejecute una persona.
 * Un script que descarga y activa instrucciones de terceros sin intervención humana es
 * exactamente ASI04 (cadena de suministro agéntica) con otro nombre.
 *
 *   node scripts/skills-sync.mjs           → qué aplica al stack detectado
 *   node scripts/skills-sync.mjs --check   → valida el manifiesto y la política (falla en CI)
 *   node scripts/skills-sync.mjs --plan    → comandos de instalación de lo aprobado y aplicable
 *   node scripts/skills-sync.mjs --all     → catálogo completo, aplique o no
 *
 * Node >= 18, sin dependencias.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const PLAN = args.includes('--plan');
const TODO = args.includes('--all');

const MANIFIESTO = join(ROOT, '.sdd/external-skills.json');
const ESTADOS = ['candidata', 'aprobada', 'rechazada'];

const problemas = [];
const err = (msg) => problemas.push(msg);

function salir() {
  if (problemas.length) {
    console.log('\nProblemas:');
    for (const p of problemas) console.log(`  ✗ ${p}`);
    console.log(`\n${problemas.length} problema(s) en el gobierno de skills externas.`);
    process.exit(1);
  }
  process.exit(0);
}

if (!existsSync(MANIFIESTO)) {
  console.log('No hay .sdd/external-skills.json — no se declaran skills de terceros.');
  process.exit(0);
}

let manifiesto;
try {
  manifiesto = JSON.parse(readFileSync(MANIFIESTO, 'utf8'));
} catch (e) {
  err(`.sdd/external-skills.json no es JSON válido: ${e.message}`);
  salir();
}

const skills = Array.isArray(manifiesto.entries)
  ? manifiesto.entries
  : Array.isArray(manifiesto.skills) ? manifiesto.skills : [];

// ── Stack detectado ──────────────────────────────────────────────────────────
const pkg = existsSync(join(ROOT, 'package.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  : null;
const deps = new Set([
  ...Object.keys(pkg?.dependencies || {}),
  ...Object.keys(pkg?.devDependencies || {}),
]);

/** Una condición vacía no aplica: preferimos no recomendar a recomendar de más. */
function aplica(cuando) {
  if (!cuando || typeof cuando !== 'object') return false;
  if (cuando.siempre === true) return true;
  if (cuando.siempre === false) return false;
  if (Array.isArray(cuando.cualquierDependencia) && cuando.cualquierDependencia.some((d) => deps.has(d)))
    return true;
  if (Array.isArray(cuando.cualquierFichero) && cuando.cualquierFichero.some((f) => existsSync(join(ROOT, f))))
    return true;
  return false;
}

// ── --check: la política se cumple o el CI falla ─────────────────────────────
if (CHECK) {
  const locales = new Set(
    existsSync(join(ROOT, '.agents/skills'))
      ? readdirSync(join(ROOT, '.agents/skills'), { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
      : [],
  );
  const ids = new Set();

  for (const s of skills) {
    const et = s.id || s.ref || '(sin id)';
    if (!s.id) err(`${et}: falta 'id'`);
    else if (ids.has(s.id)) err(`${s.id}: id duplicado`);
    else ids.add(s.id);

    if (!s.ref) err(`${et}: falta 'ref' — sin referencia no es instalable ni auditable`);
    if (!s.publicador) err(`${et}: falta 'publicador' — hay que saber de quién es el código`);
    if (!s.terreno) err(`${et}: falta 'terreno'`);
    if (!ESTADOS.includes(s.estado)) err(`${et}: estado '${s.estado}' no válido (${ESTADOS.join(' | ')})`);

    // La regla que de verdad protege: nada aprobado sin fijar.
    if (s.estado === 'aprobada') {
      if (!s.pin) err(`${et}: 'aprobada' sin 'pin'. Seguir una referencia móvil es instalar lo que otro decida mañana`);
      if (!s.licencia || /por verificar/i.test(s.licencia))
        err(`${et}: 'aprobada' con licencia sin verificar ('${s.licencia}')`);
      const nombreLocal = s.local || String(s.ref).split(/[:/]/).pop();
      if (s.vendorizada === true) {
        if (!s.local) err(`${et}: vendorizada sin nombre 'local'`);
        else if (!locales.has(s.local)) err(`${et}: declara copia vendorizada pero falta .agents/skills/${s.local}/`);
        if (!s.comando || !String(s.comando).includes(String(s.pin)))
          err(`${et}: vendorizada sin comando reproducible fijado al mismo pin`);
      } else if (locales.has(s.id) || locales.has(nombreLocal)) {
        err(`${et}: colisiona con una skill propia de .agents/skills/`);
      }
    }
    if (s.estado === 'rechazada' && !s.notas)
      err(`${et}: 'rechazada' sin motivo escrito. Un descarte sin motivo se repite`);
    if (/(^|[:/])latest$/i.test(String(s.pin || '')))
      err(`${et}: pin 'latest' no es un pin`);
  }

  if (!existsSync(join(ROOT, String(manifiesto.registro || 'docs/agents/SKILLS-EXTERNAS.md'))))
    err(`el registro de auditoría '${manifiesto.registro}' no existe`);

  const n = skills.length;
  const aprobadas = skills.filter((s) => s.estado === 'aprobada').length;
  console.log(
    `skills-sync --check · ${n} declarada(s) · ${aprobadas} aprobada(s) · ` +
      `${skills.filter((s) => s.estado === 'rechazada').length} rechazada(s)`,
  );
  if (!problemas.length) console.log('\n✅ Manifiesto y política de skills externas correctos.');
  salir();
}

// ── Informe por defecto / --plan / --all ─────────────────────────────────────
const filas = skills
  .map((s) => ({ ...s, _aplica: aplica(s.cuando) }))
  .filter((s) => TODO || s._aplica || s.estado === 'aprobada');

console.log(`skills externas · manifiesto: .sdd/external-skills.json`);
console.log(`stack detectado: ${deps.size} dependencia(s) en package.json\n`);

if (!filas.length) {
  console.log('Ninguna skill externa aplica al stack actual. Con --all ves el catálogo completo.');
  process.exit(0);
}

const marca = { aprobada: '✔', candidata: '·', rechazada: '✗' };
for (const s of filas) {
  const estado = `${marca[s.estado] || '?'} ${s.estado}`;
  console.log(`${estado.padEnd(14)} ${String(s.terreno).padEnd(7)} ${s.ref}`);
  console.log(`${''.padEnd(14)} ${s.aporta || ''}`);
  if (s._aplica && s.estado === 'candidata')
    console.log(`${''.padEnd(14)} → aplica a este stack y NO está auditada: audítala antes de usarla`);
  if (s.notas) console.log(`${''.padEnd(14)} nota: ${s.notas}`);
  console.log('');
}

if (PLAN) {
  const instalables = filas.filter((s) => s.estado === 'aprobada' && s._aplica);
  console.log('── Comandos de instalación (ejecútalos tú, este script no lo hace) ──');
  if (!instalables.length) {
    console.log('Nada aprobado y aplicable. Audita una candidata primero y anótala en el registro.');
  } else {
    for (const s of instalables)
      console.log(s.comando || `npx skills add ${s.ref}${s.pin ? `@${s.pin}` : ''}`);
  }
  console.log('');
}

console.log(
  'Auditoría y decisiones: docs/agents/SKILLS-EXTERNAS.md · ' +
    'valida la política con: node scripts/skills-sync.mjs --check',
);
