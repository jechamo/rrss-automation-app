import { NextRequest, NextResponse } from "next/server";
import { createPhotoAvatar, uploadAsset } from "@/core/media/heygen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Subida segura foto/audio -> HeyGen. La API key vive en el servidor (vault);
// el cliente solo recibe IDs/metadatos, nunca la key. Photo -> crea Photo Avatar.

const MAX_BYTES = 32 * 1024 * 1024; // limite de /v3/assets

const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/jpg"]);
const AUDIO_MIME = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"]);

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Cuerpo multipart invalido." }, { status: 400 });

  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  const name = String(form.get("name") ?? "").slice(0, 100);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el fichero." }, { status: 400 });
  }
  if (kind !== "photo" && kind !== "audio") {
    return NextResponse.json({ error: "kind debe ser 'photo' o 'audio'." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El fichero supera el maximo de 32 MB." }, { status: 413 });
  }

  const mime = (file.type || "").toLowerCase();
  const allowed = kind === "photo" ? IMAGE_MIME : AUDIO_MIME;
  if (!allowed.has(mime)) {
    const hint = kind === "photo" ? "PNG o JPEG" : "MP3 o WAV";
    return NextResponse.json({ error: `Formato no soportado (usa ${hint}).` }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const asset = await uploadAsset(bytes, file.name || `upload-${kind}`, mime);

    if (kind === "audio") {
      return NextResponse.json({
        audioAssetId: asset.assetId,
        audioLabel: file.name || "audio.mp3",
        url: asset.url,
      });
    }

    // photo: crea el Photo Avatar y devuelve su avatar_id listo para generar video.
    const avatarId = await createPhotoAvatar(name || "RRSS Studio avatar", asset.assetId);
    return NextResponse.json({
      avatarId,
      avatarLabel: name || file.name || "Avatar propio",
      preview: asset.url,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
