import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { getSecret } from "@/core/secrets/vault";

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out", "coverage",
  ".turbo", ".cache", "vendor", "__pycache__", ".venv", "target",
]);

const KEY_FILES = ["package.json", "README.md", "readme.md", "requirements.txt", "composer.json", "pom.xml", "go.mod"];

export interface RepoSummary {
  source: string;
  tree: string;
  keyFiles: { path: string; content: string }[];
}

function walk(dir: string, base: string, depth: number, acc: string[], maxEntries = 200) {
  if (depth > 3 || acc.length >= maxEntries) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (acc.length >= maxEntries) return;
    if (e.name.startsWith(".") && e.name !== ".env.example") continue;
    if (e.isDirectory() && IGNORE_DIRS.has(e.name)) continue;
    const rel = path.relative(base, path.join(dir, e.name));
    acc.push((e.isDirectory() ? "[dir] " : "      ") + rel.replace(/\\/g, "/"));
    if (e.isDirectory()) walk(path.join(dir, e.name), base, depth + 1, acc, maxEntries);
  }
}

function readKeyFiles(root: string): { path: string; content: string }[] {
  const out: { path: string; content: string }[] = [];
  for (const f of KEY_FILES) {
    const p = path.join(root, f);
    if (fs.existsSync(p)) {
      try {
        out.push({ path: f, content: fs.readFileSync(p, "utf8").slice(0, 4000) });
      } catch {
        /* ignore */
      }
    }
  }
  return out;
}

function summarizeDir(root: string, source: string): RepoSummary {
  const acc: string[] = [];
  walk(root, root, 0, acc);
  return { source, tree: acc.join("\n"), keyFiles: readKeyFiles(root) };
}

function gitClone(repoUrl: string, token?: string): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rrss-repo-"));
  let url = repoUrl;
  if (token) {
    // Inserta el token para repos privados.
    url = repoUrl.replace(/^https:\/\//, `https://${token}@`);
  }
  const res = spawnSync("git", ["clone", "--depth", "1", url, tmp], {
    encoding: "utf8",
    timeout: 120000,
  });
  if (res.status !== 0) {
    throw new Error(`git clone fallo: ${(res.stderr || "").split("\n")[0] || "error desconocido"}`);
  }
  return tmp;
}

export async function analyzeRepo(codeType: string | null, codePath: string | null): Promise<RepoSummary | null> {
  if (!codeType || codeType === "none" || !codePath) return null;

  if (codeType === "local") {
    if (!fs.existsSync(codePath)) throw new Error(`La ruta local no existe: ${codePath}`);
    return summarizeDir(codePath, `local:${codePath}`);
  }

  if (codeType === "github_public" || codeType === "github_private") {
    const token = codeType === "github_private" ? getSecret("github") ?? undefined : undefined;
    if (codeType === "github_private" && !token) {
      throw new Error("Repo privado pero falta el token de GitHub (configuralo en Ajustes).");
    }
    const dir = gitClone(codePath, token);
    try {
      return summarizeDir(dir, `github:${codePath}`);
    } finally {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* limpieza best-effort */
      }
    }
  }

  return null;
}
