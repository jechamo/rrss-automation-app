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
import { fal, elevenlabs } from "@/core/media";
import { assemble } from "@/core/media/assemble";
import { hasFfmpeg } from "@/core/media/ffmpeg";
import type { PipelineDef, PipelineNode } from "./engine";

export const REQ006_NODES = [
  { id: "input", label: "Entrada" },
  { id: "grabacion", label: "Grabar app" },
  { id: "guion", label: "Guion (product-led)" },
  { id: "media", label: "Cortes B-roll" },
  { id: "voz", label: "Locucion" },
  { id: "montaje", label: "Montaje / listo" },
] as const;

const MAX_CLIPS = 6; // tope de cortes fal (control de coste)

/**
 * REQ-006: genera un video que muestra una FUNCIONALIDAD real de la propia app.
 * Graba la pantalla con Playwright (o el usuario sube el screencast) y la intercala
 * con cortes B-roll de fal.ai + locucion de ElevenLabs. Recibe el id de la ContentPiece.
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
      const assets: PieceAssets = { ...EMPTY_ASSETS };
      try {
        const prev = JSON.parse(piece.assets) as Partial<PieceAssets>;
        if (typeof prev.recordingPath === "string") assets.recordingPath = prev.recordingPath;
      } catch {
        /* assets vacios */
      }

      ctx.artifacts.dossier = dossier;
      ctx.artifacts.config = config;
      ctx.artifacts.demo = config.demo;
      ctx.artifacts.assets = assets;

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

      if (demo.grabacionModo === "manual") {
        if (assets.recordingPath) {
          ctx.log("Screencast subido a mano: se usa como grabacion de la app.");
        } else {
          ctx.log("Modo manual: sube el screencast en la pieza cuando la tengas (se intercalara luego).");
        }
        return;
      }

      // Modo auto: Playwright movil. Si falla (sin navegador), no rompe el pipeline:
      // se sigue con guion+cortes y se avisa para subir el video a mano.
      const login = demo.usarLogin ? getLogin(ctx.project.id) : null;
      if (demo.usarLogin && !login) {
        ctx.log("Login requerido pero sin credenciales guardadas; se graba sin autenticar.");
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
      const funcion: AppFuncion = {
        nombre: demo.funcion,
        descripcion: demo.funcion,
        url: demo.funcionUrl,
        pasos: demo.pasos,
        navSteps: demo.navSteps,
      };
      if (demo.videosPrevios) {
        ctx.log(
          `Ya hay ${demo.videosPrevios} video(s) de esta funcion: la IA buscara un angulo distinto.`,
        );
      }
      const content = await generateDemoGuion({
        dossier,
        funcion,
        plataforma: "youtube",
        previousCount: demo.videosPrevios,
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
      ctx.log(`Guion product-led generado (${content.escaleta.length} planos).`);
    },
  };

  const media: PipelineNode = {
    id: "media",
    label: "Cortes B-roll",
    run: async (ctx) => {
      const config = ctx.artifacts.config as MediaConfig;
      const content = ctx.artifacts.content as PieceContent;
      const assets = ctx.artifacts.assets as PieceAssets;

      // Solo los planos con prompt (b-roll) se generan; los de grabacion de pantalla no.
      const shots = content.escaleta.filter((s) => s.prompt.trim()).slice(0, MAX_CLIPS);
      if (shots.length === 0) {
        ctx.log("El guion no tiene cortes b-roll; el video sera solo grabacion de pantalla.");
      } else {
        const model = config.videoAuto ? fal.autoModel() : config.videoModelo;
        for (const shot of shots) {
          ctx.log(`fal.ai: generando corte ${shot.n}…`);
          const clip = await fal.generateClip({
            pieceId,
            index: shot.n,
            prompt: shot.prompt,
            model,
            seconds: shot.segundos,
          });
          assets.clips.push(clip);
        }
        ctx.log(`fal.ai: ${assets.clips.length} cortes b-roll generados.`);
      }
      // Preview del video: la grabacion de la app si existe, si no el primer corte.
      assets.videoPath = assets.recordingPath || assets.clips[0] || "";
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
      const assets = ctx.artifacts.assets as PieceAssets;
      const content = ctx.artifacts.content as PieceContent;

      if (!assets.recordingPath) {
        assets.logs.push("Falta la grabacion de la app: subela a mano para completar el montaje.");
      }

      if (!hasFfmpeg()) {
        const warning =
          "FFmpeg no encontrado: instala con 'winget install ffmpeg' y pulsa Regenerar. Se conserva el preview actual.";
        assets.logs.push(warning);
        ctx.log(warning);
      } else {
        try {
          const result = assemble({
            pieceId,
            assets,
            locucionText: content.guion.locucion || content.guion.desarrollo,
            shots: content.escaleta,
          });
          if (result) {
            assets.videoPath = result.path;
            const duration = result.seconds ? ` (${result.seconds.toFixed(1)}s)` : "";
            const message = `Montaje FFmpeg completado${duration}.`;
            assets.logs.push(message);
            if (!result.subtitlesBurned) {
              assets.logs.push(
                "FFmpeg no pudo quemar subtitulos (falta soporte libass); se genero el video sin ellos.",
              );
            }
            if (result.qcFrames) assets.logs.push("Frames de control de calidad generados.");
            ctx.log(message);
          } else {
            assets.logs.push("Montaje omitido: no hay videos utilizables; se conserva el preview actual.");
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
          status: "listo",
          version: { increment: 1 },
        },
      });
      ctx.log("Pieza lista para revision.");
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
