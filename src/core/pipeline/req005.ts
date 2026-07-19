import { prisma } from "@/lib/prisma";
import { coerceDossier, type Dossier } from "@/core/dossier/types";
import { coerceVirales, type Viral } from "@/core/virales/types";
import {
  coerceConfig,
  EMPTY_ASSETS,
  type MediaConfig,
  type PieceAssets,
  type PieceContent,
} from "@/core/content/types";
import { extractViral, type ViralExtract } from "@/core/content/extract";
import { generateGuion } from "@/core/content/guion";
import { fal, heygen, elevenlabs } from "@/core/media";
import { assemble, captionVideo } from "@/core/media/assemble";
import { ffprobeDuration, hasFfmpeg } from "@/core/media/ffmpeg";
import { applyBrandOutro } from "@/core/media/brand-outro";
import { assetAbsPath } from "@/core/media/storage";
import { friendlyProviderFailure } from "@/core/media/contracts";
import { effectiveClipLimit } from "@/core/media/planning";
import type { PipelineDef, PipelineNode } from "./engine";

export const REQ005_NODES = [
  { id: "input", label: "Entrada" },
  { id: "extract", label: "Extraer contenido" },
  { id: "guion", label: "Guion (reinterpretacion)" },
  { id: "media", label: "Generar video" },
  { id: "voz", label: "Locucion" },
  { id: "montaje", label: "Montaje / listo" },
] as const;

const MAX_CLIPS = 6; // tope de cortes fal por pieza (control de coste)

function normUrl(url: string): string {
  return url.toLowerCase().trim().replace(/\/+$/, "");
}

/**
 * REQ-005: clona un viral por reinterpretacion conceptual (DA-04) en un video
 * propio. Recibe el id de la ContentPiece (creada por la ruta run con su config).
 */
