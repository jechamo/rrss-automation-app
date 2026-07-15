import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { assetAbsPath } from "@/core/media/storage";

export const dynamic = "force-dynamic";

// Sirve un asset local (video/audio) generado para una pieza, para revisarlo en el navegador.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string; pieceId: string }> },
) {
  const { pieceId } = await ctx.params;
  const params = new URL(req.url).searchParams;
  const rel = params.get("path") ?? "";
  const download = params.get("download") === "1";
  // Solo se sirven assets dentro del directorio de la propia pieza.
  if (!rel.startsWith(`media/${pieceId}/`)) {
    return NextResponse.json({ error: "Ruta invalida." }, { status: 400 });
  }

  let abs: string;
  try {
    abs = assetAbsPath(rel);
  } catch {
    return NextResponse.json({ error: "Ruta invalida." }, { status: 400 });
  }
  if (!fs.existsSync(abs)) {
    return NextResponse.json({ error: "Asset no encontrado." }, { status: 404 });
  }

  const buf = fs.readFileSync(abs);
  const type = rel.endsWith(".mp3")
    ? "audio/mpeg"
    : rel.endsWith(".wav")
      ? "audio/wav"
      : rel.endsWith(".webm")
        ? "video/webm"
        : rel.endsWith(".mov")
          ? "video/quicktime"
          : "video/mp4";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Content-Length": String(buf.length),
    "Cache-Control": "no-store",
  };
  if (download) {
    const filename = rel.split("/").pop() || "video.mp4";
    headers["Content-Disposition"] = `attachment; filename="${filename}"`;
  }
  return new NextResponse(buf, { headers });
}
