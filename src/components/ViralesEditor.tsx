"use client";

import { useEffect, useState } from "react";
import {
  EMPTY_VIRAL,
  type PatronViral,
  type Plataforma,
  type Viral,
  type Virales,
} from "@/core/virales/types";
import { ExpandableCarousel } from "@/components/ExpandableCarousel";
import { ScoreBar } from "@/components/ScoreBar";

const PLATAFORMAS: Plataforma[] = ["youtube", "tiktok", "instagram"];

const PLAT_META: Record<string, { icon: string; color: string }> = {
  youtube: { icon: "▶", color: "#ff0033" },
  tiktok: { icon: "♪", color: "#22d3ee" },
  instagram: { icon: "◎", color: "#f472b6" },
};

function youtubeId(url: string): string {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : "";
}

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
  const [showEdit, setShowEdit] = useState(false);
  const approved = status === "approved";

  useEffect(() => {
    setV(initial);
  }, [initial]);

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
          {v.discovery && (
            <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/55">
              Fuente: {v.discovery.source === "hybrid"
                ? "híbrida"
                : v.discovery.source === "scrapecreators"
                  ? "Scrape Creators"
                  : "IA + web"}
              {v.discovery.creditsCharged != null ? ` · ${v.discovery.creditsCharged} créditos` : ""}
            </span>
          )}
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

      {/* Vista visual: carrusel 360 + detalle desplegable */}
      {v.virales.length > 0 && (
        <ExpandableCarousel
          items={v.virales}
          getKey={(_, i) => `v-${i}`}
          renderCard={(viral, isCenter) => {
            const meta = PLAT_META[viral.plataforma] ?? PLAT_META.youtube;
            const yid = viral.plataforma === "youtube" ? youtubeId(viral.url) : "";
            const thumbnail = viral.metrics?.thumbnailUrl || (yid ? `https://img.youtube.com/vi/${yid}/hqdefault.jpg` : "");
            return (
              <>
                <div
                  className="relative flex-1 overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${meta.color}33, #000a 70%)` }}
                >
                  {thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnail}
                      alt=""
                      className="h-full w-full object-cover opacity-90"
                    />
                  ) : (
                    <div
                      className={`flex h-full items-center justify-center text-5xl ${isCenter ? "float" : ""}`}
                      style={{ color: meta.color }}
                    >
                      {meta.icon}
                    </div>
                  )}
                  <span
                    className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                    style={{ background: `${meta.color}33`, color: "#fff" }}
                  >
                    {meta.icon} {viral.plataforma}
                  </span>
                  {viral.sourceProvider === "scrapecreators" && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-0.5 text-[9px] text-cyan-100">
                      métricas API
                    </span>
                  )}
                </div>
                <div className="shrink-0 space-y-1 p-2">
                  <div className="line-clamp-2 text-xs font-semibold">{viral.titulo || "(sin título)"}</div>
                  <ScoreBar label="Viral" value={viral.viralScore} max={100} color={meta.color} />
                </div>
              </>
            );
          }}
          renderDetail={(viral) => {
            const meta = PLAT_META[viral.plataforma] ?? PLAT_META.youtube;
            return (
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-bold">{viral.titulo || "(sin título)"}</div>
                    <div className="text-xs text-white/50">
                      {viral.autor && `${viral.autor} · `}
                      {viral.vistas && `${viral.vistas} · `}
                      {viral.formato}
                    </div>
                  </div>
                  {viral.url && (
                    <a
                      href={viral.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium"
                      style={{ background: `${meta.color}22`, color: meta.color }}
                    >
                      Ver vídeo ↗
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ScoreBar label="Viral score" value={viral.viralScore} max={100} color={meta.color} />
                  {viral.ratioAutor > 0 && viral.metrics?.ratioConfidence !== "unverified" ? (
                    <ScoreBar
                      label="Ratio sobre el autor"
                      value={Math.min(viral.ratioAutor, 10)}
                      max={10}
                      color="var(--color-accent)"
                      suffix={`×${viral.ratioAutor}`}
                    />
                  ) : (
                    <div className="rounded-lg border border-white/8 bg-black/15 p-3 text-xs text-white/45">
                      Ratio sobre el autor pendiente de verificar
                    </div>
                  )}
                </div>
                {viral.metrics && (
                  <div className="flex flex-wrap gap-1.5 text-[11px] text-white/60">
                    {viral.metrics.likes != null && <MetricChip label="Me gusta" value={viral.metrics.likes} />}
                    {viral.metrics.comments != null && <MetricChip label="Comentarios" value={viral.metrics.comments} />}
                    {viral.metrics.shares != null && <MetricChip label="Compartidos" value={viral.metrics.shares} />}
                    {viral.metrics.saves != null && <MetricChip label="Guardados" value={viral.metrics.saves} />}
                    {viral.metrics.engagementRate != null && (
                      <MetricChip label="Engagement" value={`${viral.metrics.engagementRate}%`} />
                    )}
                  </div>
                )}
                {viral.hook.texto && <DetailRow label={`Hook (${viral.hook.tipo})`} value={viral.hook.texto} />}
                {viral.shareTrigger && <DetailRow label="Share trigger" value={viral.shareTrigger} />}
                {viral.porQueFunciona && <DetailRow label="Por qué funciona" value={viral.porQueFunciona} />}
                {viral.patronTransferible && (
                  <DetailRow label="Patrón transferible (concepto, no copia)" value={viral.patronTransferible} />
                )}
                {viral.estructura.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs text-white/50">Estructura</div>
                    <div className="flex flex-wrap gap-1.5">
                      {viral.estructura.map((b, k) => (
                        <span key={k} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                          {b.desde}-{b.hasta}s · {b.bloque}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          }}
        />
      )}

      {/* Patrones recurrentes (vista rápida) */}
      {v.patronesRecurrentes.length > 0 && (
        <div className="glass p-4">
          <div className="mb-2 text-sm font-semibold text-white/60">
            Patrones recurrentes ({v.patronesRecurrentes.length})
          </div>
          <div className="flex flex-col gap-2">
            {v.patronesRecurrentes.map((p, i) => (
              <div key={i} className="rounded-lg bg-white/5 p-2 text-xs">
                <b className="text-[var(--color-accent-2)]">{p.patron}</b>
                {p.frecuencia && <span className="text-white/40"> · {p.frecuencia}</span>}
                {p.comoAplicar && <div className="mt-0.5 text-white/60">{p.comoAplicar}</div>}
              </div>
            ))}
          </div>
        </div>
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
      </>
      )}
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="rounded-full border border-white/8 bg-white/5 px-2 py-1">
      {label}: {typeof value === "number" ? value.toLocaleString("es-ES") : value}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-white/50">{label}</div>
      <div className="text-sm text-white/80">{value}</div>
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
