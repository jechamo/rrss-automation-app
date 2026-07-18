"use client";

import { useState } from "react";
import {
  coerceContent,
  DEFAULT_CONFIG,
  EMPTY_HEYGEN,
  type MediaConfig,
  type PieceContent,
} from "@/core/content/types";
import {
  MediaProviderConfigurator,
  mediaProviderError,
} from "@/components/MediaProviderConfigurator";
import { VisualPlanCard } from "@/components/VisualPlanCard";
import { buildVisualPlan } from "@/core/media/planning";
import { FalPromptReviewPanel } from "@/components/FalPromptReviewPanel";

type ViralPick = { url: string; titulo: string; plataforma: string };

export function GenerateContentModal({
  projectId,
  virales,
  initialUrl,
  onClose,
  onGenerate,
  busy,
}: {
  projectId: string;
  virales: ViralPick[];
  initialUrl?: string;
  onClose: () => void;
  onGenerate: (sourceUrl: string, config: MediaConfig) => void;
  busy: boolean;
}) {
  const [sourceUrl, setSourceUrl] = useState(initialUrl ?? virales[0]?.url ?? "");
  const [mediaConfig, setMediaConfig] = useState<MediaConfig>({
    ...DEFAULT_CONFIG,
    heygen: { ...EMPTY_HEYGEN },
  });
  const [usarGemini, setUsarGemini] = useState(false);
  const [promptContent, setPromptContent] = useState<PieceContent | null>(null);
  const [promptIndexes, setPromptIndexes] = useState<number[]>([]);
  const [promptSignature, setPromptSignature] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState("");

  function plannedConfig(): MediaConfig {
    const config = { ...mediaConfig, usarGemini };
    const plan = buildVisualPlan({ config, origin: "viral" });
    return { ...config, falClipCount: plan.clipCount, falPromptReview: undefined };
  }

  function currentPromptSignature(config = plannedConfig()): string {
    return JSON.stringify({
      sourceUrl,
      usarGemini: config.usarGemini,
      videoAuto: config.videoAuto,
      videoModelo: config.videoModelo,
      falClipSeconds: config.falClipSeconds,
      falClipMode: config.falClipMode,
      falClipCount: config.falClipCount,
    });
  }

  async function preparePrompts() {
    if (!sourceUrl || providerError) return;
    const config = plannedConfig();
    const signature = currentPromptSignature(config);
    setPromptLoading(true);
    setPromptError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/content/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl, config }),
      });
      const data = (await response.json()) as { content?: unknown; error?: string };
      if (!response.ok || !data.content) throw new Error(data.error || `HTTP ${response.status}`);
      const content = coerceContent(data.content);
      setPromptContent(content);
      setPromptIndexes(
        content.escaleta.flatMap((shot, index) => (shot.prompt.trim() ? [index] : [])),
      );
      setPromptSignature(signature);
    } catch (error) {
      setPromptError(error instanceof Error ? error.message : String(error));
    } finally {
      setPromptLoading(false);
    }
  }

  function submit() {
    if (!sourceUrl) return;
    const config = plannedConfig();
    if (config.rama === "fal") {
      if (!promptContent || promptSignature !== currentPromptSignature(config)) return;
      onGenerate(sourceUrl, {
        ...config,
        falPromptReview: { approvedAt: new Date().toISOString(), content: promptContent },
      });
      return;
    }
    onGenerate(sourceUrl, config);
  }

  const providerError = mediaProviderError(mediaConfig) ||
    (mediaConfig.rama === "fal" && mediaConfig.falClipMode === "manual" && mediaConfig.falClipCount === 0
      ? "Para reinterpretar un viral con fal.ai necesitas al menos un corte."
      : "");
  const promptsStale = Boolean(promptContent) && promptSignature !== currentPromptSignature();
  const promptsComplete = Boolean(promptContent) &&
    promptIndexes.length === plannedConfig().falClipCount &&
    promptIndexes.every((index) => Boolean(promptContent?.escaleta[index]?.prompt.trim()));
  const falReady = mediaConfig.rama !== "fal" || (promptsComplete && !promptsStale);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass max-h-[90vh] w-full max-w-lg overflow-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Generar contenido (clonar viral)</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 text-sm">
          <label className="block">
            <span className="mb-1 block text-xs text-white/50">Viral a reinterpretar</span>
            <select
              className="input"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            >
              {virales.map((v) => (
                <option key={v.url} value={v.url}>
                  [{v.plataforma}] {v.titulo || v.url}
                </option>
              ))}
            </select>
          </label>

          <MediaProviderConfigurator
            value={mediaConfig}
            onChange={setMediaConfig}
            disabled={busy}
            usarGemini={usarGemini}
          />

          <VisualPlanCard
            config={{ ...mediaConfig, usarGemini }}
            origin="viral"
            usarGemini={usarGemini}
          />

          {mediaConfig.rama === "fal" && (
            <FalPromptReviewPanel
              content={promptContent}
              promptIndexes={promptIndexes}
              onChange={setPromptContent}
              onPrepare={preparePrompts}
              loading={promptLoading}
              error={promptError}
              stale={promptsStale}
              disabled={busy || Boolean(providerError)}
            />
          )}

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={usarGemini}
              onChange={(e) => setUsarGemini(e.target.checked)}
            />
            <span className="text-xs text-white/70">
              Analizar el vídeo con Gemini (multimodal, opcional · requiere key)
              <span className="mt-0.5 block text-[10px] text-white/40">
                YouTube se analiza directo. TikTok/Instagram requieren yt-dlp instalado; si falta, se usan los datos de REQ-004.
              </span>
            </span>
          </label>

          {providerError && (
            <div className="text-xs text-[var(--color-state-pending)]">{providerError}</div>
          )}

          <div className="mt-1 rounded-lg bg-white/5 p-3 text-xs text-white/50">
            Se genera un guion <b>original</b> reinterpretando el concepto del viral (no copia). El
            render real usa tus keys de Ajustes; si falta alguna, el paso fallará y podrás reintentar.
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={busy || promptLoading || !sourceUrl || Boolean(providerError) || !falReady}
              className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
            >
              {busy
                ? "Lanzando…"
                : mediaConfig.rama === "fal"
                  ? "Aprobar prompts y generar"
                  : "Aprobar plan y generar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
