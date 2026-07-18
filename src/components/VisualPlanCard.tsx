"use client";

import { useMemo } from "react";
import type { MediaConfig, NavStep } from "@/core/content/types";
import { buildVisualPlan } from "@/core/media/planning";
import { estimatePieceCost, formatCostRange } from "@/core/media/pricing";

export function VisualPlanCard({
  config,
  origin,
  recordingSeconds,
  navSteps,
  usarGemini = false,
}: {
  config: MediaConfig;
  origin: "viral" | "own";
  recordingSeconds?: number | null;
  navSteps?: NavStep[];
  usarGemini?: boolean;
}) {
  const plan = useMemo(
    () => buildVisualPlan({ config, origin, recordingSeconds, navSteps }),
    [config, navSteps, origin, recordingSeconds],
  );
  const cost = useMemo(
    () => estimatePieceCost(config, {
      clipSeconds: config.falClipSeconds,
      clipCount: plan.clipCount,
      usarGemini,
    }),
    [config, plan.clipCount, usarGemini],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04]">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Plan de montaje</div>
          <div className="mt-1 text-xs text-white/55">
            {plan.estimated ? "Estimación previa; se afina con los recursos reales." : "Calculado con la grabación real."}
          </div>
        </div>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] text-cyan-200">
          {config.falClipMode === "manual" ? "Manual" : "Auto"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
        {[
          ["Objetivo", `${Math.round(plan.targetSeconds)} s`],
          ["Demo protegida", origin === "own" ? `≈ ${Math.round(plan.protectedDemoSeconds)} s` : "—"],
          ["Apoyo visual", `≈ ${Math.round(plan.brollSeconds)} s`],
          ["Cortes fal.ai", String(plan.clipCount)],
        ].map(([label, value]) => (
          <div key={label} className="bg-[#11131b] px-3 py-2.5">
            <div className="text-[9px] uppercase tracking-wide text-white/30">{label}</div>
            <div className="mt-0.5 text-sm font-semibold text-white/80">{value}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[11px]">
        <span className="text-white/45">
          {plan.clipCount > 0
            ? `${plan.clipCount} × ${plan.requestedClipSeconds}s = ${plan.generatedSeconds}s solicitados`
            : "Sin consumo de vídeo generativo"}
        </span>
        <strong className="text-emerald-300">{formatCostRange(cost.totalMin, cost.totalMax)}</strong>
      </div>
      {plan.warnings.map((warning) => (
        <div key={warning} className="border-t border-amber-300/10 px-4 py-2 text-[10px] text-amber-200/70">
          {warning}
        </div>
      ))}
    </section>
  );
}
