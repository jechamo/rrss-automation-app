/** Corrobora trailers, frontera histórica, territorio y límites compactos. */
import { decidirTerritorio } from '../../.sdd/hooks/territorios.mjs';
import { clasificarCircuito, canonicalizarRuta, motivoMaterial, cuota } from './circuito.mjs';

const FORMA_TAREA = /^T-\d{3}-\d+$/;

export function parsearTrailers(mensaje) {
  const lines = String(mensaje || '').replace(/\r\n/g, '\n').split('\n');
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const block = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^[A-Za-z][A-Za-z0-9-]*:(?:\s|$)/.test(lines[i])) block.unshift(lines[i]);
    else break;
  }
  const trailers = {};
  for (const line of block) {
    const cut = line.indexOf(':');
    trailers[line.slice(0, cut).trim()] = line.slice(cut + 1).trim();
  }
  return trailers;
}

function validateTrace(t, context, findings, short, { requireSpecTask = true } = {}) {
  const required = requireSpecTask ? ['Spec', 'Task', 'Agent'] : ['Agent'];
  for (const key of required)
    if (!t[key]) findings.push(`${short}: falta el trailer \`${key}:\`. Añade \`${key}: <valor>\` al bloque final.`);

  if (t.Task && !FORMA_TAREA.test(t.Task)) findings.push(`${short}: \`Task: ${t.Task}\` no tiene la forma \`T-NNN-N\`.`);
  else if (t.Task && !context.tareas.has(t.Task)) findings.push(`${short}: la tarea \`${t.Task}\` no existe.`);
  if (t.Agent && !context.agentes.has(t.Agent)) findings.push(`${short}: el agente \`${t.Agent}\` no existe en .claude/agents/.`);
  if (t.Spec && context.specs.size && !context.specs.has(t.Spec)) findings.push(`${short}: la spec \`${t.Spec}\` no existe.`);
  if (t.Spec && t.Task && FORMA_TAREA.test(t.Task) && !t.Task.startsWith(`T-${t.Spec}-`))
    findings.push(`${short}: \`Task: ${t.Task}\` no pertenece a \`Spec: ${t.Spec}\`.`);
}

function validateTerritory(t, files, context, findings, short) {
  if (!t.Agent || !context.agentes.has(t.Agent) || !context.reparto) return;
  const invasions = [];
  for (const path of files) {
    const verdict = decidirTerritorio({ agente: t.Agent, ruta: path, modo: 'deny', config: context.reparto });
    if (verdict.decision === 'deny') invasions.push(`${path} (territorio de ${verdict.dueno || verdict.territorio})`);
  }
  if (invasions.length && !Object.hasOwn(t, 'Trace-exception'))
    findings.push(`${short}: \`${t.Agent}\` tocó territorio ajeno — ${invasions.join(', ')}. Añade \`Trace-exception: <motivo>\` si fue deliberado.`);
  else if (invasions.length && !motivoMaterial(t['Trace-exception']))
    findings.push(`${short}: \`Trace-exception\` no contiene un motivo material.`);
}

