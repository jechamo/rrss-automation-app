"use client";

import { useState } from "react";

export type Dossier = {
  negocio: string;
  propuestaValor: string;
  marca: { tono: string; voz: string; identidad: string };
  ctas: string[];
  puntosDolor: string[];
  pros: string[];
  contras: string[];
  publicoObjetivo: string;
  funcionalidades: string[];
  nicho: string;
};

export function DossierEditor({
  initial,
  status,
  onSave,
  onRegenerate,
  saving,
  regenerating,
}: {
  initial: Dossier;
  status: string;
  onSave: (d: Dossier, approve: boolean) => Promise<void>;
  onRegenerate: () => void;
  saving: boolean;
  regenerating: boolean;
}) {
  const [d, setD] = useState<Dossier>(initial);
  const approved = status === "approved";

  const set = <K extends keyof Dossier>(k: K, v: Dossier[K]) => setD((p) => ({ ...p, [k]: v }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">Dossier de negocio</h2>
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
            onClick={() => onSave(d, false)}
            disabled={saving}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            onClick={() => onSave(d, true)}
            disabled={saving}
            className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
          >
            Aprobar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="Negocio" value={d.negocio} onChange={(v) => set("negocio", v)} />
        <TextField
          label="Propuesta de valor"
          value={d.propuestaValor}
          onChange={(v) => set("propuestaValor", v)}
        />
        <TextField
          label="Publico objetivo"
          value={d.publicoObjetivo}
          onChange={(v) => set("publicoObjetivo", v)}
        />
        <TextField label="Nicho / sector" value={d.nicho} onChange={(v) => set("nicho", v)} single />

        <div className="glass p-4 md:col-span-2">
          <div className="mb-2 text-sm font-semibold">Marca</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <InlineField label="Tono" value={d.marca.tono} onChange={(v) => set("marca", { ...d.marca, tono: v })} />
            <InlineField label="Voz" value={d.marca.voz} onChange={(v) => set("marca", { ...d.marca, voz: v })} />
            <InlineField
              label="Identidad"
              value={d.marca.identidad}
              onChange={(v) => set("marca", { ...d.marca, identidad: v })}
            />
          </div>
        </div>

        <ListField label="CTAs" values={d.ctas} onChange={(v) => set("ctas", v)} />
        <ListField label="Puntos de dolor" values={d.puntosDolor} onChange={(v) => set("puntosDolor", v)} />
        <ListField label="Pros" values={d.pros} onChange={(v) => set("pros", v)} />
        <ListField label="Contras" values={d.contras} onChange={(v) => set("contras", v)} />
        <div className="md:col-span-2">
          <ListField
            label="Funcionalidades"
            values={d.funcionalidades}
            onChange={(v) => set("funcionalidades", v)}
          />
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  single,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  single?: boolean;
}) {
  return (
    <div className="glass p-4">
      <div className="mb-2 text-sm font-semibold">{label}</div>
      {single ? (
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <textarea
          className="input min-h-[80px] resize-y"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
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
