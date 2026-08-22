import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SAFE_NEXT_STEP = {
  "binary-missing":
    "La herramienta de IA no está disponible en este equipo. Puedes continuar; los análisis que dependan de ella quedarán limitados. Instálala localmente y ejecuta /login cuando quieras habilitarla.",
  "login-required":
    "Abre la aplicación Claude en este equipo y ejecuta /login. Luego vuelve a comprobar. El uso local básico puede continuar sin esa sesión.",
  ok: "Sesión local de Claude comprobada. El uso local básico no dependía de ella.",
  unknown:
    "No se pudo comprobar la sesión de Claude. Puedes continuar; los análisis con IA pueden quedar limitados.",
};

/**
 * @param {{
 *   exists?: (filePath: string) => boolean,
 *   env?: NodeJS.ProcessEnv,
 *   home?: string,
 *   platform?: NodeJS.Platform,
 *   projectRoot?: string,
 *   listDirectories?: (directoryPath: string) => string[],
 * }} [options]
 */
export function pickClaudeBinary({
  exists = existsSync,
  env = process.env,
  home = os.homedir(),
  platform = process.platform,
  projectRoot = process.cwd(),
  listDirectories = listDirectoryNames,
} = {}) {
  const override = String(env.CLAUDE_CLI_PATH ?? "").trim();
  if (override && exists(override)) {
    return { found: true, source: "configured", command: override };
  }

  if (platform === "win32") {
    const managedBase = path.join(home, "AppData", "Roaming", "Claude", "claude-code");
    const versions = [...listDirectories(managedBase)].sort(compareVersionsDesc);
    for (const version of versions) {
      const candidate = path.join(managedBase, version, "claude.exe");
      if (exists(candidate)) {
        return { found: true, source: "managed", command: candidate };
      }
    }
  }

  const localName = platform === "win32" ? "claude.exe" : "claude";
  const localBin = path.join(
    projectRoot,
    "node_modules",
    "@anthropic-ai",
    "claude-code",
    "bin",
    localName,
  );
  if (exists(localBin)) {
    return { found: true, source: "local", command: localBin };
  }

  return { found: false, source: "missing" };
}

/**
 * @param {{code?: number, stdout?: string, stderr?: string}} output
 */
export function interpretClaudeSessionOutput(output = {}) {
  const text = `${output.stdout ?? ""} ${output.stderr ?? ""}`;
  if (/not logged in|run \/login/i.test(text)) {
    return publicReport("login-required");
  }
  if ((output.code ?? 1) === 0) {
    return publicReport("ok");
  }
  if (/enoent|not found|no se reconoce|cannot find/i.test(text)) {
    return publicReport("binary-missing");
  }
  return publicReport("unknown");
}

/**
 * @param {{
 *   exists?: (filePath: string) => boolean,
 *   env?: NodeJS.ProcessEnv,
 *   home?: string,
 *   platform?: NodeJS.Platform,
 *   projectRoot?: string,
 *   listDirectories?: (directoryPath: string) => string[],
 *   runCommand?: (command: string, args: string[]) => {code: number, stdout: string, stderr: string},
 * }} [options]
 */
export function inspectClaudeSession(options = {}) {
  const picked = pickClaudeBinary(options);
  if (!picked.found) {
    return { ...publicReport("binary-missing"), source: "missing" };
  }

  const runCommand = options.runCommand ?? runClaudeCommand;
  const version = runCommand(picked.command, ["--version"]);
  if ((version.code ?? 1) !== 0 && /enoent|not found|no se reconoce|cannot find/i.test(`${version.stdout} ${version.stderr}`)) {
    return { ...publicReport("binary-missing"), source: picked.source };
  }

  const auth = runCommand(picked.command, ["auth", "status"]);
  return { ...interpretClaudeSessionOutput(auth), source: picked.source };
}

function publicReport(status) {
  return {
    status,
    blocksBasicUse: false,
    nextStep: SAFE_NEXT_STEP[status],
  };
}

function runClaudeCommand(command, args) {
  const useShell = process.platform === "win32" && !/\.exe$/i.test(command);
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: useShell,
    timeout: 15_000,
    windowsHide: true,
  });
  return {
    code: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? String(result.error ?? ""),
  };
}

function listDirectoryNames(directoryPath) {
  try {
    return readdirSync(directoryPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function compareVersionsDesc(left, right) {
  const a = String(left).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const b = String(right).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const size = Math.max(a.length, b.length);
  for (let index = 0; index < size; index += 1) {
    const delta = (b[index] ?? 0) - (a[index] ?? 0);
    if (delta) return delta;
  }
  return 0;
}
