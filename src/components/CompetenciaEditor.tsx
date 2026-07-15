"use client";

import { useState } from "react";
import type { Competencia, Competidor } from "@/core/competencia/types";

const EMPTY_COMPETIDOR: Competidor = {
  nombre: "",
  url: "",
  propuestaValor: "",
  precios: "",
  pros: [],
  contras: [],
  diferenciadores: "",
  origen: "manual",
};

export function CompetenciaEditor({
  initial,
  status,
  onSave,
  onRegenerate,
  saving,
  regenerating,
}: {
  initial: Competencia;
  status: string;
  onSave: (c: Competencia, approve: boolean) => Promise<void>;
  onRegenerate: () => void;
  saving: boolean;
  regenerating: boolean;
}) {
  const [c, setC] = useState<Competencia>(initial);
  const approved = status === "approved";

  const set = <K extends keyof Competencia>(k: K, v: Competencia[K]) =>
    setC((p) => ({ ...p, [k]: v }));

  const setCompetidor = (i: number, patch: Partial<Competidor>) =>
    setC((p) => ({
      ...p,
      competidores: p.competidores.map((x, idx) => (idx === i ? { ...x, ...patch } : x)),
    }));
  const removeCompetidor = (i: number) =>
    setC((p) => ({ ...p, competidores: p.competidores.filter((_, idx) => idx !== i) }));
  const addCompetidor = () =>
    setC((p) => ({ ...p, competidores: [...p.competidores, { ...EMPTY_COMPETIDOR }] }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">Análisis de competencia</h2>
          <span
            className={[
              "rounded-full px-2 py-0.5 text-xs",
              approved
                ? "bg-[var(--color-state-ok)]/20 text-[var(--color-state-ok)]"
                : "bg-white/10 text-white/60",
            ].join(" ")}
          >
            {approved ? "Aprobado" : "Borrador"}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            {regenerating ? "Regenerando…" : "Regenerar con IA"}
          </button>
          <button
            onClick={() => onSave(c, false)}
            disabled={saving}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            onClick={() => onSave(c, true)}
            disabled={saving}
            className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
          >
            Aprobar
          </button>
        </div>
      </div>

      <TextField label="Resumen del panorama competitivo" value={c.resumen} onChange={(v) => set("resumen", v)} />

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/60">Competidores ({c.competidores.length})</div>
        <button onClick={addCompetidor} className="text-xs text-[var(--color-accent-2)] hover:underline">
          + Añadir competidor
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {c.competidores.length === 0 && (
          <div className="glass p-4 text-xs text-white/40">Sin competidores. Añade uno o regenera con IA.</div>
        )}
        {c.competidores.map((comp, i) => (
          <div key={i} className="glass p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  className="input font-semibold"
                  value={comp.nombre}
                  placeholder="Nombre del competidor"
                  onChange={(e) => setCompetidor(i, { nombre: e.target.value })}
                />
                {comp.origen === "manual" && (
                  <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">manual</span>
                )}
              </div>
              <button
                onClick={() => removeCompetidor(i)}
                className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-xs text-white/50 hover:bg-white/5"
              >
                ✕ Quitar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InlineField label="URL" value={comp.url} onChange={(v) => setCompetidor(i, { url: v })} />
              <InlineField label="Precios" value={comp.precios} onChange={(v) => setCompetidor(i, { precios: v })} />
              <div className="md:col-span-2">
                <TextField
                  label="Propuesta de valor"
                  value={comp.propuestaValor}
                  onChange={(v) => setCompetidor(i, { propuestaValor: v })}
                />
              </div>
              <ListField label="Pros" values={comp.pros} onChange={(v) => setCompetidor(i, { pros: v })} />
              <ListField label="Contras" values={comp.contras} onChange={(v) => setCompetidor(i, { contras: v })} />
              <div className="md:col-span-2">
                <TextField
                  label="Diferenciadores (vs. nuestro proyecto)"
                  value={comp.diferenciadores}
                  onChange={(v) => setCompetidor(i, { diferenciadores: v })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ListField label="Nuestras ventajas" values={c.ventajas} onChange={(v) => set("ventajas", v)} />
        <ListField label="Amenazas" values={c.amenazas} onChange={(v) => set("amenazas", v)} />
        <ListField label="Oportunidades" values={c.oportunidades} onChange={(v) => set("oportunidades", v)} />
      </div>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="glass p-4">
      <div className="mb-2 text-sm font-semibold">{label}</div>
      <textarea
        className="input min-h-[70px] resize-y"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function InlineField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/50">{label}</span>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function ListField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const update = (i: number, v: string) => onChange(values.map((x, idx) => (idx === i ? v : x)));
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));
  const add = () => onChange([...values, ""]);

  return (
    <div className="glass p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">{label}</div>
        <button onClick={add} className="text-xs text-[var(--color-accent-2)] hover:underline">
          + Añadir
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {values.length === 0 && <div className="text-xs text-white/30">Sin elementos.</div>}
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className="input" value={v} onChange={(e) => update(i, e.target.value)} />
            <button
              onClick={() => remove(i)}
              className="shrink-0 rounded-lg border border-white/10 px-2 py-2 text-xs text-white/50 hover:bg-white/5"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
