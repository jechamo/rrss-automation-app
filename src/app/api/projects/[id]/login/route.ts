import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setLogin, hasLogin, deleteLogin } from "@/core/secrets/login";

export const dynamic = "force-dynamic";

// REQ-006 (DA-05): credenciales de login de la appweb objetivo, cifradas por proyecto.
// La contrasena NUNCA se devuelve; solo se informa si esta configurada.

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return NextResponse.json({ configured: hasLogin(id) });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { user?: unknown; pass?: unknown } | null;
  const user = typeof body?.user === "string" ? body.user : "";
  const pass = typeof body?.pass === "string" ? body.pass : "";
  if (!user || !pass) {
    return NextResponse.json({ error: "Usuario y contrasena son obligatorios." }, { status: 400 });
  }
  setLogin(id, { user, pass });
  return NextResponse.json({ configured: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  deleteLogin(id);
  return NextResponse.json({ configured: false });
}