export function auditarCommit(commit, input = {}) {
  const { sha = '', mensaje = '', ficheros = [] } = commit || {};
  const context = {
    tareas: input.tareas || new Set(), agentes: input.agentes || new Set(),
    specs: input.specs || new Set(), reparto: input.reparto || null,
    frontera: input.frontera || null, lightFiles: input.lightFiles || null,
    enforceTrailers: Boolean(input.enforceTrailers), circuitConfigHash: input.circuitConfigHash || null,
    changeSeals: input.changeSeals || new Map(),
    activationTransition: Boolean(input.activationTransition),
    circuitApprovalTransition: Boolean(input.circuitApprovalTransition),
    activationCommitValid: input.activationCommitValid !== false,
    changeApprovalTransition: Boolean(input.changeApprovalTransition),
    changeApprovalPaths: input.changeApprovalPaths || [],
    fileTypes: input.fileTypes || null, trackedPaths: input.trackedPaths || [],
    decisionRefs: input.decisionRefs || new Set(),
    requireGitAuthor: Boolean(input.requireGitAuthor),
  };
  const t = parsearTrailers(mensaje);
  const findings = [];
  const short = String(sha).slice(0, 8) || 'sin sha';
  const declared = String(t.Circuit || '').trim().toLowerCase();

  if (context.requireGitAuthor && !String(commit?.author || '').trim())
    findings.push(`${short}: Git no expone una autoría material para el commit.`);

  if (!declared && !t.Task && !t.Agent && !t.Spec) {
    const message = `${short}: sin trailers de traza; no auditable`;
    return { estado: context.enforceTrailers ? 'infractor' : 'no-auditable', hallazgos: [message] };
  }

  const mode = declared || 'full';
  if (!['light', 'compact', 'full'].includes(mode))
    findings.push(`${short}: \`Circuit: ${t.Circuit}\` no es light, compact ni full.`);
  if (context.enforceTrailers && !declared) findings.push(`${short}: falta el trailer \`Circuit:\`.`);
  if (declared && !motivoMaterial(t['Circuit-reason'])) findings.push(`${short}: \`Circuit-reason\` no contiene un motivo material.`);
  if (context.enforceTrailers) {
    if (!t['Circuit-config']) findings.push(`${short}: falta el trailer \`Circuit-config:\`.`);
    else if (t['Circuit-config'] !== context.circuitConfigHash)
      findings.push(`${short}: \`Circuit-config\` no coincide con la frontera aprobada del padre.`);
  }
  if ((context.activationTransition || context.circuitApprovalTransition) &&
      (mode !== 'full' || ficheros.length !== 1 || canonicalizarRuta(ficheros[0]) !== '.sdd/circuit.json'))
    findings.push(`${short}: la activación exige un commit full dedicado que solo toque .sdd/circuit.json.`);
  if ((context.activationTransition || context.circuitApprovalTransition) && !context.activationCommitValid)
    findings.push(`${short}: activationCommit no coincide con el padre del commit de activación.`);
  if (context.changeApprovalTransition) {
    const expected = new Set(context.changeApprovalPaths.map(canonicalizarRuta));
    const actual = new Set(ficheros.map(canonicalizarRuta));
    if (mode !== 'full' || expected.size !== 1 || actual.size !== 1 || [...expected].some((path) => !actual.has(path)))
      findings.push(`${short}: aprobar change.md exige un commit full dedicado anterior al código.`);
  }

  if (mode === 'light') {
    validateTrace(t, context, findings, short, { requireSpecTask: false });
    if (t.Spec || t.Task) findings.push(`${short}: light no debe declarar Spec/Task; si existe conducta usa compact/full.`);
    if (context.frontera) {
      const verdict = clasificarCircuito(ficheros, context.frontera, {
        securityImpact: 'no-sensible', fileTypes: context.fileTypes, trackedPaths: context.trackedPaths,
        decisionRefs: context.decisionRefs,
      });
      if (verdict.circuito !== 'light') findings.push(`${short}: light toca rutas fuera de la frontera — ${verdict.obligan.join(', ')}.`);
    } else if (context.lightFiles) {
      const outside = ficheros.filter((file) => !context.lightFiles.has(canonicalizarRuta(file)));
      if (outside.length) findings.push(`${short}: light toca rutas fuera de sus ficheros exactos — ${outside.join(', ')}.`);
    } else findings.push(`${short}: declara light sin frontera aprobada en .sdd/circuit.json.`);
  } else {
    validateTrace(t, context, findings, short);
    if (mode === 'compact') {
      const verdict = clasificarCircuito(ficheros, context.frontera, {
        securityImpact: 'no-sensible', fileTypes: context.fileTypes, trackedPaths: context.trackedPaths,
        decisionRefs: context.decisionRefs,
      });
      if (verdict.circuito === 'full')
        findings.push(`${short}: compact toca rutas que exigen full — ${verdict.obligan.join(', ')}.`);
      if (!t['Change-Group']) findings.push(`${short}: compact requiere \`Change-Group:\`.`);
      if (!t['Change-seal']) findings.push(`${short}: compact requiere \`Change-seal:\`.`);
      const expected = context.changeSeals.get(t['Change-Group']);
      if (expected && t['Change-seal'] !== expected) findings.push(`${short}: \`Change-seal\` no coincide con la intención aprobada.`);
      if (!expected && context.enforceTrailers) findings.push(`${short}: Change-Group no tiene intención aprobada.`);
      const module = canonicalizarRuta(commit?.scope?.module);
      const outsideModule = module ? ficheros.filter((file) => {
        const path = canonicalizarRuta(file);
        return path !== module && !path?.startsWith(`${module}/`);
      }) : ficheros;
      if (outsideModule.length) findings.push(`${short}: compact excede el módulo sellado — ${outsideModule.join(', ')}.`);
      const approvedRoutes = new Set((commit?.scope?.routes || []).map(canonicalizarRuta).filter(Boolean));
      const outsideRoutes = ficheros.filter((file) => !approvedRoutes.has(canonicalizarRuta(file)));
      if (!approvedRoutes.size || outsideRoutes.length)
        findings.push(`${short}: compact excede las rutas exactas selladas — ${outsideRoutes.join(', ') || 'alcance ausente'}.`);
    }
  }

  validateTerritory(t, ficheros, context, findings, short);
  return { estado: findings.length ? 'infractor' : 'conforme', ligero: mode === 'light', mode, hallazgos: findings };
}

