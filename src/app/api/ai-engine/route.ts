import { NextRequest, NextResponse } from "next/server";
import { saveSettings } from "@/core/settings";
import type { AiEngineId } from "@/core/ai";

const VALID: AiEngineId[] = ["claude-cli", "claude-agent-sdk"];

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { engine?: string };
  const engine = body.engine as AiEngineId;
  if (!VALID.includes(engine)) {
    return NextResponse.json({ error: "Motor invalido" }, { status: 400 });
  }
  const settings = saveSettings({ aiEngine: engine });
  return NextResponse.json({ ok: true, aiEngine: settings.aiEngine });
}
