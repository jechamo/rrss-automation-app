import { NextRequest, NextResponse } from "next/server";
import { PROVIDERS, type ProviderId } from "@/core/connectors";
import { setSecret, deleteSecret } from "@/core/secrets/vault";

function isValidProvider(id: string): id is ProviderId {
  return PROVIDERS.some((p) => p.id === id && p.needsKey);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isValidProvider(id)) return NextResponse.json({ error: "Proveedor invalido" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { key?: string };
  const key = body.key?.trim();
  if (!key) return NextResponse.json({ error: "Key vacia" }, { status: 400 });

  setSecret(id, key);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isValidProvider(id)) return NextResponse.json({ error: "Proveedor invalido" }, { status: 400 });
  deleteSecret(id);
  return NextResponse.json({ ok: true });
}
