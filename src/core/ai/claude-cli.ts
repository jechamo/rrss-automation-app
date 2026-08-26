import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { AiEngine, AiResult, AiTask, TestResult } from "./engine";

function runtimeEnvironmentPath(name: string): string | null {
  const value = Reflect.get(process.env, name);
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  return candidate && path.isAbsolute(candidate) ? candidate : null;
}

/**
 * Motor de IA basado en el binario de Claude Code CLI en modo headless.
 * Usa la sesion Pro logueada => sin coste de API (Arquitectura §4, D-02).
 */
export class ClaudeCliEngine implements AiEngine {
  id = "claude-cli" as const;

  private resolveBinary(): string | null {
    const fromEnv = process.env.CLAUDE_CLI_PATH?.trim();
    if (fromEnv && existsSync(fromEnv)) return fromEnv;

    const home =
      runtimeEnvironmentPath("USERPROFILE") ??
      runtimeEnvironmentPath("HOME");

    // Preferido: binario de la app de escritorio de Claude. Es el que tiene la
    // sesion Pro iniciada (login), asi funciona sin coste de API (D-02). Una copia
    // recien instalada por npm NO esta logueada ("Not logged in · run /login").
    if (home) {
      const managed = this.resolveManaged(home);
      if (managed) return managed;

      const candidates = [
        path.join(home, ".local", "bin", "claude.exe"),
        path.join(home, ".local", "bin", "claude"),
        path.join(home, "AppData", "Roaming", "npm", "claude.cmd"),
        path.join(home, "AppData", "Local", "Programs", "claude", "claude.exe"),
      ];
      for (const c of candidates) if (existsSync(c)) return c;
    }

    // Respaldo: binario instalado localmente en el proyecto (requiere `claude /login`
    // para tener sesion propia; ver AGENTS.md).
    const localBin = path.join(
      process.cwd(),
      "node_modules",
      "@anthropic-ai",
      "claude-code",
      "bin",
      process.platform === "win32" ? "claude.exe" : "claude",
    );
    if (existsSync(localBin)) return localBin;

    // Ultima opcion: confiar en el PATH.
    return "claude";
  }

  private resolveManaged(home: string): string | null {
    const base = path.join(home, "AppData", "Roaming", "Claude", "claude-code");
    if (!existsSync(base)) return null;
    try {
      const versions = readdirSync(base, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort(compareVersionsDesc);
      for (const v of versions) {
        const bin = path.join(base, v, "claude.exe");
        if (existsSync(bin)) return bin;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  private exec(
    args: string[],
    cwd?: string,
    input?: string,
    timeoutMs = 180_000,
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const bin = this.resolveBinary()!;
      // shell:true en Windows manda el comando por cmd.exe, que rompe argumentos
      // multilinea (p.ej. --append-system-prompt). Con un .exe real no hace falta:
      // spawn directo pasa cada arg intacto. Solo usamos shell para "claude"/.cmd/.bat.
      const useShell = process.platform === "win32" && !/\.exe$/i.test(bin);
      console.log("[claude-cli] exec:", bin, "| args:", args.map((a) => (a.length > 60 ? a.slice(0, 60) + "…" : a)));
      const child = spawn(bin, args, { cwd, shell: useShell });
      let stdout = "";
      let stderr = "";
      let settled = false;
      const done = (r: { code: number; stdout: string; stderr: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(r);
      };
      const timer = setTimeout(() => {
        child.kill();
        done({
          code: -1,
          stdout,
          stderr: stderr + `\nTiempo de espera agotado tras ${timeoutMs / 1000}s.`,
        });
      }, timeoutMs);
      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("error", (e) => done({ code: -1, stdout, stderr: stderr + String(e) }));
      child.on("close", (code) => done({ code: code ?? -1, stdout, stderr }));
      if (input) {
        child.stdin.write(input);
        child.stdin.end();
      }
    });
  }

  async test(): Promise<TestResult> {
    const bin = this.resolveBinary();
    const { code, stdout, stderr } = await this.exec(["--version"], undefined, undefined, 15_000);
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
    // Permite que el modelo auto-invoque los Skills de proyecto (.claude/skills, REQ-007) en
    // modo headless sin colgarse en el prompt de permisos. Se restringe a la tool "Skill"
    // (no FS/Bash/otras): el cwd del spawn es la raiz del proyecto, asi que se descubren solos.
    // Tareas concretas pueden ampliar (p. ej. WebSearch/WebFetch para REQ-003 leads).
    const tools = ["Skill", ...(task.allowedTools ?? [])];
    args.push("--allowedTools", tools.join(","));
    if (task.system) args.push("--append-system-prompt", task.system);
    // Modelo opcional. "default" (o vacio) => no pasar --model, deja que el CLI elija.
    if (task.model && task.model !== "default") args.push("--model", task.model);

    // El prompt se pasa por stdin para evitar limites de longitud de linea.
    const { code, stdout, stderr } = await this.exec(args, task.cwd, task.prompt, task.timeoutMs);
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

/** Ordena versiones semver descendente (ej. "2.1.128" antes que "2.1.9"). */
function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
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
