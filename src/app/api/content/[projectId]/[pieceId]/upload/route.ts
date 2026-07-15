import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveBytes } from "@/core/media/storage";
import { coerceAssets } from "@/core/content/types";

export const dynamic = "force-dynamic";

const ALLOWED = [".mp4", ".webm", ".mov"];

// REQ-006 (modo manual): sube un screencast de la app para la pieza y lo fija
// como grabacion en assets.recordingPath.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string; pieceId: string }> },
) {
  const { projectId, pieceId } = await ctx.params;
  const piece = await prisma.contentPiece.findFirst({ where: { id: pieceId, projectId } });
  if (!piece) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el fichero de video." }, { status: 400 });
  }
  const name = file.name.toLowerCase();
  const ext = ALLOWED.find((e) => name.endsWith(e));
  if (!ext) {
    return NextResponse.json({ error: "Formato no soportado (usa mp4, webm o mov)." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const rel = saveBytes(pieceId, `screencast${ext}`, buf);

  const assets = coerceAssets(JSON.parse(piece.assets || "{}"));
  assets.recordingPath = rel;
  if (!assets.videoPath) assets.videoPath = rel;

  await prisma.contentPiece.update({
    where: { id: pieceId },
    data: { assets: JSON.stringify(assets) },
  });

  return NextResponse.json({ recordingPath: rel });
}
