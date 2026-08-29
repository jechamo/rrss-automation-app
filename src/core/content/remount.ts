import type { MediaConfig, PieceAssets, PieceContent } from "./types";
import { assemble, assemblePresenterDemo } from "@/core/media/assemble";
import { hasFfmpeg } from "@/core/media/ffmpeg";
import { isMockE2E } from "@/core/runtime/e2e-profile";

export interface RemountResult {
  assets: PieceAssets;
  finalReady: boolean;
}

/**
 * Vuelve a montar una pieza propia usando exclusivamente recursos existentes.
 * No importa ni llama a fal.ai, ElevenLabs o HeyGen.
 */
export function remountOwnPiece(args: {
  pieceId: string;
  config: MediaConfig;
  content: PieceContent;
  assets: PieceAssets;
  log: (message: string) => void;
}): RemountResult {
  const { pieceId, config, content, assets, log } = args;
  if (!assets.recordingPath) {
    throw new Error("Falta la grabación de navegación. Grábala, súbela o elígela desde la mediateca.");
  }
  if (isMockE2E()) {
    assets.videoPath ||= assets.presenterPath || assets.recordingPath;
    assets.logs.push("Montaje fixture regenerado sin invocar proveedores ni FFmpeg real.");
    log("Montaje fixture regenerado sin consumir créditos de vídeo ni voz.");
    return { assets, finalReady: true };
  }
  if (!hasFfmpeg()) {
    throw new Error("FFmpeg no está disponible; instálalo para regenerar el montaje sin proveedores.");
  }

  const subtitleText = content.guion.locucion || content.guion.desarrollo;
  const outputName = `final-remount-${Date.now()}.mp4`;
  let result;
  if (config.rama === "heygen") {
    const presenter = assets.presenterPath || (
      /(?:^|\/)final\.mp4$/i.test(assets.videoPath) ? "" : assets.videoPath
    );
    if (!presenter) throw new Error("No se conserva el vídeo original de HeyGen para reutilizarlo.");
    result = assemblePresenterDemo({
      pieceId,
      presenterPath: presenter,
      recordingPath: assets.recordingPath,
      locucionText: subtitleText,
      burnSubtitles: true,
      outputName,
    });
  } else {
    if (subtitleText.trim() && !assets.audioPath) {
      throw new Error("No se conserva la locución original; no se llamará a ElevenLabs automáticamente.");
    }
    result = assemble({
      pieceId,
      assets,
      locucionText: subtitleText,
      shots: content.escaleta,
      outputName,
    });
  }

  if (!result) throw new Error("No hay suficientes recursos locales para crear el nuevo montaje.");
  if (subtitleText.trim() && !result.subtitlesBurned) {
    throw new Error("El montaje se detuvo porque no pudo garantizar los subtítulos visibles.");
  }

  assets.videoPath = result.path;
  const duration = result.seconds ? ` (${result.seconds.toFixed(1)}s)` : "";
  const message = `Montaje regenerado sin consumir créditos de vídeo ni voz${duration}.`;
  assets.logs.push(message);
  if (result.qcFrames) assets.logs.push("Frames de control de calidad regenerados.");
  log(message);
  return { assets, finalReady: true };
}
