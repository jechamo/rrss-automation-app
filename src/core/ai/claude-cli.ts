import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { AiEngine, AiResult, AiTask, TestResult } from "./engine";

/**
 * Motor de IA basado en el binario de Claude Code CLI en modo headless.
 * Usa la sesion Pro logueada => sin coste de API (Arquitectura §4, D-02).
 */
export class ClaudeCliEngine implements AiEngine {
  id = "claude-cli" as const;

  private resolveBinary(): string | null {
    const fromEnv = process.env.CLAUDE_CLI_PATH?.trim();
    if (fromEnv && existsSync(fromEnv)) return fromEnv;

    const home = os.homedir();
    const candidates = [
      path.join(home, ".local", "bin", "claude.exe"),
      path.join(home, ".local", "bin", "claude"),
      path.join(home, "AppData", "Roaming", "npm", "claude.cmd"),
      path.join(home, "AppData", "Local", "Programs", "claude", "claude.exe"),
    ];
    for (const c of candidates) if (existsSync(c)) return c;

    // Ultima opcion: confiar en el PATH.
    return "claude";
  }

  private exec(args: string[], cwd?: string, input?: string): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const bin = this.resolveBinary()!;
      const child = spawn(bin, args, { cwd, shell: process.platform === "win32" });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("error", (e) => resolve({ code: -1, stdout, stderr: stderr + String(e) }));
      child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
      if (input) {
        child.stdin.write(input);
        child.stdin.end();
      }
    });
  }

  async test(): Promise<TestResult> {
    const bin = this.resolveBinary();
    const { code, stdout, stderr } = await this.exec(["--version"]);
    if (code === 0) {
      return { ok: true, detail: `Claude CLI OK (${stdout.trim() || bin})` };
    }
    return {
      ok: false,
      detail:
        `No se pudo ejecutar 'claude'. Revisa la ruta en Ajustes (CLAUDE_CLI_PATH). ` +
        (stderr.trim() || `binario probado: ${bin}`),
    };
  }

  async run(task: AiTask): Promise<AiResult> {
    const args = ["-p", "--output-format", "json"];
    if (task.system) args.push("--append-system-prompt", task.system);

    // El prompt se pasa por stdin para evitar limites de longitud de linea.
    const { code, stdout, stderr } = await this.exec(args, task.cwd, task.prompt);
    if (code !== 0) {
      throw new Error(`Claude CLI fallo (code ${code}): ${stderr.trim() || stdout.trim()}`);
    }

    // --output-format json => objeto con campo "result".
    let text = stdout.trim();
    try {
      const parsed = JSON.parse(stdout);
      if (typeof parsed?.result === "string") text = parsed.result;
    } catch {
      /* si no es JSON, usamos stdout tal cual */
    }

    const result: AiResult = { text, raw: stdout };
    if (task.json) result.data = extractJson(text);
    return result;
  }
}

/** Intenta extraer un bloque JSON de una respuesta de texto. */
export function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  const startArr = candidate.indexOf("[");
  const from = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  if (from === -1) return undefined;
  const slice = candidate.slice(from);
  try {
    return JSON.parse(slice);
  } catch {
    return undefined;
  }
}
