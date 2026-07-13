import type { AiEngine, AiResult, AiTask, TestResult } from "./engine";

/**
 * Motor basado en Claude Agent SDK (Arquitectura §4).
 * Placeholder seleccionable: se cablea con el SDK real mas adelante.
 * De momento el motor por defecto y recomendado es Claude CLI.
 */
export class ClaudeAgentSdkEngine implements AiEngine {
  id = "claude-agent-sdk" as const;

  async test(): Promise<TestResult> {
    return {
      ok: false,
      detail:
        "Motor Agent SDK aun no cableado. Usa 'Claude CLI' por ahora (Ajustes > Motor de IA).",
    };
  }

  async run(_task: AiTask): Promise<AiResult> {
    void _task;
    throw new Error("Agent SDK no implementado todavia. Selecciona 'Claude CLI'.");
  }
}
