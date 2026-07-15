"use client";

import { useCallback, useEffect, useState } from "react";
import type { MediaConfig, Rama } from "@/core/content/types";

type Option = { id: string; label: string; hint?: string };
type ViralPick = { url: string; titulo: string; plataforma: string };

async function loadOptions(provider: string, kind: string): Promise<{ options: Option[]; error?: string }> {
  try {
    const r = await fetch(`/api/providers/${provider}/options?kind=${kind}`);
    if (!r.ok) return { options: [], error: `HTTP ${r.status}` };
    return (await r.json()) as { options: Option[]; error?: string };
  } catch (e) {
    return { options: [], error: (e as Error).message };
  }
}

export function GenerateContentModal({
  virales,
  initialUrl,
  onClose,
  onGenerate,
  busy,
}: {
  virales: ViralPick[];
  initialUrl?: string;
  onClose: () => void;
  onGenerate: (sourceUrl: string, config: MediaConfig) => void;
  busy: boolean;
}) {
  const [sourceUrl, setSourceUrl] = useState(initialUrl ?? virales[0]?.url ?? "");
  const [rama, setRama] = useState<Rama>("fal");
  const [videoAuto, setVideoAuto] = useState(true);
  const [videoModelo, setVideoModelo] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [vozAuto, setVozAuto] = useState(true);
  const [vozId, setVozId] = useState("");
  const [usarGemini, setUsarGemini] = useState(false);

  const [videoOpts, setVideoOpts] = useState<Option[]>([]);
  const [avatarOpts, setAvatarOpts] = useState<Option[]>([]);
  const [vozOpts, setVozOpts] = useState<Option[]>([]);
  const [optErr, setOptErr] = useState<string>("");

  const vozProvider = rama === "fal" ? "elevenlabs" : "heygen";

  const refreshOptions = useCallback(async () => {
    setOptErr("");
    if (rama === "fal") {
      const v = await loadOptions("fal", "video");
      setVideoOpts(v.options);
    } else {
      const a = await loadOptions("heygen", "avatar");
      setAvatarOpts(a.options);
      if (a.error) setOptErr(`Avatares HeyGen: ${a.error}. Configura la key en Ajustes.`);
    }
    const voz = await loadOptions(vozProvider, "voice");
    setVozOpts(voz.options);
    if (voz.error && !optErr) {
      setOptErr(`Voces ${vozProvider}: ${voz.error}. Configura la key en Ajustes.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rama, vozProvider]);

  useEffect(() => {
    refreshOptions();
  }, [refreshOptions]);

  function submit() {
    if (!sourceUrl) return;
    const config: MediaConfig = {
      rama,
      videoAuto: rama === "fal" ? videoAuto : false,
      videoModelo: rama === "fal" ? (videoAuto ? "" : videoModelo) : avatarId,
      vozProveedor: vozProvider,
      vozAuto,
      vozId: vozAuto ? "" : vozId,
      usarGemini,
    };
    onGenerate(sourceUrl, config);
  }

  const heygenSinAvatar = rama === "heygen" && !avatarId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass max-h-[90vh] w-full max-w-lg overflow-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Generar contenido (clonar viral)</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 text-sm">
          <label className="block">
            <span className="mb-1 block text-xs text-white/50">Viral a reinterpretar</span>
            <select
              className="input"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            >
              {virales.map((v) => (
                <option key={v.url} value={v.url}>
                  [{v.plataforma}] {v.titulo || v.url}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1 block text-xs text-white/50">Modo de vídeo</span>
            <div className="flex gap-2">
              {(["fal", "heygen"] as Rama[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRama(r)}
                  className={[
                    "flex-1 rounded-lg border px-3 py-2 text-sm",
                    rama === r
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15"
                      : "border-white/15 hover:bg-white/5",
                  ].join(" ")}
                >
                  {r === "fal" ? "fal.ai — cortes generados" : "HeyGen — avatar (foto+voz)"}
                </button>
              ))}
            </div>
          </div>

          {rama === "fal" ? (
            <SelectorAuto
              label="Modelo de vídeo (fal.ai)"
              auto={videoAuto}
              setAuto={setVideoAuto}
              value={videoModelo}
              setValue={setVideoModelo}
              options={videoOpts}
              autoHint="La IA usa el modelo por defecto (LTX Video)"
            />
          ) : (
            <label className="block">
              <span className="mb-1 block text-xs text-white/50">Avatar (HeyGen) — obligatorio</span>
              <select className="input" value={avatarId} onChange={(e) => setAvatarId(e.target.value)}>
                <option value="">— elige un avatar —</option>
                {avatarOpts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <SelectorAuto
            label={`Voz (${vozProvider})`}
            auto={vozAuto}
            setAuto={setVozAuto}
            value={vozId}
            setValue={setVozId}
            options={vozOpts}
            autoHint="Voz por defecto del proveedor"
          />

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={usarGemini} onChange={(e) => setUsarGemini(e.target.checked)} />
            <span className="text-xs text-white/70">
              Enriquecer la comprensión del viral con Gemini (opcional, requiere key)
            </span>
          </label>

          {optErr && <div className="text-xs text-[var(--color-state-pending)]">{optErr}</div>}

          <div className="mt-1 rounded-lg bg-white/5 p-3 text-xs text-white/50">
            Se genera un guion <b>original</b> reinterpretando el concepto del viral (no copia). El
            render real usa tus keys de Ajustes; si falta alguna, el paso fallará y podrás reintentar.
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={busy || !sourceUrl || heygenSinAvatar}
              className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
            >
              {busy ? "Lanzando…" : "Generar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectorAuto({
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
