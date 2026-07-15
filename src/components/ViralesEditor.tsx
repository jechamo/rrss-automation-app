"use client";

import { useState } from "react";
import {
  EMPTY_VIRAL,
  type PatronViral,
  type Plataforma,
  type Viral,
  type Virales,
} from "@/core/virales/types";

const PLATAFORMAS: Plataforma[] = ["youtube", "tiktok", "instagram"];

export function ViralesEditor({
  initial,
  status,
  onSave,
  onRegenerate,
  saving,
  regenerating,
}: {
  initial: Virales;
  status: string;
  onSave: (v: Virales, approve: boolean) => Promise<void>;
  onRegenerate: () => void;
  saving: boolean;
  regenerating: boolean;
}) {
  const [v, setV] = useState<Virales>(initial);
  const approved = status === "approved";

  const setViral = (i: number, patch: Partial<Viral>) =>
    setV((p) => ({ ...p, virales: p.virales.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) }));
  const removeViral = (i: number) =>
    setV((p) => ({ ...p, virales: p.virales.filter((_, idx) => idx !== i) }));
  const addViral = () => setV((p) => ({ ...p, virales: [...p.virales, { ...EMPTY_VIRAL }] }));

  const setPatron = (i: number, patch: Partial<PatronViral>) =>
    setV((p) => ({
      ...p,
      patronesRecurrentes: p.patronesRecurrentes.map((x, idx) => (idx === i ? { ...x, ...patch } : x)),
    }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">Top de virales del nicho</h2>
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
          <span className="text-xs text-white/40">
            {v.criterio.umbral} · ventana {v.criterio.ventanaDias > 0 ? `${v.criterio.ventanaDias}d` : "histórico"}
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
            onClick={() => onSave(v, false)}
            disabled={saving}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            onClick={() => onSave(v, true)}
            disabled={saving}
            className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
          >
            Aprobar
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/60">Virales ({v.virales.length})</div>
        <button onClick={addViral} className="text-xs text-[var(--color-accent-2)] hover:underline">
          + Añadir viral
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {v.virales.length === 0 && (
          <div className="glass p-4 text-xs text-white/40">Sin virales. Añade uno o regenera con IA.</div>
        )}
        {v.virales.map((viral, i) => (
          <div key={i} className="glass p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
                  #{i + 1}
                </span>
                <input
                  className="input font-semibold"
                  value={viral.titulo}
                  placeholder="Título del vídeo"
                  onChange={(e) => setViral(i, { titulo: e.target.value })}
                />
                {viral.origen === "manual" && (
                  <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">manual</span>
                )}
              </div>
              <button
                onClick={() => removeViral(i)}
                className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-xs text-white/50 hover:bg-white/5"
              >
                ✕ Quitar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <SelectField
                label="Plataforma"
                value={viral.plataforma}
                options={PLATAFORMAS}
                onChange={(val) => setViral(i, { plataforma: val as Plataforma })}
              />
              <InlineField label="Autor" value={viral.autor} onChange={(val) => setViral(i, { autor: val })} />
              <InlineField label="URL" value={viral.url} onChange={(val) => setViral(i, { url: val })} />
              <div className="grid grid-cols-2 gap-3">
                <InlineField label="Vistas" value={viral.vistas} onChange={(val) => setViral(i, { vistas: val })} />
                <InlineField label="Fecha" value={viral.fecha} onChange={(val) => setViral(i, { fecha: val })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InlineField label="Formato" value={viral.formato} onChange={(val) => setViral(i, { formato: val })} />
                <NumberField label="Viral score" value={viral.viralScore} onChange={(val) => setViral(i, { viralScore: val })} />
              </div>
              <InlineField
                label="Hook (tipo)"
                value={viral.hook.tipo}
                onChange={(val) => setViral(i, { hook: { ...viral.hook, tipo: val } })}
              />
              <div className="md:col-span-2">
                <TextField
                  label="Hook (texto)"
                  value={viral.hook.texto}
                  onChange={(val) => setViral(i, { hook: { ...viral.hook, texto: val } })}
                />
              </div>
              <div className="md:col-span-2">
                <TextField label="Share trigger" value={viral.shareTrigger} onChange={(val) => setViral(i, { shareTrigger: val })} />
              </div>
              <div className="md:col-span-2">
                <TextField label="Por qué funciona" value={viral.porQueFunciona} onChange={(val) => setViral(i, { porQueFunciona: val })} />
              </div>
              <div className="md:col-span-2">
                <TextField
                  label="Patrón transferible (concepto, no copia)"
                  value={viral.patronTransferible}
                  onChange={(val) => setViral(i, { patronTransferible: val })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/60">Patrones recurrentes ({v.patronesRecurrentes.length})</div>
      </div>
      <div className="flex flex-col gap-3">
        {v.patronesRecurrentes.length === 0 && (
          <div className="glass p-4 text-xs text-white/40">Sin patrones. Regenera con IA.</div>
        )}
        {v.patronesRecurrentes.map((p, i) => (
          <div key={i} className="glass grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
            <InlineField label="Patrón" value={p.patron} onChange={(val) => setPatron(i, { patron: val })} />
            <InlineField label="Frecuencia" value={p.frecuencia} onChange={(val) => setPatron(i, { frecuencia: val })} />
            <InlineField label="Cómo aplicar" value={p.comoAplicar} onChange={(val) => setPatron(i, { comoAplicar: val })} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="glass p-4">
      <div className="mb-2 text-sm font-semibold">{label}</div>
      <textarea className="input min-h-[60px] resize-y" value={value} onChange={(e) => onChange(e.target.value)} />
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

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/50">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/50">{label}</span>
      <input
        type="number"
        min={0}
        max={100}
        className="input"
        value={value}
        onChange={(e) => onChange(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
      />
    </label>
  );
}
