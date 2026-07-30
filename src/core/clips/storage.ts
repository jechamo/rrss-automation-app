import fs from "node:fs";
import path from "node:path";
import type {
  ClipJob,
  ClipJsonTimingMode,
  ClipSelectionMode,
  ClipSourceType,
  ImportedClipPlan,
} from "./contracts";

const CLIPS_DIR = path.join(process.cwd(), "data", "clips");

export function clipJobDir(id: string): string {
  const safeId = safeJobId(id);
  const dir = path.join(CLIPS_DIR, safeId);
  if (!dir.startsWith(CLIPS_DIR + path.sep)) throw new Error("ID de trabajo inválido.");
  return dir;
}

export function createClipJob(input: {
  sourceType: ClipSourceType;
  title?: string;
  sourceUrl?: string;
  sourceName: string;
  selectionMode?: ClipSelectionMode;
  jsonTiming?: ClipJsonTimingMode;
  importedPlan?: ImportedClipPlan;
}): ClipJob {
  const id = `clip-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const job: ClipJob = {
    id,
    title: input.title?.trim().slice(0, 140) || input.sourceName,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    sourceName: input.sourceName,
    selectionMode: input.selectionMode ?? "ai",
    jsonTiming: input.jsonTiming,
    importedPlan: input.importedPlan,
    status: "pending",
    stage: "source",
    progress: 2,
    logs: ["Trabajo creado. Validando la fuente…"],
    createdAt: now,
    updatedAt: now,
  };
  fs.mkdirSync(clipJobDir(id), { recursive: true });
  writeClipJob(job);
  return job;
}

export function saveClipSource(id: string, name: string, bytes: Buffer): string {
  const extension = path.extname(name).toLowerCase() || ".mp4";
  const fileName = `source${extension.replace(/[^a-z0-9.]/g, "")}`;
  fs.writeFileSync(path.join(clipJobDir(id), fileName), bytes);
  updateClipJob(id, { sourceFile: fileName });
  return fileName;
}

export function adoptClipSource(id: string, absPath: string): string {
  const extension = path.extname(absPath).toLowerCase() || ".mp4";
  const fileName = `source${extension.replace(/[^a-z0-9.]/g, "")}`;
  fs.copyFileSync(absPath, path.join(clipJobDir(id), fileName));
  updateClipJob(id, { sourceFile: fileName });
  return fileName;
}

export function readClipJob(id: string): ClipJob {
  const manifest = path.join(clipJobDir(id), "manifest.json");
  if (!fs.existsSync(manifest)) throw new Error("Análisis de clips no encontrado.");
  return JSON.parse(fs.readFileSync(manifest, "utf8")) as ClipJob;
}

export function listClipJobs(): ClipJob[] {
  if (!fs.existsSync(CLIPS_DIR)) return [];
  return fs.readdirSync(CLIPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry): ClipJob[] => {
      try {
        return [readClipJob(entry.name)];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateClipJob(id: string, patch: Partial<ClipJob>): ClipJob {
  const current = readClipJob(id);
  const next: ClipJob = {
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };
  writeClipJob(next);
  return next;
}

export function appendClipLog(id: string, message: string): ClipJob {
  const current = readClipJob(id);
  return updateClipJob(id, { logs: [...current.logs, message].slice(-120) });
}

export function clipAssetPath(id: string, name: string): string {
  const safeName = path.basename(name);
  if (!safeName || safeName !== name || safeName === "manifest.json") {
    throw new Error("Nombre de recurso inválido.");
  }
  const file = path.join(clipJobDir(id), safeName);
  if (!file.startsWith(clipJobDir(id) + path.sep)) throw new Error("Ruta de recurso inválida.");
  return file;
}

export function deleteClipJob(id: string): void {
  const dir = clipJobDir(id);
  if (!fs.existsSync(path.join(dir, "manifest.json"))) {
    throw new Error("Análisis de clips no encontrado.");
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeClipJob(job: ClipJob): void {
  const dir = clipJobDir(job.id);
  fs.mkdirSync(dir, { recursive: true });
  const manifest = path.join(dir, "manifest.json");
  const temporary = path.join(dir, `manifest-${process.pid}.tmp`);
  fs.writeFileSync(temporary, JSON.stringify(job, null, 2), "utf8");
  fs.renameSync(temporary, manifest);
}

function safeJobId(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe || safe !== id) throw new Error("ID de trabajo inválido.");
  return safe;
}
