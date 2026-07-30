import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { clipAssetPath, readClipJob } from "@/core/clips/storage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const name = url.searchParams.get("name") ?? "";
  const download = url.searchParams.get("download") === "1";
  try {
    readClipJob(id);
    const file = clipAssetPath(id, name);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }
    const stats = fs.statSync(file);
    const type = name.endsWith(".jpg") || name.endsWith(".jpeg")
      ? "image/jpeg"
      : name.endsWith(".webm")
        ? "video/webm"
        : name.endsWith(".mov")
          ? "video/quicktime"
          : "video/mp4";
    const baseHeaders: Record<string, string> = {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "Accept-Ranges": "bytes",
    };
    if (download) baseHeaders["Content-Disposition"] = `attachment; filename="${name}"`;

    const range = req.headers.get("range");
    if (range && type.startsWith("video/") && !download) {
      const parsed = parseRange(range, stats.size);
      if (!parsed) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${stats.size}` },
        });
      }
      const bytes = readRange(file, parsed.start, parsed.end);
      return new NextResponse(bytes, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Length": String(bytes.length),
          "Content-Range": `bytes ${parsed.start}-${parsed.end}/${stats.size}`,
        },
      });
    }

    const bytes = fs.readFileSync(file);
    return new NextResponse(bytes, {
      headers: { ...baseHeaders, "Content-Length": String(bytes.length) },
    });
  } catch {
    return NextResponse.json({ error: "Ruta de recurso inválida." }, { status: 400 });
  }
}

function parseRange(value: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || size <= 0) return null;
  const requestedStart = match[1] ? Number(match[1]) : undefined;
  const requestedEnd = match[2] ? Number(match[2]) : undefined;
  if (requestedStart === undefined) {
    const suffixLength = requestedEnd ?? 0;
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    const length = Math.min(size, suffixLength, 8 * 1024 * 1024);
    return { start: size - length, end: size - 1 };
  }
  const start = requestedStart;
  const maxChunkEnd = start + 8 * 1024 * 1024 - 1;
  const end = Math.min(size - 1, requestedEnd ?? maxChunkEnd, maxChunkEnd);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) {
    return null;
  }
  return { start, end };
}

function readRange(file: string, start: number, end: number): Uint8Array<ArrayBuffer> {
  const length = end - start + 1;
  const output = new Uint8Array(new ArrayBuffer(length));
  const descriptor = fs.openSync(file, "r");
  try {
    fs.readSync(descriptor, output, 0, length, start);
    return output;
  } finally {
    fs.closeSync(descriptor);
  }
}
