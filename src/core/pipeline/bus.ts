import { EventEmitter } from "node:events";

/**
 * Bus de eventos en memoria para transmitir el progreso de un run a la UI (SSE).
 * Arquitectura §6.
 */
export type RunEvent =
  | { type: "node"; nodeId: string; state: NodeState; detail?: string }
  | { type: "run"; state: NodeState }
  | { type: "done"; ok: boolean }
  | { type: "log"; message: string };

export type NodeState = "pending" | "running" | "ok" | "error";

// IMPORTANTE: en dev, Next.js puede cargar los route handlers en modulos
// distintos (bundles separados por ruta). Un `Map` a nivel de modulo NO se
// comparte entre el route que publica (POST /projects -> executeRun) y el que
// se suscribe (GET /runs/[id]/stream) -> los eventos en vivo nunca llegan al
// SSE y la UI se queda "En curso...". Guardar el Map en globalThis lo convierte
// en un singleton real compartido por todos los bundles.
const globalForBus = globalThis as unknown as {
  __rrssBuses?: Map<string, EventEmitter>;
};
const buses: Map<string, EventEmitter> =
  globalForBus.__rrssBuses ?? (globalForBus.__rrssBuses = new Map());

function busFor(runId: string): EventEmitter {
  let b = buses.get(runId);
  if (!b) {
    b = new EventEmitter();
    b.setMaxListeners(50);
    buses.set(runId, b);
  }
  return b;
}

export function publish(runId: string, event: RunEvent) {
  busFor(runId).emit("event", event);
}

export function subscribe(runId: string, listener: (e: RunEvent) => void): () => void {
  const b = busFor(runId);
  b.on("event", listener);
  return () => b.off("event", listener);
}

export function closeBus(runId: string) {
  const b = buses.get(runId);
  if (b) b.removeAllListeners();
  buses.delete(runId);
}
