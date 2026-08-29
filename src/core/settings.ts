import fs from "node:fs";
import path from "node:path";
import type { AiEngineId } from "@/core/ai";
import { getDataDir } from "./runtime/e2e-profile";

const DATA_DIR = getDataDir();
const FILE = path.join(DATA_DIR, "settings.json");

/**
 * Modelo de Claude a usar. "default" deja que el CLI elija (no pasa --model);
 * el resto son alias que el CLI de Claude Code acepta directamente.
 */
export type AiModel = "default" | "sonnet" | "opus" | "haiku";

export const AI_MODELS: { id: AiModel; label: string; hint: string }[] = [
  { id: "default", label: "Automatico", hint: "Deja que Claude elija (recomendado)" },
  { id: "sonnet", label: "Sonnet", hint: "Equilibrio calidad/velocidad" },
  { id: "opus", label: "Opus", hint: "Maxima calidad, mas lento" },
  { id: "haiku", label: "Haiku", hint: "Rapido y economico" },
];

export interface AppSettings {
  aiEngine: AiEngineId;
  aiModel: AiModel;
}

const DEFAULTS: AppSettings = { aiEngine: "claude-cli", aiModel: "default" };

export function getSettings(): AppSettings {
  try {
    if (!fs.existsSync(FILE)) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const next = { ...getSettings(), ...patch };
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return next;
}
