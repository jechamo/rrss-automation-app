"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { CardArt } from "@/components/CardArt";

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
  const [savedDossier, setSavedDossier] = useState<Dossier>(initial);
  const approved = status === "approved";
  const [open, setOpen] = useState(!approved);
  const [editing, setEditing] = useState(!approved);

  const set = <K extends keyof Dossier>(k: K, v: Dossier[K]) => setD((p) => ({ ...p, [k]: v }));

  async function save(approve: boolean) {
    await onSave(d, approve);
    setSavedDossier(d);
    setEditing(false);
  }

  function cancelEdit() {
    setD(savedDossier);
    setEditing(false);
  }

  return (
    <div className="glass-strong overflow-hidden">
      <div className="relative min-h-36 overflow-hidden">
        <CardArt
          name="bg-dossier.webp"
          fallback="linear-gradient(135deg, rgba(34,211,238,0.22), rgba(124,58,237,0.24), rgba(8,12,22,0.96))"
        />
        <div className="relative flex min-h-36 items-center justify-between gap-4 p-5">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">Dossier de negocio</h2>
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
            <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-white/65">
              {d.negocio || "Resumen estratégico del negocio, la marca y su audiencia."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/55">
              {d.nicho && <span className="rounded-full bg-black/25 px-2 py-1">{d.nicho}</span>}
              <span className="rounded-full bg-black/25 px-2 py-1">
                {d.funcionalidades.length} funcionalidades
              </span>
              <span className="rounded-full bg-black/25 px-2 py-1">
                {d.ctas.length} CTAs
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/25 text-xl transition-transform"
            aria-label={open ? "Plegar dossier" : "Desplegar dossier"}
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ⌄
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-in flex flex-col gap-4 border-t border-white/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-white/45">
              {editing ? "Modo edición" : "Vista resumida · pulsa Editar para modificar"}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onRegenerate}
                disabled={regenerating}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
              >
                {regenerating ? "Regenerando…" : "Regenerar con IA"}
              </button>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium"
                >
                  Editar dossier
                </button>
              ) : (
                <>
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => void save(false)}
                    disabled={saving}
                    className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
                  >
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                  <button
                    onClick={() => void save(true)}
                    disabled={saving}
                    className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
                  >
                    Aprobar
                  </button>
                </>
              )}
            </div>
          </div>

          {editing ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionCard icon="◈" title="Negocio y propuesta">
                <div className="flex flex-col gap-3">
                  <TextField label="Negocio" value={d.negocio} onChange={(v) => set("negocio", v)} />
                  <TextField
                    label="Propuesta de valor"
                    value={d.propuestaValor}
                    onChange={(v) => set("propuestaValor", v)}
                  />
                  <TextField
                    label="Nicho / sector"
                    value={d.nicho}
                    onChange={(v) => set("nicho", v)}
                    single
                  />
                </div>
              </SectionCard>

              <SectionCard icon="✦" title="Marca">
                <div className="grid grid-cols-1 gap-3">
                  <InlineField
                    label="Tono"
                    value={d.marca.tono}
                    onChange={(v) => set("marca", { ...d.marca, tono: v })}
                  />
                  <InlineField
                    label="Voz"
                    value={d.marca.voz}
                    onChange={(v) => set("marca", { ...d.marca, voz: v })}
                  />
                  <InlineField
                    label="Identidad"
                    value={d.marca.identidad}
                    onChange={(v) => set("marca", { ...d.marca, identidad: v })}
                  />
                </div>
              </SectionCard>

              <SectionCard icon="◎" title="Audiencia y necesidades">
                <div className="flex flex-col gap-3">
                  <TextField
                    label="Público objetivo"
                    value={d.publicoObjetivo}
                    onChange={(v) => set("publicoObjetivo", v)}
                  />
                  <ListField
                    label="Puntos de dolor"
                    values={d.puntosDolor}
                    onChange={(v) => set("puntosDolor", v)}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ListField label="Pros" values={d.pros} onChange={(v) => set("pros", v)} />
                    <ListField
                      label="Contras"
                      values={d.contras}
                      onChange={(v) => set("contras", v)}
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard icon="⚡" title="Funcionalidades y conversión">
                <div className="flex flex-col gap-3">
                  <ListField
                    label="Funcionalidades"
                    values={d.funcionalidades}
                    onChange={(v) => set("funcionalidades", v)}
                  />
                  <ListField label="CTAs" values={d.ctas} onChange={(v) => set("ctas", v)} />
                </div>
              </SectionCard>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionCard icon="◈" title="Negocio y propuesta">
                <ReadField label="Negocio" value={d.negocio} />
                <ReadField label="Propuesta de valor" value={d.propuestaValor} />
                <ReadField label="Nicho / sector" value={d.nicho} />
              </SectionCard>
              <SectionCard icon="✦" title="Marca">
                <ReadField label="Tono" value={d.marca.tono} />
                <ReadField label="Voz" value={d.marca.voz} />
                <ReadField label="Identidad" value={d.marca.identidad} />
              </SectionCard>
              <SectionCard icon="◎" title="Audiencia y necesidades">
                <ReadField label="Público objetivo" value={d.publicoObjetivo} />
                <ChipList label="Puntos de dolor" values={d.puntosDolor} tone="warning" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <ChipList label="Pros" values={d.pros} tone="good" />
                  <ChipList label="Contras" values={d.contras} tone="bad" />
                </div>
              </SectionCard>
              <SectionCard icon="⚡" title="Funcionalidades y conversión">
                <ChipList label="Funcionalidades" values={d.funcionalidades} tone="neutral" />
                <ChipList label="CTAs" values={d.ctas} tone="accent" />
              </SectionCard>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="glass glow-border p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/15 text-[var(--color-accent-2)]">
          {icon}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-white/35">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/75">
        {value || "Sin definir"}
      </div>
    </div>
  );
}

type ChipTone = "neutral" | "accent" | "good" | "bad" | "warning";

const CHIP_STYLE: Record<ChipTone, string> = {
  neutral: "border-white/10 bg-white/5 text-white/65",
  accent:
    "border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 text-[var(--color-accent-2)]",
  good:
    "border-[var(--color-state-ok)]/25 bg-[var(--color-state-ok)]/10 text-[var(--color-state-ok)]",
  bad:
    "border-[var(--color-state-error)]/25 bg-[var(--color-state-error)]/10 text-[var(--color-state-error)]",
  warning:
    "border-[var(--color-state-pending)]/25 bg-[var(--color-state-pending)]/10 text-white/65",
};

function ChipList({ label, values, tone }: { label: string; values: string[]; tone: ChipTone }) {
  const visible = values.filter(Boolean);
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-wide text-white/35">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {visible.length === 0 && <span className="text-xs text-white/30">Sin elementos</span>}
        {visible.map((value, index) => (
          <span
            key={`${index}-${value}`}
            className={`rounded-full border px-2.5 py-1 text-xs ${CHIP_STYLE[tone]}`}
          >
            {value}
          </span>
        ))}
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
