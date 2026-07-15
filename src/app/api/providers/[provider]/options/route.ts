import { NextRequest, NextResponse } from "next/server";
import { listOptions, type OptionKind } from "@/core/media";

export const dynamic = "force-dynamic";

const KINDS: OptionKind[] = ["video", "voice", "avatar"];

// Lista modelos/voces/avatares de un proveedor para el modal de generacion (REQ-005).
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params;
  const raw = new URL(req.url).searchParams.get("kind") ?? "video";
  const kind = (KINDS.includes(raw as OptionKind) ? raw : "video") as OptionKind;

  try {
    const options = await listOptions(provider, kind);
    return NextResponse.json({ options });
  } catch (e) {
    // Sin key/red: devolvemos lista vacia + motivo para que el modal lo muestre.
    return NextResponse.json({ options: [], error: (e as Error).message });
  }
}
