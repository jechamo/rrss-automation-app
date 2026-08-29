import { NextResponse } from "next/server";
import { resolveRuntimeProfile } from "@/core/runtime/e2e-profile";
import { prisma } from "@/lib/prisma";
import { mockRuntimeReport } from "@/core/testing/mock-runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = resolveRuntimeProfile();
  if (profile.mode !== "mock") {
    return NextResponse.json({ error: "No disponible." }, { status: 404 });
  }

  const [projects, pieces] = await Promise.all([
    prisma.project.count(),
    prisma.contentPiece.count(),
  ]);
  return NextResponse.json({
    profile: "mock",
    runId: profile.runId,
    isolated: true,
    parentSecretPresent: process.env.RRSS_E2E_PARENT_SECRET_SENTINEL !== undefined,
    businessRows: { projects, pieces },
    mockRuntime: mockRuntimeReport(),
  }, { headers: { "Cache-Control": "no-store" } });
}
