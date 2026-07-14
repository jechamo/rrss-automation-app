import { NextResponse } from "next/server";
import { PROVIDERS } from "@/core/connectors";
import { hasSecret, maskSecret } from "@/core/secrets/vault";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/core/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const states = await prisma.connectorState.findMany();
  const stateMap = new Map(states.map((s) => [s.provider, s]));
  const settings = getSettings();

  const list = PROVIDERS.map((p) => {
    const st = stateMap.get(p.id);
    return {
      ...p,
      hasKey: p.needsKey ? hasSecret(p.id) : true,
      masked: p.needsKey ? maskSecret(p.id) : null,
      status: st?.status ?? "unset",
      detail: st?.detail ?? null,
      lastChecked: st?.lastChecked ?? null,
    };
  });

  return NextResponse.json({ providers: list, aiEngine: settings.aiEngine, aiModel: settings.aiModel });
}
