import fs from "node:fs";
import path from "node:path";
import { fetchWithTimeout } from "./http";

// Almacenamiento local de los binarios generados (video/audio) en data/media/<pieceId>/.
// Se guardan rutas RELATIVAS a data/ en el blob assets; el endpoint de asset las sirve.

const DATA_DIR = path.join(process.cwd(), "data");
const MEDIA_DIR = path.join(DATA_DIR, "media");

export function pieceDir(pieceId: string): string {
  const dir = path.join(MEDIA_DIR, pieceId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveBytes(pieceId: string, name: string, bytes: Buffer): string {
  const full = path.join(pieceDir(pieceId), name);
  fs.writeFileSync(full, bytes);
  return path.relative(DATA_DIR, full).replace(/\\/g, "/");
}

export function projectLibraryDir(projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, "");
  const dir = path.join(MEDIA_DIR, `project-${safeId}`, "library");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveProjectBytes(projectId: string, name: string, bytes: Buffer): string {
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const full = path.join(projectLibraryDir(projectId), safeName);
  fs.writeFileSync(full, bytes);
  return path.relative(DATA_DIR, full).replace(/\\/g, "/");
}

/** Descarga una URL al directorio de la pieza; devuelve la ruta relativa a data/. */
export async function downloadTo(
  pieceId: string,
  name: string,
  url: string,
  ms = 180000,
): Promise<string> {
  const res = await fetchWithTimeout(url, {}, ms);
  if (!res.ok) throw new Error(`Descarga fallida (${res.status}) de ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return saveBytes(pieceId, name, buf);
}

/** Convierte una ruta relativa a data/ en ruta absoluta (para servir el fichero). */
export function assetAbsPath(rel: string): string {
  const clean = rel.replace(/^[/\\]+/, "");
  const full = path.join(DATA_DIR, clean);
  // Evita path traversal fuera de data/.
  if (!full.startsWith(DATA_DIR)) throw new Error("Ruta de asset invalida.");
  return full;
}
