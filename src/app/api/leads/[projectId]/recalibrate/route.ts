import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calibrateLeads } from "@/core/leads/calibration";
import { coerceLeads } from "@/core/leads/types";

export const dynamic = "force-dynamic";

/** Recalibra FIT+INTENT sobre los datos guardados; no ejecuta WebSearch. */
export async function POST(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const existing = await prisma.leads.findUnique({ where: { projectId } });
  if (!existing) {
    return NextResponse.json({ error: "Leads no encontrados." }, { status: 404 });
  }

  const leads = calibrateLeads(coerceLeads(JSON.parse(existing.content)));
  const updated = await prisma.leads.update({
    where: { projectId },
    data: {
      content: JSON.stringify(leads),
      status: "draft",
      version: { increment: 1 },
    },
  });
  return NextResponse.json({ leads, status: updated.status, version: updated.version });
}
