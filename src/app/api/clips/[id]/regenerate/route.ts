import { NextRequest, NextResponse } from "next/server";
import {
  clipToolsStatus,
  isClipProcessing,
  startClipProcessing,
} from "@/core/clips/processor";
import {
  createClipJob,
  deleteClipJob,
  readClipJob,
  reuseClipSource,
  updateClipJob,
} from "@/core/clips/storage";
import {
  parseImportedClipPlan,
  type ClipJsonTimingMode,
  type ClipSelectionMode,
  type ImportedClipPlan,
} from "@/core/clips/contracts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let createdId = "";
  try {
    const original = readClipJob(id);
    if (isClipProcessing(id)) {
      return NextResponse.json(
        { error: "Este historial sigue procesándose. Espera a que termine." },
        { status: 409 },
      );
    }
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const selectionMode: ClipSelectionMode = body.selectionMode === "json" ? "json" : "ai";
    const jsonTiming: ClipJsonTimingMode = body.jsonTiming === "gemini" ? "gemini" : "direct";
    let importedPlan: ImportedClipPlan | undefined;
    if (selectionMode === "json") {
      const rawJson = typeof body.selectionJson === "string" ? body.selectionJson.trim() : "";
      if (!rawJson) {
        return NextResponse.json(
          { error: "Pega o conserva un JSON editorial para regenerar con este modo." },
          { status: 400 },
        );
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

    const tools = clipToolsStatus(original.sourceType);
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
        { error: `Faltan herramientas obligatorias: ${missing.join(", ")}.` },
        { status: 409 },
      );
    }

    const created = createClipJob({
      sourceType: original.sourceType,
      sourceUrl: original.sourceUrl,
      sourceName: original.sourceName,
      title: typeof body.title === "string" ? body.title : original.title,
      selectionMode,
      jsonTiming: selectionMode === "json" ? jsonTiming : undefined,
      importedPlan,
    });
    createdId = created.id;
    if (original.sourceFile) {
      reuseClipSource(original.id, created.id, original.sourceFile);
    } else if (original.sourceType === "upload") {
      throw new Error("La fuente local original ya no está disponible.");
    }
    updateClipJob(created.id, {
      regeneratedFromId: original.id,
      logs: [`Nueva versión creada desde «${original.title}». Preparando la fuente conservada…`],
    });
    startClipProcessing(created.id);
    return NextResponse.json({ job: readClipJob(created.id) }, { status: 202 });
  } catch (error) {
    if (createdId) {
      try { deleteClipJob(createdId); } catch { /* limpieza best-effort */ }
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo regenerar el historial." },
      { status: 500 },
    );
  }
}
