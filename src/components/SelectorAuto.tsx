"use client";

// Selector "auto o de la lista" reutilizable por los modales de generación
// (REQ-005 clonar viral, REQ-006 contenido propio). Con "Auto" marcado, el
// proveedor decide (modelo/voz por defecto); si no, se elige de la lista que
// devuelve `GET /api/providers/:provider/options?kind=…`.

export type Option = { id: string; label: string; hint?: string; preview?: string };

export async function loadOptions(
  provider: string,
  kind: string,
): Promise<{ options: Option[]; error?: string }> {
  try {
    const r = await fetch(`/api/providers/${provider}/options?kind=${kind}`);
    if (!r.ok) return { options: [], error: `HTTP ${r.status}` };
    return (await r.json()) as { options: Option[]; error?: string };
  } catch (e) {
    return { options: [], error: (e as Error).message };
  }
}

export function SelectorAuto({
  label,
  auto,
  setAuto,
  value,
  setValue,
  options,
  autoHint,
}: {
  label: string;
  auto: boolean;
  setAuto: (v: boolean) => void;
  value: string;
  setValue: (v: string) => void;
  options: Option[];
  autoHint: string;
}) {
  return (
    <div className="block">
      <span className="mb-1 block text-xs text-white/50">{label}</span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          Auto
        </label>
        <select
          className="input flex-1 disabled:opacity-40"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={auto}
        >
          <option value="">{auto ? autoHint : "— elige —"}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
              {o.hint ? ` · ${o.hint}` : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
