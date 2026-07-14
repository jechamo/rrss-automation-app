import { NextRequest, NextResponse } from "next/server";
import { saveSettings, AI_MODELS, type AiModel } from "@/core/settings";
import type { AiEngineId } from "@/core/ai";

const VALID: AiEngineId[] = ["claude-cli", "claude-agent-sdk"];
const VALID_MODELS = AI_MODELS.map((m) => m.id);

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { engine?: string; model?: string };

  // Cambio de modelo (independiente del motor).
  if (body.model !== undefined) {
    if (!VALID_MODELS.includes(body.model as AiModel)) {
      return NextResponse.json({ error: "Modelo invalido" }, { status: 400 });
    }
    const settings = saveSettings({ aiModel: body.model as AiModel });
    return NextResponse.json({ ok: true, aiModel: settings.aiModel });
  }

  const engine = body.engine as AiEngineId;
  if (!VALID.includes(engine)) {
    return NextResponse.json({ error: "Motor invalido" }, { status: 400 });
  }
  const settings = saveSettings({ aiEngine: engine });
  return NextResponse.json({ ok: true, aiEngine: settings.aiEngine });
}
