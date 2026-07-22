import { prisma } from "@/lib/prisma";
import { coerceDossier, type Dossier } from "@/core/dossier/types";
import {
  coerceConfig,
  EMPTY_ASSETS,
  type DemoConfig,
  type MediaConfig,
  type PieceAssets,
  type PieceContent,
} from "@/core/content/types";
import { generateDemoGuion, type AppFuncion } from "@/core/content/demo";
import { recordDemo } from "@/core/media/recorder";
import { getLogin } from "@/core/secrets/login";
import { fal, heygen, elevenlabs } from "@/core/media";
import { assemble, assemblePresenterDemo, captionVideo } from "@/core/media/assemble";
import { ffprobeDuration, hasFfmpeg } from "@/core/media/ffmpeg";
import { applyBrandOutro } from "@/core/media/brand-outro";
import { assetAbsPath } from "@/core/media/storage";
import { friendlyProviderFailure } from "@/core/media/contracts";
import { effectiveClipLimit } from "@/core/media/planning";
import type { PipelineDef, PipelineNode } from "./engine";

export const REQ006_NODES = [
  { id: "input", label: "Entrada" },
  { id: "grabacion", label: "Grabar app" },
  { id: "guion", label: "Guion (product-led)" },
  { id: "media", label: "Generar video" },
  { id: "voz", label: "Locucion" },
  { id: "montaje", label: "Montaje / listo" },
] as const;

const MAX_CLIPS = 6; // tope de cortes fal (control de coste)

/**
 * REQ-006: genera un video que muestra una FUNCIONALIDAD real de la propia app.
 * Graba la pantalla con Playwright (o el usuario sube el screencast) y la intercala
 * con video generativo + locucion, o con un avatar presentador de HeyGen.
 * Recibe el id de la ContentPiece.
 */
