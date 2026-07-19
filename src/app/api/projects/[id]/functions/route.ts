import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coerceDossier } from "@/core/dossier/types";
import { coerceNavigationMap } from "@/core/navigation/types";
import { analyzeFunctions } from "@/core/content/demo";
import { getLogin } from "@/core/secrets/login";
import {
  inspectNavigationSurface,
  runtimeSnapshotPrompt,
} from "@/core/media/navigation-inspector";

export const dynamic = "force-dynamic";

// REQ-006: la IA propone funcionalidades demostrables de la app (a partir del dossier).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    objetivo?: unknown;
    usarLogin?: unknown;
    demoData?: unknown;
  } | null;
  const objective = typeof body?.objetivo === "string" ? body.objetivo.trim().slice(0, 160) : "";
  const demoData = typeof body?.demoData === "string" ? body.demoData.trim().slice(0, 160) : "";
  const project = await prisma.project.findUnique({
    where: { id },
    include: { dossier: true, navigationMap: true },
  });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  if (!project.dossier) {
    return NextResponse.json({ error: "Genera primero el dossier (REQ-001)." }, { status: 409 });
  }

  try {
    const dossier = coerceDossier(JSON.parse(project.dossier.content));
    const login = body?.usarLogin === true ? getLogin(id) : null;
    let runtimeContext = "";
    let warning = "";
    if (objective && login) {
      try {
        const snapshot = await inspectNavigationSurface({ projectId: id, url: project.url, login });
        runtimeContext = runtimeSnapshotPrompt(snapshot);
      } catch (error) {
        warning = `No se pudo inspeccionar la zona privada; el análisis continúa con el código: ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    }
    const funciones = await analyzeFunctions({
      dossier,
      appUrl: project.url,
      codeType: project.codeType,
      codePath: project.codePath,
      objective,
      loginConfigured: Boolean(login),
      demoData,
      runtimeContext,
      navigationMap: project.navigationMap
        ? coerceNavigationMap(JSON.parse(project.navigationMap.content))
        : null,
    });
    const automatic = funciones.some((funcion) => Boolean(funcion.navSteps?.length));
    if (objective && !automatic && !warning) {
      warning = "Se encontró la funcionalidad, pero no un recorrido automático seguro. Revisa los pasos humanos o añade un cliente/dato de ejemplo.";
    }
    return NextResponse.json({ funciones, warning });
  } catch (e) {
    const raw = (e as Error).message;
    const reset = raw.match(/resets? ([^"}\n]+)/i)?.[1]?.trim();
    const error = /session limit|api_error_status["']?:\s*429/i.test(raw)
      ? `Claude ha alcanzado el límite temporal de la sesión${reset ? `; se restablece ${reset}` : ""}. Inténtalo de nuevo después.`
      : raw;
    return NextResponse.json({ funciones: [], error });
  }
}
