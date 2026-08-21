#!/usr/bin/env node
/**
 * SessionStart — inyecta el estado del circuito SDD al abrir la sesión.
 * Evita la pregunta "¿por dónde íbamos?" en cada arranque.
 */
import { join } from 'node:path';
import {
  readHookInput, projectRoot, inject, readIfExists,
  findActiveSpec, lastDecisions, listDirs, specsDirectory,
} from './_lib.mjs';

const input = await readHookInput();
const root = projectRoot(input);
const lineas = [];

const constitution = readIfExists(join(root, 'docs/architecture/constitution.md'));
if (!constitution) {
  lineas.push(
    '## Estado SDD',
    '',
    '⚠️  No existe `docs/architecture/constitution.md`.',
    '- Repo vacío o nuevo → ejecuta `/sdd-init`.',
    '- Repo con código sin documentar → ejecuta `/onboard`.',
  );
} else {
  const arquitectura =
    (constitution.match(/^-?\s*\**Estilo arquitect[óo]nico\**\s*:\s*(.+)$/im) || [])[1] ||
    (constitution.match(/^#\s+(.+)$/m) || [])[1] ||
    'ver constitution.md';

  lineas.push('## Estado SDD', '', `📐 Arquitectura: ${arquitectura.trim()}`);

  const spec = findActiveSpec(root);
  if (spec) {
    lineas.push(
      `📋 Spec activa: **${spec.nombre}** — tareas ${spec.hechas}/${spec.total}` +
        (spec.enCurso ? ` (${spec.enCurso} en curso)` : ''),
      `   ${spec.dir.replace(root, '.').replace(/\\/g, '/')}`,
      '👉 Continúa con `/sdd-implement` o revisa con `/sdd-status`.',
    );
  } else {
    const specs = listDirs(specsDirectory(root));
    lineas.push(
      specs.length
        ? `📋 Specs: ${specs.length} · ninguna con tareas pendientes.`
        : '📋 No hay specs todavía.',
      '👉 Nueva funcionalidad → `/sdd-specify`.',
    );
  }

  const decisiones = lastDecisions(root, 3);
  if (decisiones.length) {
    lineas.push('', '📝 Últimas decisiones en bitácora:');
    decisiones.forEach((d) => lineas.push(`   · ${d}`));
  }
}

lineas.push(
  '',
  'Recuerda: sin spec no hay código; sin test rojo no hay implementación.',
  'Cierra cada fase con el bloque `### HANDOFF`.',
);

inject(lineas.join('\n'));
