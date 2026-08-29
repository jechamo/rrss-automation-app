import { NextRequest, NextResponse } from "next/server";
import { resolveRuntimeProfile } from "@/core/runtime/e2e-profile";
import {
  resetMockRuntime,
  setMockScenario,
  type MockProvider,
  type MockScenario,
} from "@/core/testing/mock-runtime";

export const dynamic = "force-dynamic";

const providers = new Set<MockProvider>([
  "claude", "gemini", "fal", "heygen", "elevenlabs", "scrapecreators",
  "yt-dlp", "github", "web-search", "clips",
]);
const scenarios = new Set<MockScenario>(["success", "error", "timeout", "invalid"]);

export async function PUT(request: NextRequest) {
  if (resolveRuntimeProfile().mode !== "mock") {
    return NextResponse.json({ error: "No disponible." }, { status: 404 });
  }
  const body = await request.json().catch(() => null) as {
    reset?: unknown;
    provider?: unknown;
    scenario?: unknown;
  } | null;
  if (body?.reset === true) {
    resetMockRuntime();
    return NextResponse.json({ ok: true });
  }
  if (!providers.has(body?.provider as MockProvider) || !scenarios.has(body?.scenario as MockScenario)) {
    return NextResponse.json({ error: "Escenario E2E no válido." }, { status: 400 });
  }
  setMockScenario(body!.provider as MockProvider, body!.scenario as MockScenario);
  return NextResponse.json({ ok: true });
}
