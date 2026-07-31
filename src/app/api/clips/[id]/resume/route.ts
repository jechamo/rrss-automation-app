import { NextResponse } from "next/server";
import { isClipProcessing, startClipResume } from "@/core/clips/processor";
import { readClipJob } from "@/core/clips/storage";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const job = readClipJob(id);
    if (isClipProcessing(id)) {
      return NextResponse.json({ error: "Este historial ya se está procesando." }, { status: 409 });
    }
    if (!job.selection || !job.sourceFile) {
      return NextResponse.json(
        { error: "Este historial no conserva la selección y la fuente necesarias para continuar." },
        { status: 409 },
      );
    }
    if (!startClipResume(id)) {
      return NextResponse.json({ error: "Este historial ya se está procesando." }, { status: 409 });
    }
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Análisis no encontrado." }, { status: 404 });
  }
}
