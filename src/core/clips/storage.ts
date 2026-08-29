import fs from "node:fs";
import path from "node:path";
import type {
  ClipJob,
  ClipJsonTimingMode,
  ClipSelectionMode,
  ClipSourceType,
  ImportedClipPlan,
} from "./contracts";
import { getDataDir } from "../runtime/e2e-profile";

const CLIPS_DIR = path.join(getDataDir(), "clips");

export interface ClipCleanupSummary {
  jobs: number;
  files: number;
  bytes: number;
}

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

export function reuseClipSource(sourceId: string, targetId: string, sourceName: string): string {
  const source = clipAssetPath(sourceId, sourceName);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error("La fuente original ya no está disponible.");
  }
  const extension = path.extname(sourceName).toLowerCase() || ".mp4";
  const fileName = `source${extension.replace(/[^a-z0-9.]/g, "")}`;
  const target = path.join(clipJobDir(targetId), fileName);
  try {
    fs.linkSync(source, target);
  } catch {
    fs.copyFileSync(source, target);
  }
  updateClipJob(targetId, { sourceFile: fileName });
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

export function deleteAllClipOutputs(): ClipCleanupSummary {
  const summary: ClipCleanupSummary = { jobs: 0, files: 0, bytes: 0 };
  const deletedAt = new Date().toISOString();
  for (const job of listClipJobs()) {
    if (!job.selection) continue;
    const generatedNames = new Set<string>();
    for (const moment of job.selection.moments) {
      if (moment.outputName) generatedNames.add(moment.outputName);
      if (moment.thumbnailName) generatedNames.add(moment.thumbnailName);
      const safeMomentId = moment.id.replace(/[^a-zA-Z0-9_-]/g, "-");
      generatedNames.add(`clip-${safeMomentId}.mp4`);
      generatedNames.add(`clip-${safeMomentId}.jpg`);
      generatedNames.add(`subs-${safeMomentId}.ass`);
      generatedNames.add(`audio-${safeMomentId}.wav`);
    }
    for (const name of fs.readdirSync(clipJobDir(job.id))) {
      if (/^whisper-\d+-[a-zA-Z0-9_-]+\.json$/i.test(name)) {
        generatedNames.add(name);
      }
      if (
        /^render-.+\.(?:mp4|jpg)$/i.test(name)
        || /^gemini-.+\.mp4$/i.test(name)
        || /\.bak$/i.test(name)
      ) {
        generatedNames.add(name);
      }
    }

    let deletedForJob = 0;
    for (const name of generatedNames) {
      const file = clipAssetPath(job.id, name);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
      summary.bytes += fs.statSync(file).size;
      fs.rmSync(file, { force: true });
      summary.files += 1;
      deletedForJob += 1;
    }
    if (deletedForJob === 0) continue;

    summary.jobs += 1;
    updateClipJob(job.id, {
      outputsDeletedAt: deletedAt,
      selection: {
        ...job.selection,
        moments: job.selection.moments.map((moment) => ({
          ...moment,
          outputName: undefined,
          thumbnailName: undefined,
          renderError: undefined,
        })),
      },
      logs: [
        ...job.logs,
        "Los vídeos procesados, miniaturas y subtítulos renderizados se eliminaron. La fuente y el análisis se conservan.",
      ].slice(-120),
    });
  }
  return summary;
}

export function deleteAllClipJobs(): ClipCleanupSummary {
  const summary: ClipCleanupSummary = { jobs: 0, files: 0, bytes: 0 };
  for (const job of listClipJobs()) {
    const dir = clipJobDir(job.id);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const file = path.join(dir, entry.name);
      summary.files += 1;
      summary.bytes += fs.statSync(file).size;
    }
    deleteClipJob(job.id);
    summary.jobs += 1;
  }
  return summary;
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
