import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assetAbsPath, saveBytes } from "@/core/media/storage";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function validProjectAsset(id: string, rel: string): boolean {
  return rel.startsWith(`media/project-${id}/`);
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id }, select: { logoPath: true } });
  if (!project?.logoPath || !validProjectAsset(id, project.logoPath)) {
    return NextResponse.json({ error: "Logo no encontrado." }, { status: 404 });
  }

  let abs: string;
  try {
    abs = assetAbsPath(project.logoPath);
  } catch {
    return NextResponse.json({ error: "Ruta de logo invalida." }, { status: 400 });
  }
  if (!fs.existsSync(abs)) {
    return NextResponse.json({ error: "Logo no encontrado." }, { status: 404 });
  }

  const ext = Object.keys(ALLOWED).find((candidate) =>
    project.logoPath!.toLowerCase().endsWith(candidate),
  );
  return new NextResponse(fs.readFileSync(abs), {
    headers: {
      "Content-Type": ext ? ALLOWED[ext] : "application/octet-stream",
      "Content-Length": String(fs.statSync(abs).size),
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id }, select: { logoPath: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el fichero de imagen." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen supera el maximo de 2 MB." }, { status: 413 });
  }
  const lowerName = file.name.toLowerCase();
  const ext = Object.keys(ALLOWED).find((candidate) => lowerName.endsWith(candidate));
  if (!ext) {
    return NextResponse.json(
      { error: "Formato no soportado (usa PNG, JPG o WebP)." },
      { status: 400 },
    );
  }

  const rel = saveBytes(`project-${id}`, `logo${ext}`, Buffer.from(await file.arrayBuffer()));
  await prisma.project.update({ where: { id }, data: { logoPath: rel } });

  if (project.logoPath && project.logoPath !== rel && validProjectAsset(id, project.logoPath)) {
    try {
      fs.unlinkSync(assetAbsPath(project.logoPath));
    } catch {
      // La referencia nueva ya esta guardada; un fichero antiguo ausente no bloquea la subida.
    }
  }
  return NextResponse.json({ logoPath: rel });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { id }, select: { logoPath: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });

  await prisma.project.update({ where: { id }, data: { logoPath: null } });
  if (project.logoPath && validProjectAsset(id, project.logoPath)) {
    try {
      fs.unlinkSync(assetAbsPath(project.logoPath));
    } catch {
      // Borrado idempotente.
    }
  }
  return NextResponse.json({ ok: true });
}
