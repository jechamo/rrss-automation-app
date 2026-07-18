import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coerceDossier } from "@/core/dossier/types";
import { analyzeFunctions } from "@/core/content/demo";
import { getLogin } from "@/core/secrets/login";

export const dynamic = "force-dynamic";

// REQ-006: la IA propone funcionalidades demostrables de la app (a partir del dossier).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    objetivo?: unknown;
    usarLogin?: unknown;
  } | null;
  const objective = typeof body?.objetivo === "string" ? body.objetivo.trim().slice(0, 160) : "";
  const project = await prisma.project.findUnique({ where: { id }, include: { dossier: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  if (!project.dossier) {
    return NextResponse.json({ error: "Genera primero el dossier (REQ-001)." }, { status: 409 });
  }

  try {
    const dossier = coerceDossier(JSON.parse(project.dossier.content));
    const funciones = await analyzeFunctions({
      dossier,
      appUrl: project.url,
      codeType: project.codeType,
      codePath: project.codePath,
      objective,
      loginConfigured: body?.usarLogin === true && Boolean(getLogin(id)),
    });
    return NextResponse.json({ funciones });
  } catch (e) {
    const raw = (e as Error).message;
    const reset = raw.match(/resets? ([^"}\n]+)/i)?.[1]?.trim();
    const error = /session limit|api_error_status["']?:\s*429/i.test(raw)
      ? `Claude ha alcanzado el límite temporal de la sesión${reset ? `; se restablece ${reset}` : ""}. Inténtalo de nuevo después.`
      : raw;
    return NextResponse.json({ funciones: [], error });
  }
}
