"use client";

import { useState } from "react";
import { DEFAULT_CONFIG, EMPTY_HEYGEN, type MediaConfig } from "@/core/content/types";
import {
  MediaProviderConfigurator,
  mediaProviderError,
} from "@/components/MediaProviderConfigurator";
import { VisualPlanCard } from "@/components/VisualPlanCard";
import { buildVisualPlan } from "@/core/media/planning";

type ViralPick = { url: string; titulo: string; plataforma: string };

export function GenerateContentModal({
  virales,
  initialUrl,
  onClose,
  onGenerate,
  busy,
}: {
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

  function submit() {
    if (!sourceUrl) return;
    const config = { ...mediaConfig, usarGemini };
    const plan = buildVisualPlan({ config, origin: "viral" });
    onGenerate(sourceUrl, { ...config, falClipCount: plan.clipCount });
  }

  const providerError = mediaProviderError(mediaConfig) ||
    (mediaConfig.rama === "fal" && mediaConfig.falClipMode === "manual" && mediaConfig.falClipCount === 0
      ? "Para reinterpretar un viral con fal.ai necesitas al menos un corte."
      : "");

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
              disabled={busy || !sourceUrl || Boolean(providerError)}
              className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
            >
              {busy ? "Lanzando…" : "Aprobar plan y generar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
