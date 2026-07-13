import fs from "node:fs";
import path from "node:path";
import type { AiEngineId } from "@/core/ai";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "settings.json");

export interface AppSettings {
  aiEngine: AiEngineId;
}

const DEFAULTS: AppSettings = { aiEngine: "claude-cli" };

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
