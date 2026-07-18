import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coerceDemo } from "@/core/content/types";
import { pieceDir } from "@/core/media/storage";
import { recordDemo, RecordStepError } from "@/core/media/recorder";
import { getLogin } from "@/core/secrets/login";

export const dynamic = "force-dynamic";

// REQ-006: valida URL, login y selectores sin grabar video.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const demo = coerceDemo(body);
  if (demo.grabacionModo !== "auto") {
    return NextResponse.json({ error: "La prueba solo esta disponible en modo automatico." }, { status: 400 });
  }

  const pieceId = `dryrun-${id}-${Date.now()}`;
  const tempDir = pieceDir(pieceId);
  const logs: string[] = [];

  try {
    await recordDemo({
      projectId: id,
      pieceId,
      url: demo.funcionUrl || project.url,
      pasos: demo.pasos,
      navSteps: demo.navSteps,
      login: demo.usarLogin ? getLogin(id) : null,
      log: (message) => logs.push(message),
      dryRun: true,
    });
    return NextResponse.json({ ok: true, logs });
  } catch (error) {
    const failedStep = error instanceof RecordStepError ? error.failedStep : undefined;
    return NextResponse.json(
      {
        ok: false,
        failedStep,
        error: error instanceof Error ? error.message : String(error),
        logs,
      },
      { status: 422 },
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
