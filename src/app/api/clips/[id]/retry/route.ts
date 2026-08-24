import { NextResponse } from "next/server";
import { isClipProcessing, startClipProcessing } from "@/core/clips/processor";
import { readClipJob, updateClipJob } from "@/core/clips/storage";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    readClipJob(id);
    if (isClipProcessing(id)) {
      return NextResponse.json({ error: "El análisis ya está en curso." }, { status: 409 });
    }
    updateClipJob(id, {
      status: "pending",
      stage: "source",
      progress: 2,
      error: undefined,
    });
    startClipProcessing(id);
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Análisis no encontrado." }, { status: 404 });
  }
}
