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
const FOCUS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte", ".html", ".md"]);

export interface RepoSummary {
  source: string;
  tree: string;
  keyFiles: { path: string; content: string }[];
  navigationFiles: { path: string; content: string }[];
}

const NAVIGATION_PATTERN =
  /(?:bottom.?nav|navbar|side.?bar|drawer|hamburger|breadcrumb|tab(?:s|list|trigger)?|navigation|menu|<Route\b|createBrowserRouter|router\.(?:push|replace)|navigate\s*\(|(?:href|to|path)\s*=|useRoutes|redirect)/i;
const NAVIGATION_NAME =
  /(?:app|routes?|router|layout|navigation|nav|menu|sidebar|drawer|tabs?|breadcrumb)/i;

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

function focusTokens(focus: string): string[] {
  return [...new Set(
    focus
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4),
  )].slice(0, 40);
}

function readFocusedFiles(root: string, focus: string): { path: string; content: string }[] {
  const tokens = focusTokens(focus);
  if (tokens.length === 0) return [];
  const matches: Array<{ path: string; score: number; content: string }> = [];
  const visit = (dir: string) => {
    if (matches.length >= 160) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || IGNORE_DIRS.has(entry.name)) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!FOCUS_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      let content = "";
      try {
        if (fs.statSync(absolute).size > 500_000) continue;
        content = fs.readFileSync(absolute, "utf8");
      } catch {
        continue;
      }
      const normalized = content
        .toLocaleLowerCase("es")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const score = tokens.reduce((total, token) => total + (normalized.includes(token) ? 1 : 0), 0);
      if (score > 0) matches.push({ path: absolute, score, content });
    }
  };
  visit(root);

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((match) => {
      const lines = match.content.split(/\r?\n/);
      const selected = new Set<number>();
      for (let index = 0; index < lines.length && selected.size < 36; index++) {
        const normalized = lines[index]
          .toLocaleLowerCase("es")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        if (!tokens.some((token) => normalized.includes(token))) continue;
        for (let nearby = Math.max(0, index - 2); nearby <= Math.min(lines.length - 1, index + 2); nearby++) {
          selected.add(nearby);
        }
      }
      const content = [...selected]
        .sort((a, b) => a - b)
        .map((index) => `${index + 1}: ${lines[index]}`)
        .join("\n")
        .slice(0, 3500);
      return { path: path.relative(root, match.path).replace(/\\/g, "/"), content };
    });
}

function readNavigationFiles(root: string): { path: string; content: string }[] {
  const matches: Array<{ path: string; score: number; content: string }> = [];
  const visit = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || IGNORE_DIRS.has(entry.name)) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!FOCUS_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      let content = "";
      try {
        if (fs.statSync(absolute).size > 750_000) continue;
        content = fs.readFileSync(absolute, "utf8");
      } catch {
        continue;
      }
      const patternHits = content
        .split(/\r?\n/)
        .reduce((total, line) => total + (NAVIGATION_PATTERN.test(line) ? 1 : 0), 0);
      const nameBonus = NAVIGATION_NAME.test(entry.name) ? 8 : 0;
      const score = Math.min(30, patternHits) + nameBonus;
      if (score >= 4) matches.push({ path: absolute, score, content });
    }
  };
  visit(root);

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 24)
    .map((match) => {
      const lines = match.content.split(/\r?\n/);
      const selected = new Set<number>();
      const stronglyNamed = NAVIGATION_NAME.test(path.basename(match.path));
      for (let index = 0; index < lines.length && selected.size < 140; index++) {
        if (!NAVIGATION_PATTERN.test(lines[index]) && !(stronglyNamed && index < 80)) continue;
        for (let nearby = Math.max(0, index - 2); nearby <= Math.min(lines.length - 1, index + 2); nearby++) {
          selected.add(nearby);
        }
      }
      return {
        path: path.relative(root, match.path).replace(/\\/g, "/"),
        content: [...selected]
          .sort((a, b) => a - b)
          .map((index) => `${index + 1}: ${lines[index]}`)
          .join("\n")
          .slice(0, 12_000),
      };
    });
}

function summarizeDir(root: string, source: string, focus = ""): RepoSummary {
  const acc: string[] = [];
  walk(root, root, 0, acc);
  const keyFiles = readKeyFiles(root);
  const known = new Set(keyFiles.map((file) => file.path.toLowerCase()));
  for (const file of readFocusedFiles(root, focus)) {
    if (!known.has(file.path.toLowerCase())) keyFiles.push(file);
  }
  return {
    source,
    tree: acc.join("\n"),
    keyFiles,
    navigationFiles: readNavigationFiles(root),
  };
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

export async function analyzeRepo(
  codeType: string | null,
  codePath: string | null,
  focus = "",
): Promise<RepoSummary | null> {
  if (!codeType || codeType === "none" || !codePath) return null;

  if (codeType === "local") {
    if (!fs.existsSync(codePath)) throw new Error(`La ruta local no existe: ${codePath}`);
    return summarizeDir(codePath, `local:${codePath}`, focus);
  }

  if (codeType === "github_public" || codeType === "github_private") {
    const token = codeType === "github_private" ? getSecret("github") ?? undefined : undefined;
    if (codeType === "github_private" && !token) {
      throw new Error("Repo privado pero falta el token de GitHub (configuralo en Ajustes).");
    }
    const dir = gitClone(codePath, token);
    try {
      return summarizeDir(dir, `github:${codePath}`, focus);
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
