import { NextRequest, NextResponse } from "next/server";
import { PROVIDERS, testProvider, type ProviderId } from "@/core/connectors";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/core/settings";

function isProvider(id: string): id is ProviderId {
  return PROVIDERS.some((p) => p.id === id);
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isProvider(id)) return NextResponse.json({ error: "Proveedor invalido" }, { status: 400 });

  const engineId = id === "ai-engine" ? getSettings().aiEngine : undefined;
  const result = await testProvider(id, engineId);

  await prisma.connectorState.upsert({
    where: { provider: id },
    create: {
      provider: id,
      status: result.ok ? "ok" : "error",
      detail: result.detail,
      lastChecked: new Date(),
    },
    update: {
      status: result.ok ? "ok" : "error",
      detail: result.detail,
      lastChecked: new Date(),
    },
  });

  return NextResponse.json(result);
}