export function buildReq006Pipeline(pieceId: string): PipelineDef {
  const input: PipelineNode = {
    id: "input",
    label: "Entrada",
    run: async (ctx) => {
      const piece = await prisma.contentPiece.findUnique({ where: { id: pieceId } });
      if (!piece) throw new Error("Pieza de contenido no encontrada.");

      const dossierRow = await prisma.dossier.findUnique({ where: { projectId: ctx.project.id } });
      if (!dossierRow) throw new Error("Genera primero el dossier (REQ-001).");
      const dossier = coerceDossier(JSON.parse(dossierRow.content));

      const config = coerceConfig(JSON.parse(piece.config));
      if (!config.demo) throw new Error("Falta la configuracion de la demo (funcionalidad a mostrar).");

      // Si la pieza ya trae un screencast subido (modo manual), lo conservamos.
      const assets: PieceAssets = { ...EMPTY_ASSETS, clips: [], logs: [] };
      try {
        const prev = JSON.parse(piece.assets) as Partial<PieceAssets>;
        if (typeof prev.recordingPath === "string") assets.recordingPath = prev.recordingPath;
      } catch {
        /* assets vacios */
      }
      if (config.demo.recordingAssetId) {
        const media = await prisma.mediaAsset.findFirst({
          where: {
            id: config.demo.recordingAssetId,
            projectId: ctx.project.id,
            kind: { in: ["recording", "video", "clip"] },
          },
        });
        if (!media) throw new Error("La grabacion elegida ya no existe en la mediateca.");
        assets.recordingPath = media.path;
      }

      ctx.artifacts.dossier = dossier;
      ctx.artifacts.config = config;
      ctx.artifacts.demo = config.demo;
      ctx.artifacts.assets = assets;
      ctx.artifacts.logoPath = (await prisma.project.findUnique({
        where: { id: ctx.project.id },
        select: { logoPath: true },
      }))?.logoPath;

      await prisma.contentPiece.update({
        where: { id: pieceId },
        data: { status: "generando", runId: ctx.runId },
      });
      ctx.log(`Preparando demo de: ${config.demo.funcion || "funcionalidad de la app"}`);
    },
  };

  const grabacion: PipelineNode = {
    id: "grabacion",
    label: "Grabar app",
    run: async (ctx) => {
      const demo = ctx.artifacts.demo as DemoConfig;
      const assets = ctx.artifacts.assets as PieceAssets;

      if (demo.grabacionModo === "manual" || demo.grabacionModo === "library") {
        if (assets.recordingPath) {
          ctx.log("Grabacion manual/mediateca: se usa como video real de la app.");
        } else {
          ctx.log("Modo manual: sube el screencast en la pieza cuando la tengas (se intercalara luego).");
        }
        return;
      }

      // Modo auto: Playwright movil. Si falla (sin navegador), no rompe el pipeline:
      // se sigue con guion+cortes y se avisa para subir el video a mano.
      const login = demo.usarLogin ? getLogin(ctx.project.id) : null;
      if (demo.usarLogin && !login) {
        const message = "Login requerido pero sin credenciales guardadas; no se intenta una grabación anónima.";
        assets.logs.push(message);
        ctx.log(`${message} Podrás subir el vídeo a mano.`);
        ctx.artifacts.assets = assets;
        return;
      }
      const url = demo.funcionUrl || ctx.project.url;
      try {
        const rel = await recordDemo({
          projectId: ctx.project.id,
          pieceId,
          url,
          pasos: demo.pasos,
          navSteps: demo.navSteps,
          login,
          log: ctx.log,
        });
        assets.recordingPath = rel;
        await prisma.contentPiece.update({
          where: { id: pieceId },
          data: { assets: JSON.stringify(assets) },
        });
      } catch (e) {
        assets.logs.push(`Grabacion automatica no disponible: ${(e as Error).message}`);
        ctx.log(`Grabacion automatica no disponible (${(e as Error).message}). Podras subir el video a mano.`);
      }
      ctx.artifacts.assets = assets;
    },
  };

  const guion: PipelineNode = {
    id: "guion",
    label: "Guion (product-led)",
    run: async (ctx) => {
      const dossier = ctx.artifacts.dossier as Dossier;
      const demo = ctx.artifacts.demo as DemoConfig;
      const config = ctx.artifacts.config as MediaConfig;
      const funcion: AppFuncion = {
        nombre: demo.funcion,
        descripcion: demo.funcionDescripcion || demo.funcion,
        url: demo.funcionUrl,
        pasos: demo.pasos,
        navSteps: demo.navSteps,
        evidencias: demo.funcionEvidencias,
        confianza: demo.funcionConfianza,
      };
      if (demo.videosPrevios) {
        ctx.log(
          `Ya hay ${demo.videosPrevios} video(s) de esta funcion: la IA buscara un angulo distinto.`,
        );
      }
      const content = config.rama === "fal" && config.falPromptReview
        ? config.falPromptReview.content
        : await generateDemoGuion({
            dossier,
            funcion,
            plataforma: "youtube",
            previousCount: demo.videosPrevios,
            clipCount: effectiveClipLimit(config),
          });
      ctx.artifacts.content = content;
      await prisma.contentPiece.update({
        where: { id: pieceId },
        data: {
          content: JSON.stringify(content),
          titulo: content.guion.gancho.slice(0, 80) || demo.funcion,
          plataforma: content.plataforma,
        },
      });
      ctx.log(
        config.rama === "fal" && config.falPromptReview
          ? `Guion product-led y prompts aprobados por el usuario (${content.escaleta.length} planos).`
          : `Guion product-led generado (${content.escaleta.length} planos).`,
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
        const presenter = await heygen.generateAvatarVideo({
          pieceId,
          avatarId: heygenConfig.avatarId,
          outName: "presenter.mp4",
          voiceId: useUploadedAudio ? undefined : heygenConfig.voiceId,
          texto: useUploadedAudio
            ? undefined
            : content.guion.locucion || content.guion.desarrollo,
          audioAssetId: useUploadedAudio ? heygenConfig.audioAssetId : undefined,
        });
        assets.presenterPath = presenter;
        assets.videoPath = presenter;
        ctx.log(
          useUploadedAudio
            ? "Presentador generado con el audio subido."
            : "Presentador generado con la voz elegida.",
        );
      } else {
        // Solo los planos con prompt se generan; los de grabacion de pantalla no.
        const shots = content.escaleta
          .filter((s) => s.prompt.trim())
          .slice(0, Math.min(MAX_CLIPS, effectiveClipLimit(config, content.escaleta)));
        if (shots.length === 0) {
          ctx.log("El guion no tiene cortes de apoyo; el video sera solo grabacion de pantalla.");
        } else {
          const model = config.videoAuto ? fal.autoModel() : config.videoModelo;
          for (const shot of shots) {
            const manifestIndex = assets.clipManifest.length;
            assets.clipManifest.push({
              shot: shot.n,
              description: shot.descripcion,
              prompt: shot.prompt,
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
            ctx.log(`Generando corte ${shot.n}…`);
            try {
              const clip = await fal.generateClip({
                pieceId,
                index: shot.n,
                prompt: shot.prompt,
                model,
                seconds: config.falClipSeconds,
                log: ctx.log,
              });
              assets.clips.push(clip);
              assets.videoPath ||= assets.recordingPath || clip;
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
          ctx.log(`${assets.clips.length} cortes de apoyo generados.`);
        }
        // Preview: grabacion si existe, si no el primer corte.
        assets.videoPath = assets.recordingPath || assets.clips[0] || "";
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

      if (config.rama === "heygen") {
        ctx.log("La narracion ya esta incluida en el video del presentador.");
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

      if (!assets.recordingPath) {
        const message =
          config.rama === "heygen"
            ? "No hay grabacion de la app: se conserva el presentador completo."
            : "Falta la grabacion de la app: subela a mano para completar el montaje.";
        assets.logs.push(message);
        ctx.log(message);
      }
      if (!hasFfmpeg()) {
        const warning =
          "FFmpeg no encontrado: se conserva el preview, pero no se marca como final porque faltan subtitulos.";
        assets.logs.push(warning);
        ctx.log(warning);
      } else {
        try {
          const result =
            config.rama === "heygen" && assets.recordingPath
              ? assemblePresenterDemo({
                  pieceId,
                  presenterPath: assets.presenterPath || assets.videoPath,
                  recordingPath: assets.recordingPath,
                  locucionText: content.guion.locucion || content.guion.desarrollo,
                  // REQ-011: cualquier salida con voz lleva subtitulos. Para audio
                  // propio el texto del guion actua como transcripcion editable.
                  burnSubtitles: true,
                })
              : config.rama === "heygen"
                ? captionVideo({
                    pieceId,
                    videoPath: assets.presenterPath || assets.videoPath,
                    locucionText: subtitleText,
                  })
                : assemble({
                  pieceId,
                  assets,
                  locucionText: subtitleText,
                  shots: content.escaleta,
                });
          if (result) {
            assets.videoPath = result.path;
            finalReady = !subtitleText.trim() || result.subtitlesBurned;
            const duration = result.seconds ? ` (${result.seconds.toFixed(1)}s)` : "";
            const message =
              config.rama === "heygen"
                ? `Presentador y grabacion montados${duration}.`
                : `Montaje FFmpeg completado${duration}.`;
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
            assets.logs.push("Montaje omitido: se conserva el video actual.");
          }
        } catch (error) {
          const warning = `Montaje FFmpeg no disponible: ${(error as Error).message}. Se conserva el video actual.`;
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
    requisito: "REQ-006",
    nodes: [input, grabacion, guion, media, voz, montaje],
    edges: [
      ["input", "grabacion"],
      ["grabacion", "guion"],
      ["guion", "media"],
      ["media", "voz"],
      ["voz", "montaje"],
    ],
  };
}
