import * as fal from "./fal";
import * as heygen from "./heygen";
import * as elevenlabs from "./elevenlabs";
import * as gemini from "./gemini";
import type { MediaOption, OptionKind } from "./types";

export type { MediaOption, OptionKind } from "./types";
export { fal, heygen, elevenlabs, gemini };

/**
 * Lista opciones (modelos de video / voces / avatares) por proveedor, para
 * poblar el modal de generacion. fal devuelve un set curado (sincrono); el
 * resto consultan la API real (necesitan key + red).
 */
export async function listOptions(provider: string, kind: OptionKind): Promise<MediaOption[]> {
  if (provider === "fal" && kind === "video") return fal.listModels();
  if (provider === "heygen" && (kind === "video" || kind === "avatar")) return heygen.listAvatars();
  if (provider === "heygen" && kind === "voice") return heygen.listVoices();
  if (provider === "elevenlabs" && kind === "voice") return elevenlabs.listVoices();
  return [];
}
