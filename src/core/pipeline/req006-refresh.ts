import fs from "node:fs";
import { prisma } from "@/lib/prisma";
import {
  coerceAssets,
  coerceConfig,
  coerceContent,
  type DemoConfig,
  type MediaConfig,
  type PieceAssets,
  type PieceContent,
} from "@/core/content/types";
import { remountOwnPiece } from "@/core/content/remount";
import { recordDemo } from "@/core/media/recorder";
import { pieceDir } from "@/core/media/storage";
import { registerMediaAsset } from "@/core/media/library";
import { applyBrandOutro } from "@/core/media/brand-outro";
import { getLogin } from "@/core/secrets/login";
import type { PipelineDef, PipelineNode } from "./engine";

export type NavigationRefreshMode = "auto" | "existing";

export const REQ006_REFRESH_NODES = [
  { id: "input", label: "Reutilizar recursos" },
  { id: "navigation", label: "Navegación" },
  { id: "montage", label: "Remontar sin créditos" },
] as const;

/** Pipeline aditiva: nunca importa conectores de vídeo, voz o avatar. */
export function buildReq006RefreshPipeline(
  pieceId: string,
  mode: NavigationRefreshMode,
): PipelineDef {
  const input: PipelineNode = {
    id: "input",
    label: "Reutilizar recursos",
    run: async (ctx) => {
      const piece = await prisma.contentPiece.findFirst({ where: { id: pieceId, projectId: ctx.project.id } });
      if (!piece || piece.origin !== "own") throw new Error("La pieza propia no existe.");
      const config = coerceConfig(JSON.parse(piece.config || "{}"));
      const content = coerceContent(JSON.parse(piece.content || "{}"));
      const assets = coerceAssets(JSON.parse(piece.assets || "{}"));
      if (!config.demo) throw new Error("La pieza no conserva la configuración de navegación.");

      ctx.artifacts.config = config;
      ctx.artifacts.content = content;
      ctx.artifacts.assets = assets;
      ctx.artifacts.demo = config.demo;
      await prisma.contentPiece.update({ where: { id: pieceId }, data: { status: "generando", runId: ctx.runId } });

      const reusable = [
        assets.clips.length ? `${assets.clips.length} vídeo(s) fal.ai` : "",
        assets.audioPath ? "locución existente" : "",
        assets.presenterPath ? "presentador HeyGen existente" : "",
      ].filter(Boolean);
      ctx.log(`Recursos reutilizados: ${reusable.join(", ") || "grabación y guion existentes"}.`);
      ctx.log("No se realizarán llamadas a fal.ai, ElevenLabs ni HeyGen.");
    },
  };

  const navigation: PipelineNode = {
    id: "navigation",
    label: "Navegación",
    run: async (ctx) => {
      const config = ctx.artifacts.config as MediaConfig;
      const demo = ctx.artifacts.demo as DemoConfig;
      const assets = ctx.artifacts.assets as PieceAssets;

      if (mode === "existing") {
        if (!assets.recordingPath) {
          throw new Error("Sube, graba o elige primero una navegación desde la mediateca.");
        }
        ctx.log("Se conserva la navegación manual o de mediateca seleccionada.");
        return;
      }

      if (!demo.navSteps?.length) {
        throw new Error("Esta pieza no tiene pasos automáticos. Analiza la función de nuevo o usa una grabación manual.");
      }
      const login = demo.usarLogin ? getLogin(ctx.project.id) : null;
      if (demo.usarLogin && !login) throw new Error("Faltan las credenciales cifradas requeridas por la navegación.");

      const validationId = `refresh-${pieceId}-${Date.now()}`;
      const validationDir = pieceDir(validationId);
      let resolvedSteps = demo.navSteps;
      try {
        ctx.log("Validando y reparando el recorrido antes de grabar…");
        await recordDemo({
          projectId: ctx.project.id,
          pieceId: validationId,
          url: demo.funcionUrl || ctx.project.url,
          pasos: demo.pasos,
          navSteps: resolvedSteps,
          login,
          log: ctx.log,
          dryRun: true,
          onResolvedSteps: (steps) => {
            resolvedSteps = steps;
          },
        });
      } finally {
        fs.rmSync(validationDir, { recursive: true, force: true });
      }

      const suffix = `nav-${Date.now()}`;
      const recordingPath = await recordDemo({
        projectId: ctx.project.id,
        pieceId,
        url: demo.funcionUrl || ctx.project.url,
        pasos: demo.pasos,
        navSteps: resolvedSteps,
        login,
        log: ctx.log,
        outputSuffix: suffix,
        onResolvedSteps: (steps) => {
          resolvedSteps = steps;
        },
      });
      demo.navSteps = resolvedSteps;
      config.demo = demo;
      assets.recordingPath = recordingPath;
      assets.logs.push("Navegación automática regenerada y validada; recursos de proveedores conservados.");
      ctx.artifacts.assets = assets;

      await prisma.contentPiece.update({
        where: { id: pieceId },
        data: { config: JSON.stringify(config), assets: JSON.stringify(assets) },
      });
      await registerMediaAsset({
        projectId: ctx.project.id,
        pieceId,
        kind: "recording",
        origin: "playwright",
        name: `Navegación regenerada · ${demo.funcion}`,
        path: recordingPath,
      });
    },
  };

  const montage: PipelineNode = {
    id: "montage",
    label: "Remontar sin créditos",
    run: async (ctx) => {
      const config = ctx.artifacts.config as MediaConfig;
      const content = ctx.artifacts.content as PieceContent;
      const assets = ctx.artifacts.assets as PieceAssets;
      const result = remountOwnPiece({ pieceId, config, content, assets, log: ctx.log });
      const logoPath = (await prisma.project.findUnique({
        where: { id: ctx.project.id },
        select: { logoPath: true },
      }))?.logoPath;
      applyBrandOutro({ pieceId, logoPath, assets: result.assets, log: ctx.log });
      await prisma.contentPiece.update({
        where: { id: pieceId },
        data: {
          config: JSON.stringify(config),
          assets: JSON.stringify(result.assets),
          status: result.finalReady ? "listo" : "error",
          version: { increment: 1 },
        },
      });
      await registerMediaAsset({
        projectId: ctx.project.id,
        pieceId,
        kind: "final",
        origin: "mix",
        name: `Remontaje · ${demoTitle(config)}`,
        path: result.assets.videoPath,
      });
    },
  };

  return {
    requisito: "REQ-006-NAV",
    nodes: [input, navigation, montage],
    edges: [["input", "navigation"], ["navigation", "montage"]],
  };
}

function demoTitle(config: MediaConfig): string {
  return config.demo?.funcion || "Contenido propio";
}
