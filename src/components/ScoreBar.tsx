"use client";

// Barra de scoring animada (rellena su ancho al montar). Usada por leads
// (fit/intent 1-5), virales (viralScore 0-100, ratioAutor) y competidores.
export function ScoreBar({
  label,
  value,
  max = 5,
  color = "var(--color-accent-2)",
  suffix,
}: {
  label: string;
  value: number;
  max?: number;
  color?: string;
  suffix?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[10px] text-white/50">
        <span>{label}</span>
        <span className="font-mono text-white/70">
          {Number.isInteger(value) ? value : value.toFixed(1)}
          {suffix ?? (max === 5 ? "/5" : max === 100 ? "" : `/${max}`)}
        </span>
      </div>
      <div className="score-bar">
        <div
          className="score-fill"
          style={{ ["--to" as string]: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
