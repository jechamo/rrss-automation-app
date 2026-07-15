import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coerceLeads } from "@/core/leads/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }

  const leadsRow = await prisma.leads.findUnique({ where: { projectId } });
  const lastRun = await prisma.run.findFirst({
    where: { projectId, requisito: "REQ-003" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, nodes: true },
  });

  return NextResponse.json({
    leads: leadsRow ? coerceLeads(JSON.parse(leadsRow.content)) : null,
    status: leadsRow?.status ?? "draft",
    version: leadsRow?.version ?? 0,
    updatedAt: leadsRow?.updatedAt ?? null,
    lastRun: lastRun ?? null,
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
  }

  const leads = coerceLeads((body as { leads?: unknown }).leads ?? body);
  const approve = (body as { approve?: boolean }).approve === true;

  const existing = await prisma.leads.findUnique({ where: { projectId } });
  if (!existing) {
    return NextResponse.json({ error: "Leads no encontrados." }, { status: 404 });
  }

  const updated = await prisma.leads.update({
    where: { projectId },
    data: {
      content: JSON.stringify(leads),
      status: approve ? "approved" : existing.status,
      version: { increment: 1 },
    },
  });

  return NextResponse.json({ status: updated.status, version: updated.version });
}
