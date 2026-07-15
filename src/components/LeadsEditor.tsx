"use client";

import { useState } from "react";
import {
  EMPTY_LEAD,
  type Canal,
  type Lead,
  type Leads,
  type Temperatura,
} from "@/core/leads/types";

const TEMPERATURAS: Temperatura[] = ["caliente", "templado", "frio"];
const CANALES: Canal[] = ["correo", "visita", "otro"];

export function LeadsEditor({
  initial,
  status,
  onSave,
  onRegenerate,
  saving,
  regenerating,
}: {
  initial: Leads;
  status: string;
  onSave: (l: Leads, approve: boolean) => Promise<void>;
  onRegenerate: () => void;
  saving: boolean;
  regenerating: boolean;
}) {
  const [l, setL] = useState<Leads>(initial);
  const approved = status === "approved";

  const set = <K extends keyof Leads>(k: K, v: Leads[K]) => setL((p) => ({ ...p, [k]: v }));

  const setLead = (i: number, patch: Partial<Lead>) =>
    setL((p) => ({ ...p, leads: p.leads.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) }));
  const removeLead = (i: number) =>
    setL((p) => ({ ...p, leads: p.leads.filter((_, idx) => idx !== i) }));
  const addLead = () => setL((p) => ({ ...p, leads: [...p.leads, { ...EMPTY_LEAD }] }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">Clientes potenciales y estrategia</h2>
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
            onClick={() => onSave(l, false)}
            disabled={saving}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            onClick={() => onSave(l, true)}
            disabled={saving}
            className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
          >
            Aprobar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <TextField label="Resumen de la oportunidad" value={l.resumen} onChange={(v) => set("resumen", v)} />
        </div>
        <InlineFieldCard label="Zona objetivo" value={l.zona} onChange={(v) => set("zona", v)} />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/60">Clientes potenciales ({l.leads.length})</div>
        <button onClick={addLead} className="text-xs text-[var(--color-accent-2)] hover:underline">
          + Añadir lead
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {l.leads.length === 0 && (
          <div className="glass p-4 text-xs text-white/40">Sin leads. Añade uno o regenera con IA.</div>
        )}
        {l.leads.map((lead, i) => (
          <div key={i} className="glass p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  className="input font-semibold"
                  value={lead.nombre}
                  placeholder="Nombre del negocio"
                  onChange={(e) => setLead(i, { nombre: e.target.value })}
                />
                {lead.origen === "manual" && (
                  <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">manual</span>
                )}
              </div>
              <button
                onClick={() => removeLead(i)}
                className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-xs text-white/50 hover:bg-white/5"
              >
                ✕ Quitar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InlineField label="Tipo de negocio" value={lead.tipo} onChange={(v) => setLead(i, { tipo: v })} />
              <InlineField label="Dirección" value={lead.direccion} onChange={(v) => setLead(i, { direccion: v })} />
              <InlineField label="Web" value={lead.web} onChange={(v) => setLead(i, { web: v })} />
              <InlineField label="Teléfono" value={lead.telefono} onChange={(v) => setLead(i, { telefono: v })} />
              <InlineField label="Email" value={lead.email} onChange={(v) => setLead(i, { email: v })} />
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Temperatura"
                  value={lead.temperatura}
                  options={TEMPERATURAS}
                  onChange={(v) => setLead(i, { temperatura: v as Temperatura })}
                />
                <SelectField
                  label="Canal"
                  value={lead.canalRecomendado}
                  options={CANALES}
                  onChange={(v) => setLead(i, { canalRecomendado: v as Canal })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Fit (1-5)" value={lead.fitScore} onChange={(v) => setLead(i, { fitScore: v })} />
                <NumberField label="Intención (1-5)" value={lead.intentScore} onChange={(v) => setLead(i, { intentScore: v })} />
              </div>
              <div className="md:col-span-2">
                <TextField label="Motivo (por qué encaja)" value={lead.motivo} onChange={(v) => setLead(i, { motivo: v })} />
              </div>
              <div className="md:col-span-2">
                <TextField label="Estrategia de captación" value={lead.estrategia} onChange={(v) => setLead(i, { estrategia: v })} />
              </div>
              {lead.canalRecomendado === "correo" && (
                <div className="md:col-span-2">
                  <InlineField
                    label="Asunto del correo"
                    value={lead.borrador.asunto}
                    onChange={(v) => setLead(i, { borrador: { ...lead.borrador, asunto: v } })}
                  />
                </div>
              )}
              <div className="md:col-span-2">
                <TextField
                  label={lead.canalRecomendado === "visita" ? "Guion de visita" : "Cuerpo del correo / borrador"}
                  value={lead.borrador.cuerpo}
                  onChange={(v) => setLead(i, { borrador: { ...lead.borrador, cuerpo: v } })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <ListField
        label="Estrategia global (prioridades / quick wins)"
        values={l.estrategiaGlobal}
        onChange={(v) => set("estrategiaGlobal", v)}
      />
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="glass p-4">
      <div className="mb-2 text-sm font-semibold">{label}</div>
      <textarea className="input min-h-[70px] resize-y" value={value} onChange={(e) => onChange(e.target.value)} />
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

function InlineFieldCard({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="glass p-4">
      <div className="mb-2 text-sm font-semibold">{label}</div>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
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
        min={1}
        max={5}
        className="input"
        value={value}
        onChange={(e) => onChange(Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 1)))}
      />
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
