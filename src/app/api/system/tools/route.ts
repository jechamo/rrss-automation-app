import { NextRequest, NextResponse } from "next/server";
import { listSystemTools } from "@/core/media/bintools";
import { localWhisperToolStatus } from "@/core/clips/local-transcription";
import { isMockE2E } from "@/core/runtime/e2e-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (isMockE2E()) {
    return NextResponse.json({ tools: [
      missingTool("ffmpeg", "FFmpeg", "winget install Gyan.FFmpeg"),
      missingTool("ffprobe", "ffprobe", "winget install Gyan.FFmpeg"),
      missingTool("yt-dlp", "yt-dlp", "winget install yt-dlp.yt-dlp"),
      missingTool("whisper", "Whisper local", "Instalación local requerida en data/tools/whisper-cpp."),
    ] });
  }
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  return NextResponse.json({
    tools: [...listSystemTools(refresh), localWhisperToolStatus()],
  });
}

function missingTool(name: string, label: string, installHint: string) {
  return { name, label, found: false, path: "", version: "", source: "missing", installHint };
}
