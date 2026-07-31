import { NextRequest, NextResponse } from "next/server";
import {
  clipToolsStatus,
  isClipProcessing,
  startClipMomentRendering,
} from "@/core/clips/processor";
import { readClipJob } from "@/core/clips/storage";
import type { ClipSubtitleMode } from "@/core/clips/contracts";

export const dynamic = "force-dynamic";

const MODES = new Set<ClipSubtitleMode>(["youtube_cc", "local_whisper", "gemini"]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; momentId: string }> },
) {
  const { id, momentId } = await ctx.params;
  try {
    const job = readClipJob(id);
    if (isClipProcessing(id)) {
      return NextResponse.json(
        { error: "Ya hay una operación activa en este historial." },
        { status: 409 },
      );
    }
    if (!job.selection?.moments.some((moment) => moment.id === momentId)) {
      return NextResponse.json({ error: "Clip no encontrado." }, { status: 404 });
    }
    const body = await req.json().catch(() => ({})) as { subtitleMode?: unknown };
    const subtitleMode = body.subtitleMode as ClipSubtitleMode;
    if (!MODES.has(subtitleMode)) {
      return NextResponse.json({ error: "Selecciona CC, Whisper o Gemini." }, { status: 400 });
    }
    if (subtitleMode === "youtube_cc" && job.sourceType !== "youtube") {
      return NextResponse.json(
        { error: "Los CC solo pueden solicitarse para una fuente de YouTube." },
        { status: 400 },
      );
    }
    const tools = clipToolsStatus(job.sourceType);
    if (subtitleMode === "local_whisper" && !tools.whisper) {
      return NextResponse.json({ error: "Whisper local no está disponible." }, { status: 409 });
    }
    if (subtitleMode === "gemini" && !tools.gemini) {
      return NextResponse.json({ error: "Configura Gemini en Ajustes." }, { status: 409 });
    }
    if (!tools.ffmpeg || !tools.ffprobe || (subtitleMode === "youtube_cc" && !tools.ytdlp)) {
      return NextResponse.json(
        { error: "Faltan FFmpeg, ffprobe o yt-dlp para regenerar este clip." },
        { status: 409 },
      );
    }
    if (!startClipMomentRendering(id, momentId, subtitleMode)) {
      return NextResponse.json({ error: "El trabajo ya está ocupado." }, { status: 409 });
    }
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar la regeneración." },
      { status: 500 },
    );
  }
}
