import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const MAX_SUMMARY_BYTES = 8 * 1024;

const SECRET_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  /(?:api[_-]?key|token|secret|password)\s*[=:]\s*[^\s,;]+/gi,
  /\bAuthorization\s*:\s*(?:Bearer|Basic)\s+[^\s]+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

function truncarUtf8(texto, maxBytes) {
  const buffer = Buffer.from(String(texto || ''), 'utf8');
  if (buffer.length <= maxBytes) return { text: buffer.toString('utf8'), truncated: false };
  const marca = '\n…[TRUNCATED]';
  const limite = Math.max(0, maxBytes - Buffer.byteLength(marca));
  return { text: buffer.subarray(0, limite).toString('utf8').replace(/\uFFFD$/, '') + marca, truncated: true };
}

export function sanitizarSalida(valor, maxBytes = MAX_SUMMARY_BYTES) {
  const original = String(valor || '');
  let text = original.replace(/\u001b\[[0-9;]*m/g, '');
  let redactions = 0;
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, () => { redactions += 1; return '[REDACTED]'; });
  }
  const truncated = truncarUtf8(text, maxBytes);
  return {
    text: truncated.text,
    truncated: truncated.truncated,
    redactions,
    originalBytes: Buffer.byteLength(original, 'utf8'),
    emittedBytes: Buffer.byteLength(truncated.text, 'utf8'),
  };
}

export function resumirEjecucion({ id, command, status, signal, durationMs, stdout, stderr, timedOut = false }) {
  const combined = [stdout, stderr].filter(Boolean).join('\n');
  const outputHash = createHash('sha256').update(combined).digest('hex');
  // En verde basta el hash y los conteos. En rojo se conserva únicamente un fragmento final:
  // suele contener la aserción útil. Se redacta ANTES de cortar: si el límite partiese
  // `password=valor`, cortar primero perdería la etiqueta que permite reconocer el secreto.
  const redactedCombined = sanitizarSalida(combined,
    Math.max(1, Buffer.byteLength(combined, 'utf8') + 1));
  const fragment = status === 0 ? '' : redactedCombined.text.slice(-MAX_SUMMARY_BYTES);
  const output = sanitizarSalida(fragment, 4 * 1024);
  const safeCommand = sanitizarSalida(command, 2048);
  return {
    id,
    command: safeCommand.text,
    status: Number.isInteger(status) ? status : null,
    signal: signal || null,
    timedOut: Boolean(timedOut),
    durationMs,
    outputHash,
    output: output.text,
    counts: {
      stdoutBytes: Buffer.byteLength(String(stdout || ''), 'utf8'),
      stderrBytes: Buffer.byteLength(String(stderr || ''), 'utf8'),
      stdoutLines: String(stdout || '').split(/\r?\n/).filter(Boolean).length,
      stderrLines: String(stderr || '').split(/\r?\n/).filter(Boolean).length,
      totalBytes: Buffer.byteLength(combined, 'utf8'),
      emittedBytes: output.emittedBytes,
      redactions: redactedCombined.redactions + output.redactions + safeCommand.redactions,
      truncated: output.truncated,
    },
  };
}

/** Ejecuta sin salida heredada y demuestra timeout/límite de captura antes de resumir. */
export function ejecutarProcesoResumido({ id, command, args = null, cwd, shell = false,
  timeoutMs = 15 * 60_000, maxBuffer = 1024 * 1024 }) {
  const timeout = Number.isInteger(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 15 * 60_000) : 15 * 60_000;
  const buffer = Number.isInteger(maxBuffer) && maxBuffer > 0 ? Math.min(maxBuffer, 64 * 1024 * 1024) : 1024 * 1024;
  const started = Date.now();
  const options = { cwd, encoding: 'utf8', stdio: 'pipe', shell, timeout, maxBuffer: buffer };
  const result = args ? spawnSync(command, args, options) : spawnSync(command, options);
  return resumirEjecucion({ id, command: args ? [command, ...args].join(' ') : command,
    status: result.status, signal: result.signal, durationMs: Date.now() - started,
    stdout: result.stdout, stderr: result.stderr || result.error?.message,
    timedOut: result.error?.code === 'ETIMEDOUT' });
}

export function acotarResumen(resumen, maxBytes = MAX_SUMMARY_BYTES) {
  const bounded = structuredClone(resumen);
  const size = (value) => Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  const originalCount = (bounded.results || []).length;
  const failures = (bounded.results || []).filter((result) => result.status !== 0);
  for (const result of failures.slice(1)) result.output = '';
  for (const result of bounded.results || []) {
    if (result.status === 0) result.output = '';
  }
  const first = failures[0];
  if (first && size(bounded) > maxBytes) {
    const original = first.output;
    first.output = '';
    const remaining = maxBytes - size(bounded) - 64;
    first.output = sanitizarSalida(original, Math.max(0, remaining)).text;
  }
  if (size(bounded) > maxBytes && first) first.output = '';
  if (size(bounded) > maxBytes) bounded.results = (bounded.results || []).map((result) =>
    result.execution === 'reused' ? {
      id: result.id, status: result.status, outputHash: result.outputHash, execution: 'reused',
      sourceRunId: result.sourceRunId, sourceAt: result.sourceAt, sourceHead: result.sourceHead,
      reason: result.reason,
    } : result);
  let omitted = 0;
  while (size(bounded) > maxBytes) {
    let index = bounded.results.length - 1;
    while (index >= 0 && (bounded.results[index] === first || bounded.results[index].execution === 'reused')) index -= 1;
    if (index < 0) break;
    bounded.results.splice(index, 1);
    omitted += 1;
    bounded.resultsOmitted = omitted;
    bounded.summaryTruncated = true;
  }
  if (size(bounded) > maxBytes && bounded.results?.length === 1) {
    const result = bounded.results[0];
    bounded.results[0] = { id: result.id, status: result.status, timedOut: result.timedOut,
      durationMs: result.durationMs, outputHash: result.outputHash,
      output: result.status === 0 ? '' : sanitizarSalida(result.output, 1024).text };
    bounded.resultsOmitted = omitted;
    bounded.summaryTruncated = true;
  }
  if (size(bounded) > maxBytes) {
    const minimalFailure = first ? { id: first.id, status: first.status, timedOut: first.timedOut,
      outputHash: first.outputHash, output: sanitizarSalida(first.output, 512).text } : null;
    const reused = (bounded.results || []).filter((result) => result.execution === 'reused');
    const fallback = { schemaVersion: bounded.schemaVersion, runId: bounded.runId, ok: bounded.ok,
      status: bounded.status, speed: bounded.speed, summaryTruncated: true,
      results: [...(minimalFailure ? [minimalFailure] : []), ...reused],
      resultsOmitted: originalCount - reused.length - (minimalFailure ? 1 : 0) };
    if (size(fallback) <= maxBytes) return fallback;
    if (minimalFailure) minimalFailure.output = '';
    return fallback;
  }
  return bounded;
}
