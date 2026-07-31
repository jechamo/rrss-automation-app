import { NextRequest, NextResponse } from "next/server";
import {
  clipToolsStatus,
  isClipProcessing,
  recoverInterruptedClipJob,
  startClipProcessing,
} from "@/core/clips/processor";
import {
  createClipJob,
  deleteAllClipJobs,
  deleteAllClipOutputs,
  deleteClipJob,
  listClipJobs,
  readClipJob,
  saveClipSource,
} from "@/core/clips/storage";
import {
  parseImportedClipPlan,
  type ClipJob,
  type ImportedClipPlan,
} from "@/core/clips/contracts";

export const dynamic = "force-dynamic";
const MAX_BYTES = 500 * 1024 * 1024;
const ALLOWED = new Set([".mp4", ".mov", ".webm", ".m4v"]);

export async function GET() {
  const jobs = listClipJobs().map(recoverInterruptedClipJob);
  return NextResponse.json({
    jobs,
    tools: clipToolsStatus("youtube"),
  });
}

export async function DELETE(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope");
  if (scope !== "outputs" && scope !== "history") {
    return NextResponse.json({ error: "Alcance de limpieza no válido." }, { status: 400 });
  }
  const jobs = listClipJobs();
  if (jobs.some((job) => isClipProcessing(job.id))) {
    return NextResponse.json(
      { error: "Hay un vídeo procesándose. Espera a que termine antes de limpiar el laboratorio." },
      { status: 409 },
    );
  }
  try {
    const summary = scope === "outputs"
      ? deleteAllClipOutputs()
      : deleteAllClipJobs();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo completar la limpieza." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Formulario inválido." }, { status: 400 });
  const sourceType = form.get("sourceType") === "youtube" ? "youtube" : "upload";
  const selectionMode = form.get("selectionMode") === "json" ? "json" : "ai";
  const jsonTiming = form.get("jsonTiming") === "gemini" ? "gemini" : "direct";
  const title = String(form.get("title") ?? "").trim().slice(0, 140);
  let importedPlan: ImportedClipPlan | undefined;
  if (selectionMode === "json") {
    const rawJson = String(form.get("selectionJson") ?? "").trim();
    if (!rawJson) {
      return NextResponse.json({ error: "Pega el JSON editorial o selecciona un fichero JSON." }, { status: 400 });
    }
    try {
      importedPlan = parseImportedClipPlan(JSON.parse(rawJson));
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "El JSON editorial no es válido." },
        { status: 400 },
      );
    }
  }
  const tools = clipToolsStatus(sourceType);
  const needsGemini = selectionMode === "ai" || jsonTiming === "gemini";
  const missing = [
    needsGemini && !tools.gemini ? "Gemini en Ajustes" : "",
    !tools.ffmpeg ? "FFmpeg" : "",
    !tools.ffprobe ? "ffprobe" : "",
    !tools.ytdlp ? "yt-dlp" : "",
    !tools.whisper ? "Whisper local" : "",
  ].filter(Boolean);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Faltan herramientas obligatorias: ${missing.join(", ")}.`, tools },
      { status: 409 },
    );
  }

  let job: ClipJob | undefined;
  try {
    if (sourceType === "youtube") {
      const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
      if (!isYouTubeUrl(sourceUrl)) {
        return NextResponse.json({ error: "Introduce una URL pública válida de YouTube." }, { status: 400 });
      }
      job = createClipJob({
        sourceType,
        sourceUrl,
        sourceName: "Vídeo de YouTube",
        title,
        selectionMode,
        jsonTiming: selectionMode === "json" ? jsonTiming : undefined,
        importedPlan,
      });
    } else {
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Selecciona un vídeo local." }, { status: 400 });
      }
      const extension = extensionOf(file.name);
      if (!ALLOWED.has(extension)) {
        return NextResponse.json({ error: "Formato no soportado: MP4, MOV, WebM o M4V." }, { status: 400 });
      }
      if (file.size <= 0 || file.size > MAX_BYTES) {
        return NextResponse.json({ error: "El vídeo debe ocupar entre 1 byte y 500 MB." }, { status: 400 });
      }
      job = createClipJob({
        sourceType,
        sourceName: file.name.slice(0, 180),
        title,
        selectionMode,
        jsonTiming: selectionMode === "json" ? jsonTiming : undefined,
        importedPlan,
      });
      saveClipSource(job.id, file.name, Buffer.from(await file.arrayBuffer()));
      job = readClipJob(job.id);
    }
  } catch (error) {
    if (job?.id) {
      try { deleteClipJob(job.id); } catch { /* limpieza best-effort */ }
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la fuente." },
      { status: 500 },
    );
  }

  if (!job) return NextResponse.json({ error: "No se pudo crear el análisis." }, { status: 500 });
  startClipProcessing(job.id);
  return NextResponse.json({ job }, { status: 202 });
}

function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

function isYouTubeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host === "youtube.com"
      || host === "m.youtube.com"
      || host === "music.youtube.com"
      || host === "youtube-nocookie.com"
      || host === "youtu.be";
  } catch {
    return false;
  }
}
