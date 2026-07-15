// Abstraccion del motor de IA (Arquitectura §4).
// Dos implementaciones seleccionables: Claude Code CLI y Claude Agent SDK.

export type AiEngineId = "claude-cli" | "claude-agent-sdk";

export interface AiTask {
  system?: string;
  prompt: string;
  /** Directorio de trabajo (p. ej. repo a analizar). */
  cwd?: string;
  /** Pide salida JSON parseable. */
  json?: boolean;
  /** Alias de modelo (sonnet/opus/haiku). Si se omite, el motor usa su default. */
  model?: string;
  /**
   * Tools que el modelo puede auto-invocar en modo headless (ademas de "Skill",
   * que siempre se permite). P. ej. ["WebSearch", "WebFetch"] para REQ-003.
   */
  allowedTools?: string[];
  /** Timeout en ms para esta tarea (por defecto el del motor). Web search es lento. */
  timeoutMs?: number;
}

export interface AiResult {
  text: string;
  /** Presente si la tarea pidio json y se pudo parsear. */
  data?: unknown;
  raw?: string;
}

export interface TestResult {
  ok: boolean;
  detail: string;
}

export interface AiEngine {
  id: AiEngineId;
  /** Comprobacion para el boton "probar conexion" en Ajustes. */
  test(): Promise<TestResult>;
  run(task: AiTask): Promise<AiResult>;
}
