#!/usr/bin/env node
/**
 * SubagentStart / SubagentStop — deja rastro verificable de qué subagente trabajó.
 *
 * El problema que resuelve: la narración del chat ("ahora el backend-expert
 * implementa el caso de uso…") demuestra lo que el modelo *dice*, no lo que
 * *ocurrió*. Un botón de handoff cambia de agente; no prueba que ejecutara nada.
 *
 * Este hook lo registra desde fuera del modelo, en un fichero append-only:
 *   docs/specs/NNN-slug/execution-log.jsonl   (si hay spec activa)
 *   .sdd/agent-audit.jsonl                    (si no, para no perder el evento)
 *
 * Uso: node .sdd/hooks/subagent-log.mjs start|stop
 */
import {
  readHookInput, projectRoot, logEjecucion, allow, valorExacto, entraAgente, saleAgente, hostDestino,
  marcarAutoria,
} from './_lib.mjs';

const evento = process.argv[2] === 'stop' ? 'stop' : 'start';
const input = await readHookInput();
const root = projectRoot(input);

// Coincidencia EXACTA de clave, nunca parcial: buscar `agent` de forma difusa captura
// `agentSessionId` y registra un hash donde debería ir el nombre del agente. Un registro
// que dice `a18ccba93b95e515c` en vez de `backend-expert` no sirve para nada.
const agente =
  valorExacto(input, [
    'agent_type', 'agentType',
    'subagent_type', 'subagentType',
    'agent_name', 'agentName',
    'subagent_name', 'subagentName',
    'agent',
  ]) || 'desconocido';

const sesion = input.session_id || 'default';

// El agente activo se mantiene en `.sdd/state/` porque PreToolUse no dice quién escribe.
// Sin este dato, `guard-write` no puede impedir que el especialista de datos toque el front:
// la guarda vería la ruta pero no sabría de quién es la mano.
if (evento === 'start') entraAgente(root, sesion, agente);
else saleAgente(root, sesion, agente === 'desconocido' ? null : agente);

try {
  const { destino, spec } = logEjecucion(root, {
    evento: `subagent-${evento}`,
    agente,
    sesion: String(sesion).slice(0, 8) || null,
    // `observed` = un hook del host vio el ciclo real del subagente, con su nombre.
    // Si el host no dio el nombre, lo honesto es `unverified`: hubo un subagente, pero no
    // se puede afirmar cuál. Registrar `observed` sin nombre es fabricar evidencia.
    verificacion: agente === 'desconocido' ? 'unverified' : 'observed',
    ...(agente === 'desconocido'
      ? { motivo: 'el host no expuso el nombre del subagente en el payload del hook' }
      : {}),
  });

  // Una línea por sesión, agente y spec. Al cerrar la tarea, esto responde «quién trabajó
  // aquí» sin obligar a nadie a reconstruirlo a partir de veinte pares start/stop.
  if (evento === 'start' && marcarAutoria(root, { sesion, agente, spec })) {
    logEjecucion(root, {
      evento: 'autoria',
      agente,
      sesion: String(sesion).slice(0, 8) || null,
      spec: spec ?? null,
      verificacion: 'observed',
    });
  }

  if (evento === 'stop') {
    const rel = destino.replace(/\\/g, '/').replace(root.replace(/\\/g, '/'), '.');
    const mensaje = `Bitácora: subagent-stop de \`${agente}\` registrado en ${rel}` +
      (spec ? ` (spec ${spec}).` : ' (sin spec activa).') +
      '\nAl cerrar la tarea en `tasks.md`, cita este agente y la evidencia real (ficheros, comandos, salida).';
    if (hostDestino() === 'codex') {
      process.stdout.write(`${JSON.stringify({ continue: true, systemMessage: mensaje })}\n`);
      process.exit(0);
    }
    process.stdout.write(`${mensaje}\n`);
  }
} catch {
  /* la trazabilidad nunca debe romper la sesión */
}

allow();
