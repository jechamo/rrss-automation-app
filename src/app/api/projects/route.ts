import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReq001Pipeline } from "@/core/pipeline/req001";
import { executeRun, initialNodeStatus } from "@/core/pipeline/engine";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  codeType: z.enum(["local", "github_public", "github_private", "none"]).default("none"),
  codePath: z.string().optional(),
  context: z.string().max(8000).optional(),
});

export const dynamic = "force-dynamic";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { dossier: true },
  });
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos", issues: parsed.error.issues }, { status: 400 });
  }
  const { name, url, codeType, codePath, context } = parsed.data;

  if ((codeType === "local" || codeType.startsWith("github")) && !codePath) {
    return NextResponse.json({ error: "Falta la ruta/URL del codigo." }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      name,
      url,
      codeType,
      codePath: codePath ?? null,
      context: context?.trim() || null,
    },
  });

  const def = buildReq001Pipeline(project.codeType);
  const run = await prisma.run.create({
    data: {
      projectId: project.id,
      requisito: "REQ-001",
      status: "pending",
      nodes: JSON.stringify(initialNodeStatus(def)),
    },
  });

  // Fire-and-forget: se ejecuta en el servidor local y emite eventos por SSE.
  void executeRun(run.id, def, {
    id: project.id,
    name: project.name,
    url: project.url,
    codeType: project.codeType,
    codePath: project.codePath,
    context: project.context,
  }).catch(() => {
    /* el estado de error ya se persiste dentro de executeRun */
  });

  return NextResponse.json({ projectId: project.id, runId: run.id });
}
