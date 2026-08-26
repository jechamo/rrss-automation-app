import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { executableCandidatesFromPath } from "./path-candidates";

export type SystemToolName = "ffmpeg" | "ffprobe" | "yt-dlp";

export interface SystemToolStatus {
  name: SystemToolName;
  label: string;
  found: boolean;
  path: string;
  version: string;
  source: "env" | "path" | "winget" | "missing";
  installHint: string;
}

type ToolSpec = {
  label: string;
  env: string;
  versionArgs: string[];
  wingetPackages: string[];
  installHint: string;
};

const SPECS: Record<SystemToolName, ToolSpec> = {
  ffmpeg: {
    label: "FFmpeg",
    env: "FFMPEG_PATH",
    versionArgs: ["-version"],
    wingetPackages: ["gyan.ffmpeg", "yt-dlp.ffmpeg", "ffmpeg"],
    installHint: "winget install Gyan.FFmpeg",
  },
  ffprobe: {
    label: "ffprobe",
    env: "FFPROBE_PATH",
    versionArgs: ["-version"],
    wingetPackages: ["gyan.ffmpeg", "yt-dlp.ffmpeg", "ffmpeg"],
    installHint: "winget install Gyan.FFmpeg",
  },
  "yt-dlp": {
    label: "yt-dlp",
    env: "YTDLP_PATH",
    versionArgs: ["--version"],
    wingetPackages: ["yt-dlp.yt-dlp", "yt-dlp"],
    installHint: "winget install yt-dlp.yt-dlp",
  },
};

const cache = new Map<SystemToolName, SystemToolStatus>();

function executableNames(name: SystemToolName): string[] {
  return process.platform === "win32" ? [`${name}.exe`, name] : [name];
}

function probe(name: SystemToolName, candidate: string): { ok: boolean; version: string } {
  try {
    const result = spawnSync(candidate, SPECS[name].versionArgs, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    });
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    return {
      ok: result.status === 0,
      version: output.split(/\r?\n/).find(Boolean)?.trim() ?? "",
    };
  } catch {
    return { ok: false, version: "" };
  }
}

function candidateFromPath(
  name: SystemToolName,
  pathValue = process.env.PATH ?? "",
  probeCandidate: typeof probe = probe,
): string | null {
  for (const candidate of executableCandidatesFromPath(
    pathValue,
    executableNames(name),
  )) {
    // No usar existsSync/statSync aquí: el trazador de Next convierte rutas
    // dinámicas de PATH en globs y puede intentar recorrer entradas que son
    // ejecutables, no directorios. spawnSync falla de forma segura sin shell.
    if (probeCandidate(name, candidate).ok) return candidate;
  }
  // Conserva compatibilidad con aliases/launchers que el sistema pueda resolver.
  return probeCandidate(name, name).ok ? name : null;
}

function findRecursive(root: string, wanted: Set<string>, depth = 0): string | null {
  if (depth > 6 || !fs.existsSync(root)) return null;
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && wanted.has(entry.name.toLowerCase())) return path.join(root, entry.name);
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const found = findRecursive(path.join(root, entry.name), wanted, depth + 1);
      if (found) return found;
    }
  } catch {
    // WinGet puede contener directorios no accesibles; se ignoran y se sigue degradando.
  }
  return null;
}

function candidateFromWinGet(name: SystemToolName): string | null {
  if (process.platform !== "win32") return null;
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  const wanted = new Set(executableNames(name).map((value) => value.toLowerCase()));
  const links = path.join(localAppData, "Microsoft", "WinGet", "Links");
  for (const file of executableNames(name)) {
    const candidate = path.join(links, file);
    if (fs.existsSync(candidate)) return candidate;
  }

  const packages = path.join(localAppData, "Microsoft", "WinGet", "Packages");
  if (!fs.existsSync(packages)) return null;
  try {
    const allowed = SPECS[name].wingetPackages;
    const dirs = fs
      .readdirSync(packages, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && allowed.some((part) => entry.name.toLowerCase().includes(part)))
      .map((entry) => path.join(packages, entry.name));
    for (const dir of dirs) {
      const found = findRecursive(dir, wanted);
      if (found) return found;
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveSystemTool(name: SystemToolName, refresh = false): SystemToolStatus {
  if (refresh) cache.delete(name);
  const saved = cache.get(name);
  if (saved) return saved;

  const spec = SPECS[name];
  const fromEnv = process.env[spec.env]?.trim();
  const candidates: Array<{ path: string; source: SystemToolStatus["source"] }> = [];
  if (fromEnv) candidates.push({ path: fromEnv, source: "env" });
  const fromPath = candidateFromPath(name);
  if (fromPath) candidates.push({ path: fromPath, source: "path" });
  const fromWinGet = candidateFromWinGet(name);
  if (fromWinGet) candidates.push({ path: fromWinGet, source: "winget" });

  for (const candidate of candidates) {
    const checked = probe(name, candidate.path);
    if (!checked.ok) continue;
    const status: SystemToolStatus = {
      name,
      label: spec.label,
      found: true,
      path: candidate.path,
      version: checked.version,
      source: candidate.source,
      installHint: spec.installHint,
    };
    cache.set(name, status);
    return status;
  }

  const missing: SystemToolStatus = {
    name,
    label: spec.label,
    found: false,
    path: "",
    version: "",
    source: "missing",
    installHint: spec.installHint,
  };
  cache.set(name, missing);
  return missing;
}

export function systemToolPath(name: SystemToolName): string | null {
  const status = resolveSystemTool(name);
  return status.found ? status.path : null;
}

export function listSystemTools(refresh = false): SystemToolStatus[] {
  return (["ffmpeg", "ffprobe", "yt-dlp"] as const).map((name) => resolveSystemTool(name, refresh));
}
