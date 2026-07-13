import type { AiEngine, AiEngineId } from "./engine";
import { ClaudeCliEngine } from "./claude-cli";
import { ClaudeAgentSdkEngine } from "./claude-agent-sdk";

export function getEngine(id?: AiEngineId): AiEngine {
  const selected = id ?? (process.env.AI_ENGINE as AiEngineId) ?? "claude-cli";
  switch (selected) {
    case "claude-agent-sdk":
      return new ClaudeAgentSdkEngine();
    case "claude-cli":
    default:
      return new ClaudeCliEngine();
  }
}

export type { AiEngine, AiEngineId, AiTask, AiResult, TestResult } from "./engine";