export function auditarCommits(commits, context = {}) {
  const results = commits.map((commit) => ({ sha: commit.sha, ...auditarCommit(commit, { ...context, ...(commit.context || {}) }) }));
  const latestPolicy = [...commits].reverse().find((commit) => commit.reportable !== false)?.context?.limits;
  const window = Math.min(100, Math.max(1, Number(latestPolicy?.auditWindow || context.limits?.auditWindow || 20)));
  const auditable = commits.map((commit, index) => ({ commit, index }))
    .filter(({ commit }) => ['light', 'compact', 'full'].includes(String(parsearTrailers(commit.mensaje).Circuit || '').toLowerCase()))
    .slice(-window);
  const byModule = new Map();
  const warnings = [];
  for (const { commit, index } of auditable) {
    const result = results[index];
    if (result.mode !== 'compact' || !commit.scope?.module) continue;
    const module = canonicalizarRuta(commit.scope.module);
    if (!module) continue;
    const trailers = parsearTrailers(commit.mensaje);
    const group = trailers['Change-Group'] || `sin-grupo:${commit.sha}`;
    const seal = trailers['Change-seal'] || `sin-sello:${commit.sha}`;
    const aggregate = byModule.get(module) || { groups: new Map(), criteria: 0, tasks: 0, intentBytes: 0 };
    const previous = aggregate.groups.get(group);
    if (!previous || previous.seal !== seal) {
      if (!previous && aggregate.groups.size && commit.reportable !== false)
        warnings.push(`${String(commit.sha).slice(0, 8)}: otro Change-Group compacto toca ${module} dentro de los últimos ${window} commits auditables.`);
      if (previous) {
        aggregate.criteria -= previous.criteria;
        aggregate.tasks -= previous.tasks;
        aggregate.intentBytes -= previous.intentBytes;
      }
      const contribution = { seal, criteria: Number(commit.scope.criteria || 0),
        tasks: Number(commit.scope.tasks || 0), intentBytes: Number(commit.scope.intentBytes || 0) };
      aggregate.groups.set(group, contribution);
      aggregate.criteria += contribution.criteria;
      aggregate.tasks += contribution.tasks;
      aggregate.intentBytes += contribution.intentBytes;
    }
    byModule.set(module, aggregate);
    const limits = commit.context?.limits || context.limits || {};
    if (aggregate.criteria > limits.criteria || aggregate.tasks > limits.tasks ||
        aggregate.intentBytes > limits.intentBytes) {
      result.estado = 'infractor';
      result.hallazgos.push(`${String(commit.sha).slice(0, 8)}: la unión compacta del módulo excede los límites aprobados; exige full.`);
    }
  }
  const visible = results.filter((_, index) => commits[index]?.reportable !== false);
  const reduced = visible.filter((result) => result.mode === 'light' || result.mode === 'compact').length;
  return {
    total: visible.length,
    conformes: visible.filter((result) => result.estado === 'conforme').length,
    noAuditables: visible.filter((result) => result.estado === 'no-auditable').length,
    infractores: visible.filter((result) => result.estado === 'infractor'),
    avisos: warnings,
    cuota: cuota({ ligeros: reduced, total: visible.length, maximo: context?.frontera?.cuota ?? context?.quota ?? 1 }),
    resultados: results,
  };
}
