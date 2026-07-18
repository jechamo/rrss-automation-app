"use client";

import { useState } from "react";
import type { Competencia, Competidor } from "@/core/competencia/types";
import { ExpandableCarousel } from "@/components/ExpandableCarousel";
import { ScoreBar } from "@/components/ScoreBar";
import { EntityLogo } from "@/components/EntityLogo";

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

function legacyScore(comp: Competidor): number {
  const total = comp.pros.length + comp.contras.length;
  return total > 0 ? (comp.pros.length / total) * 5 : 2.5;
}

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
  const [showEdit, setShowEdit] = useState(false);
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

      {/* Vista visual: carrusel 360 de competidores + detalle desplegable */}
      {c.competidores.length > 0 && (
        <ExpandableCarousel
          items={c.competidores}
          getKey={(_, i) => `c-${i}`}
          renderCard={(comp, isCenter) => {
            const score = comp.scores?.amenaza ?? legacyScore(comp);
            return (
              <>
                <div className="relative flex flex-1 flex-col items-center justify-center gap-2 bg-gradient-to-br from-[var(--color-accent)]/25 via-black/50 to-[var(--color-accent-2)]/20 p-3">
                  <div className={isCenter ? "float" : ""}>
                    <EntityLogo name={comp.nombre} web={comp.url} size={52} />
                  </div>
                  <div className="line-clamp-2 text-center text-xs font-semibold">{comp.nombre || "(sin nombre)"}</div>
                </div>
                <div className="shrink-0 space-y-1 p-2">
                  <div className="line-clamp-2 text-[10px] text-white/50">{comp.propuestaValor}</div>
                  <ScoreBar
                    label={comp.scores ? "Amenaza competitiva" : "Fortaleza (análisis antiguo)"}
                    value={score}
                    max={5}
                    color="var(--color-accent-2)"
                  />
                </div>
              </>
            );
          }}
          renderDetail={(comp) => (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <EntityLogo name={comp.nombre} web={comp.url} size={44} />
                <div className="min-w-0">
                  <div className="truncate text-base font-bold">{comp.nombre || "(sin nombre)"}</div>
                  {comp.url && (
                    <a href={comp.url.startsWith("http") ? comp.url : `https://${comp.url}`} target="_blank" rel="noreferrer" className="truncate text-xs text-[var(--color-accent-2)] hover:underline">
                      {comp.url.replace(/^https?:\/\//, "")} ↗
                    </a>
                  )}
                </div>
                {comp.precios && (
                  <span className="ml-auto shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">{comp.precios}</span>
                )}
              </div>
              {comp.scores ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <ScoreBar
                    label="Producto"
                    value={comp.scores.producto}
                    max={5}
                    color="var(--color-state-ok)"
                  />
                  <ScoreBar
                    label="Presencia RRSS"
                    value={comp.scores.presenciaRRSS}
                    max={5}
                    color="var(--color-accent-2)"
                  />
                  <ScoreBar
                    label="Amenaza"
                    value={comp.scores.amenaza}
                    max={5}
                    color="var(--color-state-error)"
                  />
                </div>
              ) : (
                <ScoreBar
                  label="Fortaleza legacy (pros/contras)"
                  value={legacyScore(comp)}
                  max={5}
                  color="var(--color-accent-2)"
                />
              )}
              {comp.scores?.justificacion && (
                <DetailRow label="Justificación de las puntuaciones" value={comp.scores.justificacion} />
              )}
              {comp.propuestaValor && <DetailRow label="Propuesta de valor" value={comp.propuestaValor} />}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {comp.pros.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs text-[var(--color-state-ok)]">Pros</div>
                    <ul className="space-y-0.5 text-xs text-white/70">
                      {comp.pros.map((x, k) => <li key={k}>+ {x}</li>)}
                    </ul>
                  </div>
                )}
                {comp.contras.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs text-[var(--color-state-error)]">Contras</div>
                    <ul className="space-y-0.5 text-xs text-white/70">
                      {comp.contras.map((x, k) => <li key={k}>− {x}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              {comp.diferenciadores && <DetailRow label="Diferenciadores (vs. nuestro proyecto)" value={comp.diferenciadores} />}
            </div>
          )}
        />
      )}

      <button
        onClick={() => setShowEdit((s) => !s)}
        className="self-start text-xs text-[var(--color-accent-2)] hover:underline"
      >
        {showEdit ? "Ocultar edición en detalle" : "✎ Editar en detalle"}
      </button>

      {showEdit && (
      <>
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
              {comp.scores && (
                <>
                  <div className="grid grid-cols-3 gap-3 md:col-span-2">
                    <NumberField
                      label="Producto"
                      value={comp.scores.producto}
                      onChange={(value) =>
                        setCompetidor(i, { scores: { ...comp.scores!, producto: value } })
                      }
                    />
                    <NumberField
                      label="Presencia RRSS"
                      value={comp.scores.presenciaRRSS}
                      onChange={(value) =>
                        setCompetidor(i, { scores: { ...comp.scores!, presenciaRRSS: value } })
                      }
                    />
                    <NumberField
                      label="Amenaza"
                      value={comp.scores.amenaza}
                      onChange={(value) =>
                        setCompetidor(i, { scores: { ...comp.scores!, amenaza: value } })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <TextField
                      label="Justificación de puntuaciones"
                      value={comp.scores.justificacion}
                      onChange={(value) =>
                        setCompetidor(i, {
                          scores: { ...comp.scores!, justificacion: value },
                        })
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ListField label="Nuestras ventajas" values={c.ventajas} onChange={(v) => set("ventajas", v)} />
        <ListField label="Amenazas" values={c.amenazas} onChange={(v) => set("amenazas", v)} />
        <ListField label="Oportunidades" values={c.oportunidades} onChange={(v) => set("oportunidades", v)} />
      </div>
      </>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-white/50">{label}</div>
      <div className="whitespace-pre-wrap text-sm text-white/80">{value}</div>
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

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/50">{label} (1-5)</span>
      <input
        type="number"
        min={1}
        max={5}
        className="input"
        value={value}
        onChange={(event) =>
          onChange(Math.min(5, Math.max(1, parseInt(event.target.value, 10) || 1)))
        }
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
