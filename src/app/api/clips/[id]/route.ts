import { NextResponse } from "next/server";
import { isClipProcessing, recoverInterruptedClipJob } from "@/core/clips/processor";
import { deleteClipJob, readClipJob } from "@/core/clips/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ job: recoverInterruptedClipJob(readClipJob(id)) });
  } catch {
    return NextResponse.json({ error: "Análisis no encontrado." }, { status: 404 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    if (isClipProcessing(id)) {
      return NextResponse.json(
        { error: "Este trabajo sigue procesándose. Espera a que termine antes de eliminarlo." },
        { status: 409 },
      );
    }
    deleteClipJob(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Análisis no encontrado." }, { status: 404 });
  }
}