export function buildReq005Pipeline(pieceId: string): PipelineDef {
  const input: PipelineNode = {
    id: "input",
    label: "Entrada",
    run: async (ctx) => {
      const piece = await prisma.contentPiece.findUnique({ where: { id: pieceId } });
      if (!piece) throw new Error("Pieza de contenido no encontrada.");

      const dossierRow = await prisma.dossier.findUnique({ where: { projectId: ctx.project.id } });
      if (!dossierRow) throw new Error("Genera primero el dossier (REQ-001).");
      const dossier = coerceDossier(JSON.parse(dossierRow.content));

      const viralesRow = await prisma.virales.findUnique({ where: { projectId: ctx.project.id } });
      if (!viralesRow) throw new Error("Genera primero los virales del nicho (REQ-004).");
      const virales = coerceVirales(JSON.parse(viralesRow.content));
      const viral = virales.virales.find((v) => normUrl(v.url) === normUrl(piece.sourceUrl ?? ""));
      if (!viral) throw new Error("El viral elegido ya no existe en el Top. Regenera REQ-004.");

      const config = coerceConfig(JSON.parse(piece.config));

      ctx.artifacts.dossier = dossier;
      ctx.artifacts.viral = viral;
      ctx.artifacts.config = config;
      ctx.artifacts.assets = { ...EMPTY_ASSETS, clips: [], clipManifest: [], logs: [] };
      ctx.artifacts.logoPath = (await prisma.project.findUnique({
        where: { id: ctx.project.id },
        select: { logoPath: true },
      }))?.logoPath;

      await prisma.contentPiece.update({
        where: { id: pieceId },
        data: { status: "generando", runId: ctx.runId },
      });
      ctx.log(`Clonando (reinterpretando) el viral: ${viral.titulo || viral.url}`);
    },
  };

  const extract: PipelineNode = {
    id: "extract",
    label: "Extraer contenido",
    run: async (ctx) => {
      const dossier = ctx.artifacts.dossier as Dossier;
      const viral = ctx.artifacts.viral as Viral;
      const config = ctx.artifacts.config as MediaConfig;
      if (config.rama === "fal" && config.falPromptReview) {
        ctx.log("Análisis reutilizado del preflight de prompts (sin repetir la IA).");
        return;
      }
      const ex = await extractViral({ viral, dossier, config, log: ctx.log });
      ctx.artifacts.extract = ex;
      ctx.log(
        config.usarGemini
          ? "Contenido extraido (datos REQ-004 + Gemini)."
          : "Contenido extraido de los datos de REQ-004.",
      );
    },
  };

  const guion: PipelineNode = {
    id: "guion",
    label: "Guion (reinterpretacion)",
    run: async (ctx) => {
      const dossier = ctx.artifacts.dossier as Dossier;
      const viral = ctx.artifacts.viral as Viral;
      const ex = ctx.artifacts.extract as ViralExtract;
      const config = ctx.artifacts.config as MediaConfig;
      const content = config.rama === "fal" && config.falPromptReview
        ? config.falPromptReview.content
        : await generateGuion({
            dossier,
            extract: ex,
            plataforma: viral.plataforma,
            clipCount: effectiveClipLimit(config),
          });
      ctx.artifacts.content = content;
      // Persistir el guion cuanto antes: aunque el render falle, es revisable.
      await prisma.contentPiece.update({
        where: { id: pieceId },
        data: {
          content: JSON.stringify(content),
          titulo: content.guion.gancho.slice(0, 80) || viral.titulo,
          plataforma: content.plataforma,
        },
      });
      ctx.log(
        config.rama === "fal" && config.falPromptReview
          ? `Guion y prompts aprobados por el usuario (${content.escaleta.length} planos).`
          : `Guion original generado (${content.escaleta.length} planos).`,
      );
    },
  };

  const media: PipelineNode = {
    id: "media",
    label: "Generar video",
    run: async (ctx) => {
      const config = ctx.artifacts.config as MediaConfig;
      const content = ctx.artifacts.content as PieceContent;
      const assets = ctx.artifacts.assets as PieceAssets;

      if (config.rama === "heygen") {
        const heygenConfig = config.heygen;
        if (!heygenConfig) throw new Error("Falta la configuracion del avatar.");
        const useUploadedAudio = heygenConfig.narracion === "audio";
        const path = await heygen.generateAvatarVideo({
          pieceId,
          avatarId: heygenConfig.avatarId,
          voiceId: useUploadedAudio ? undefined : heygenConfig.voiceId,
          texto: useUploadedAudio
            ? undefined
            : content.guion.locucion || content.guion.desarrollo,
          audioAssetId: useUploadedAudio ? heygenConfig.audioAssetId : undefined,
        });
        assets.presenterPath = path;
        assets.videoPath = path;
        ctx.log(
          useUploadedAudio
            ? "Video de avatar generado con el audio subido."
            : "Video de avatar generado con la voz elegida.",
        );
      } else {
        const model = config.videoAuto ? fal.autoModel() : config.videoModelo;
        const shots = content.escaleta.slice(0, Math.min(MAX_CLIPS, effectiveClipLimit(config, content.escaleta)));
        if (shots.length === 0) {
          ctx.log("Plan aprobado sin cortes fal.ai; conserva guion y locución para completar en Estudio.");
        }
        for (const shot of shots) {
          const manifestIndex = assets.clipManifest.length;
          assets.clipManifest.push({
            shot: shot.n,
            description: shot.descripcion,
            prompt: shot.prompt || shot.descripcion,
            model,
            requestedSeconds: config.falClipSeconds,
            actualSeconds: null,
            path: "",
            status: "pending",
          });
          await prisma.contentPiece.update({
            where: { id: pieceId },
            data: { assets: JSON.stringify(assets) },
          });
          ctx.log(`fal.ai: generando plano ${shot.n}/${shots.length}…`);
          try {
            const clip = await fal.generateClip({
              pieceId,
              index: shot.n,
              prompt: shot.prompt || shot.descripcion,
              model,
              seconds: config.falClipSeconds,
              log: ctx.log,
            });
            assets.clips.push(clip);
            assets.videoPath ||= clip;
            assets.clipManifest[manifestIndex] = {
              ...assets.clipManifest[manifestIndex],
              path: clip,
              status: "ok",
              actualSeconds: ffprobeDuration(assetAbsPath(clip)),
            };
            await prisma.contentPiece.update({
              where: { id: pieceId },
              data: { assets: JSON.stringify(assets) },
            });
          } catch (error) {
            const friendly = friendlyProviderFailure(
              "fal.ai",
              error instanceof Error ? error.message : String(error),
            );
            assets.clipManifest[manifestIndex] = {
              ...assets.clipManifest[manifestIndex],
              status: "error",
              error: friendly,
            };
            assets.logs.push(friendly);
            await prisma.contentPiece.update({
              where: { id: pieceId },
              data: { assets: JSON.stringify(assets) },
            });
            throw new Error(friendly);
          }
        }
        // Sin montaje aun: el primer corte hace de preview del video.
        assets.videoPath = assets.clips[0] ?? "";
        ctx.log(`fal.ai: ${assets.clips.length} cortes generados.`);
      }
      ctx.artifacts.assets = assets;
    },
  };

  const voz: PipelineNode = {
    id: "voz",
    label: "Locucion",
    run: async (ctx) => {
      const config = ctx.artifacts.config as MediaConfig;
      const content = ctx.artifacts.content as PieceContent;
      const assets = ctx.artifacts.assets as PieceAssets;

      // HeyGen ya incorpora la voz en el video de avatar.
      if (config.rama === "heygen") {
        ctx.log("Locucion incluida en el avatar de HeyGen (se omite ElevenLabs).");
        return;
      }
      const texto = content.guion.locucion || content.guion.desarrollo;
      if (!texto.trim()) {
        ctx.log("Sin texto de locucion; se omite.");
        return;
      }
      const audio = await elevenlabs.tts(pieceId, texto, config.vozAuto ? "" : config.vozId);
      assets.audioPath = audio;
      ctx.artifacts.assets = assets;
      ctx.log("Locucion generada con ElevenLabs.");
    },
  };

  const montaje: PipelineNode = {
    id: "montaje",
    label: "Montaje / listo",
    run: async (ctx) => {
      const config = ctx.artifacts.config as MediaConfig;
      const assets = ctx.artifacts.assets as PieceAssets;
      const content = ctx.artifacts.content as PieceContent;
      const subtitleText = content.guion.locucion || content.guion.desarrollo;
      let finalReady = !subtitleText.trim();

      if (!hasFfmpeg()) {
        if (subtitleText.trim()) {
          const warning =
            "FFmpeg no encontrado: se conserva el preview, pero no se marca como final porque faltan subtitulos.";
          assets.logs.push(warning);
          ctx.log(warning);
        }
      } else {
        try {
          const result =
            config.rama === "heygen"
              ? captionVideo({ pieceId, videoPath: assets.videoPath, locucionText: subtitleText })
              : assemble({ pieceId, assets, locucionText: subtitleText, shots: content.escaleta });
          if (result) {
            assets.videoPath = result.path;
            finalReady = !subtitleText.trim() || result.subtitlesBurned;
            const duration = result.seconds ? ` (${result.seconds.toFixed(1)}s)` : "";
            const message = `Montaje FFmpeg completado con subtitulos${duration}.`;
            assets.logs.push(message);
            if (result.qcFrames) assets.logs.push("Frames de control de calidad generados.");
            ctx.log(message);
            applyBrandOutro({
              pieceId,
              logoPath: ctx.artifacts.logoPath as string | null | undefined,
              assets,
              log: ctx.log,
            });
          } else {
            assets.logs.push("Montaje omitido: no hay video util o no se pudo medir su duracion.");
          }
        } catch (error) {
          const warning = `Montaje FFmpeg no disponible: ${(error as Error).message}. Se conserva el preview actual.`;
          assets.logs.push(warning);
          ctx.log(warning);
        }
      }

      await prisma.contentPiece.update({
        where: { id: pieceId },
        data: {
          assets: JSON.stringify(assets),
          status: finalReady ? "listo" : "error",
          version: { increment: 1 },
        },
      });
      ctx.log(finalReady ? "Pieza lista para revision." : "Pieza conservada, pendiente de montaje con subtitulos.");
    },
  };

  return {
    requisito: "REQ-005",
    nodes: [input, extract, guion, media, voz, montaje],
    edges: [
      ["input", "extract"],
      ["extract", "guion"],
      ["guion", "media"],
      ["media", "voz"],
      ["voz", "montaje"],
    ],
  };
}

/** Reexport del tipo para consumidores que solo pinten los pasos. */
export type Req005Content = PieceContent;
