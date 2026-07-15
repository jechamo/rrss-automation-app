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
      ctx.artifacts.assets = { ...EMPTY_ASSETS };

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
      const content = await generateGuion({ dossier, extract: ex, plataforma: viral.plataforma });
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
      ctx.log(`Guion original generado (${content.escaleta.length} planos).`);
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
        const path = await heygen.generateAvatarVideo({
          pieceId,
          avatarId: config.videoModelo, // en rama heygen, videoModelo = avatar_id
          voiceId: config.vozAuto ? "" : config.vozId,
          texto: content.guion.locucion || content.guion.desarrollo,
        });
        assets.videoPath = path;
        ctx.log("Video de avatar generado con HeyGen.");
      } else {
        const model = config.videoAuto ? fal.autoModel() : config.videoModelo;
        const shots = content.escaleta.slice(0, MAX_CLIPS);
        if (shots.length === 0) throw new Error("El guion no tiene planos para generar video.");
        for (const shot of shots) {
          ctx.log(`fal.ai: generando plano ${shot.n}/${shots.length}…`);
          const clip = await fal.generateClip({
            pieceId,
            index: shot.n,
            prompt: shot.prompt || shot.descripcion,
            model,
          });
          assets.clips.push(clip);
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

      // Montaje real (FFmpeg: unir cortes + locucion + subtitulos) queda para un
      // paso posterior (D-12). Por ahora se deja el material listo para revision.
      if (config.rama === "fal" && assets.clips.length > 1) {
        assets.logs.push(
          `Montaje pendiente: ${assets.clips.length} cortes + locucion listos para unir con FFmpeg.`,
        );
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
