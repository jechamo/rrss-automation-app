import { NextRequest, NextResponse } from "next/server";
import { listSystemTools } from "@/core/media/bintools";
import { localWhisperToolStatus } from "@/core/clips/local-transcription";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  return NextResponse.json({
    tools: [...listSystemTools(refresh), localWhisperToolStatus()],
  });
}
