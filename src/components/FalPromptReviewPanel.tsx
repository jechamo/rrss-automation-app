"use client";

import type { PieceContent } from "@/core/content/types";

export function FalPromptReviewPanel({
  content,
  promptIndexes,
  onChange,
  onPrepare,
  loading,
  error,
  stale = false,
  disabled = false,
}: {
  content: PieceContent | null;
  promptIndexes: number[];
  onChange: (content: PieceContent) => void;
  onPrepare: () => void;
  loading: boolean;
  error: string;
  stale?: boolean;
  disabled?: boolean;
}) {
  const promptShots = content
    ? promptIndexes
        .map((index) => ({ shot: content.escaleta[index], index }))
        .filter(({ shot }) => Boolean(shot))
    : [];
  const promptsComplete = promptShots.every(({ shot }) => Boolean(shot.prompt.trim()));

  function updatePrompt(index: number, prompt: string) {
    if (!content) return;
    onChange({
      ...content,
      escaleta: content.escaleta.map((shot, shotIndex) =>
        shotIndex === index ? { ...shot, prompt } : shot,
      ),
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-400/25 bg-violet-400/[0.05]">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">
              Revisión antes de fal.ai
            </div>
            <p className="mt-1 text-[11px] text-white/50">
              La IA prepara el guion y los prompts, pero no se genera ningún vídeo hasta que los apruebes.
            </p>
          </div>
          {content && !stale && promptsComplete && (
            <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[9px] text-emerald-200">
              Listos para aprobar
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        {!content ? (
          <p className="text-xs text-white/45">
            Primero genera la propuesta. Podrás modificar cada prompt antes de autorizar el coste.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/15 p-3">
              <div className="text-[9px] uppercase tracking-wide text-white/30">Hook y duración</div>
              <div className="mt-1 text-xs font-medium text-white/75">{content.guion.gancho}</div>
              <div className="mt-1 text-[10px] text-white/40">≈ {content.guion.duracionTotal}s · {promptShots.length} prompts generativos</div>
            </div>
            {promptShots.map(({ shot, index }, position) => (
              <label key={`${shot.n}-${index}`} className="block rounded-xl border border-white/10 bg-black/15 p-3">
                <span className="flex items-center justify-between gap-2 text-[10px]">
                  <b className="text-violet-200">Corte {position + 1}</b>
                  <span className="text-white/35">plano {shot.n} · ≈ {shot.segundos}s</span>
                </span>
                <span className="mt-1 block text-[11px] text-white/50">{shot.descripcion}</span>
                <textarea
                  className="input mt-2 min-h-24 font-mono text-[11px] leading-relaxed"
                  value={shot.prompt}
                  onChange={(event) => updatePrompt(index, event.target.value)}
                  disabled={disabled}
                  aria-label={`Prompt fal.ai del corte ${position + 1}`}
                />
              </label>
            ))}
            {stale && (
              <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-2 text-[10px] text-amber-200/75">
                Has cambiado el viral, la funcionalidad o el plan visual. Prepara de nuevo los prompts.
              </div>
            )}
            {!stale && !promptsComplete && (
              <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-2 text-[10px] text-amber-200/75">
                Ningún prompt puede quedar vacío antes de aprobar el render.
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-[var(--color-state-error)]">{error}</p>}
        <button
          type="button"
          onClick={onPrepare}
          disabled={disabled || loading}
          className="mt-3 w-full rounded-lg border border-violet-400/40 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-400/15 disabled:opacity-40"
        >
          {loading ? "Preparando guion y prompts…" : content ? "Volver a preparar con IA" : "Preparar guion y prompts"}
        </button>
      </div>
    </section>
  );
}
