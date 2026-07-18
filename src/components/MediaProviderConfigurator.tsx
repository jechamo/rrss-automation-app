"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EMPTY_HEYGEN,
  type HeygenConfig,
  type HeygenNarracion,
  type MediaConfig,
  type Rama,
  validateMediaConfig,
} from "@/core/content/types";
import { SelectorAuto, loadOptions, type Option } from "@/components/SelectorAuto";
import { estimatePieceCost, formatCostRange } from "@/core/media/pricing";

export function mediaProviderError(config: MediaConfig): string {
  return validateMediaConfig(config);
}

export function MediaProviderConfigurator({
  value,
  onChange,
  disabled = false,
  usarGemini = false,
}: {
  value: MediaConfig;
  onChange: (config: MediaConfig) => void;
  disabled?: boolean;
  /** Solo flujo clonar viral: incluye Gemini en la estimacion. */
  usarGemini?: boolean;
}) {
  const [videoOptions, setVideoOptions] = useState<Option[]>([]);
  const [avatarOptions, setAvatarOptions] = useState<Option[]>([]);
  const [voiceOptions, setVoiceOptions] = useState<Option[]>([]);
  const [optionsError, setOptionsError] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [uploading, setUploading] = useState<"" | "photo" | "audio">("");
  const [uploadError, setUploadError] = useState("");

  const heygen = value.heygen ?? EMPTY_HEYGEN;
  const selectedAvatar = useMemo(
    () => avatarOptions.find((option) => option.id === heygen.avatarId),
    [avatarOptions, heygen.avatarId],
  );
  const selectedVoice = useMemo(
    () => voiceOptions.find((option) => option.id === heygen.voiceId),
    [voiceOptions, heygen.voiceId],
  );
  const cost = useMemo(
    () => estimatePieceCost(value, { usarGemini }),
    [value, usarGemini],
  );

  useEffect(() => {
    let active = true;
    setLoadingOptions(true);
    setOptionsError("");

    const request =
      value.rama === "fal"
        ? Promise.all([loadOptions("fal", "video"), loadOptions("elevenlabs", "voice")])
        : Promise.all([loadOptions("heygen", "avatar"), loadOptions("heygen", "voice")]);

    request
      .then(([videoOrAvatar, voices]) => {
        if (!active) return;
        if (value.rama === "fal") {
          setVideoOptions(videoOrAvatar.options);
        } else {
          setAvatarOptions(videoOrAvatar.options);
        }
        setVoiceOptions(voices.options);
        const error = videoOrAvatar.error || voices.error;
        if (error) setOptionsError(`${error}. Revisa la clave del proveedor en Ajustes.`);
      })
      .catch((error: unknown) => {
        if (active) setOptionsError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });

    return () => {
      active = false;
    };
  }, [value.rama]);

  function patch(patchValue: Partial<MediaConfig>) {
    onChange({ ...value, ...patchValue });
  }

  function patchHeygen(patchValue: Partial<HeygenConfig>) {
    onChange({ ...value, heygen: { ...heygen, ...patchValue } });
  }

  function chooseBranch(rama: Rama) {
    if (rama === "fal") {
      patch({ rama, vozProveedor: "elevenlabs" });
      return;
    }
    patch({
      rama,
      vozProveedor: "heygen",
      videoAuto: false,
      videoModelo: heygen.avatarId,
      vozAuto: false,
      vozId: heygen.voiceId,
      heygen: { ...heygen },
    });
  }

  function chooseNarration(narracion: HeygenNarracion) {
    if (narracion === "voice") {
      patchHeygen({ narracion, audioAssetId: "", audioLabel: "" });
    } else {
      patchHeygen({ narracion, voiceId: "" });
    }
  }

  async function upload(kind: "photo" | "audio", file: File | null) {
    if (!file) return;
    setUploading(kind);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);
      if (kind === "photo") form.append("name", file.name.replace(/\.[^.]+$/, "").slice(0, 100));
      const response = await fetch("/api/providers/heygen/upload", { method: "POST", body: form });
      const data = (await response.json()) as {
        avatarId?: string;
        avatarLabel?: string;
        audioAssetId?: string;
        audioLabel?: string;
        preview?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || `La subida falló (${response.status}).`);

      if (kind === "photo" && data.avatarId) {
        const option: Option = {
          id: data.avatarId,
          label: data.avatarLabel || "Avatar propio",
          preview: data.preview,
        };
        setAvatarOptions((current) => [option, ...current.filter((item) => item.id !== option.id)]);
        patchHeygen({ avatarId: option.id, avatarLabel: option.label });
      } else if (kind === "audio" && data.audioAssetId) {
        patchHeygen({
          narracion: "audio",
          voiceId: "",
          audioAssetId: data.audioAssetId,
          audioLabel: data.audioLabel || file.name,
        });
      } else {
        throw new Error("El proveedor no devolvió el identificador esperado.");
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : String(error));
    } finally {
      setUploading("");
    }
  }

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-4 disabled:opacity-60">
      <div>
        <span className="mb-1 block text-xs text-white/50">Generación de vídeo</span>
        <div className="grid grid-cols-2 gap-2">
          {(["fal", "heygen"] as Rama[]).map((rama) => (
            <button
              key={rama}
              type="button"
              onClick={() => chooseBranch(rama)}
              className={[
                "rounded-lg border px-3 py-2 text-sm transition",
                value.rama === rama
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15"
                  : "border-white/15 hover:bg-white/5",
              ].join(" ")}
            >
              {rama === "fal" ? "Vídeo generativo" : "Avatar presentador"}
              <span className="mt-0.5 block text-[10px] text-white/40">
                {rama === "fal" ? "Cortes visuales creados con IA" : "Foto animada con voz o audio propio"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {value.rama === "fal" ? (
        <>
          <SelectorAuto
            label="Modelo de vídeo"
            auto={value.videoAuto}
            setAuto={(videoAuto) => patch({ videoAuto })}
            value={value.videoModelo}
            setValue={(videoModelo) => patch({ videoModelo })}
            options={videoOptions}
            autoHint="Modelo recomendado: Seedance Pro Fast"
          />
          <SelectorAuto
            label="Voz"
            auto={value.vozAuto}
            setAuto={(vozAuto) => patch({ vozAuto })}
            value={value.vozId}
            setValue={(vozId) => patch({ vozId })}
            options={voiceOptions}
            autoHint="Usar la voz predeterminada"
          />
        </>
      ) : (
        <>
          <div>
            <label className="block">
              <span className="mb-1 block text-xs text-white/50">Avatar — obligatorio</span>
              <select
                className="input"
                value={heygen.avatarId}
                onChange={(event) => {
                  const option = avatarOptions.find((item) => item.id === event.target.value);
                  patch({
                    videoModelo: event.target.value,
                    heygen: {
                      ...heygen,
                      avatarId: event.target.value,
                      avatarLabel: option?.label ?? "",
                    },
                  });
                }}
              >
                <option value="">{loadingOptions ? "Cargando avatares…" : "— elige un avatar —"}</option>
                {avatarOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                    {option.hint ? ` · ${option.hint}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-2 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
              {(selectedAvatar?.preview || (heygen.avatarId && heygen.avatarLabel)) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedAvatar?.preview || "/img/logo-icon.png"}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover"
                />
              )}
              <label className="cursor-pointer rounded-lg border border-white/15 px-3 py-2 text-xs hover:bg-white/5">
                {uploading === "photo" ? "Creando avatar…" : "Subir una foto"}
                <input
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg"
                  disabled={Boolean(uploading)}
                  onChange={(event) => upload("photo", event.target.files?.[0] ?? null)}
                />
              </label>
              <span className="text-[10px] text-white/35">PNG o JPEG · máximo 32 MB</span>
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs text-white/50">Narración — obligatoria</span>
            <div className="grid grid-cols-2 gap-2">
              {(["voice", "audio"] as HeygenNarracion[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => chooseNarration(mode)}
                  className={[
                    "rounded-lg border px-3 py-2 text-xs",
                    heygen.narracion === mode
                      ? "border-[var(--color-accent-2)] bg-[var(--color-accent-2)]/10"
                      : "border-white/15 hover:bg-white/5",
                  ].join(" ")}
                >
                  {mode === "voice" ? "Voz del catálogo" : "Subir audio propio"}
                </button>
              ))}
            </div>
          </div>

          {heygen.narracion === "voice" ? (
            <div>
              <label className="block">
                <span className="mb-1 block text-xs text-white/50">Voz — obligatoria</span>
                <select
                  className="input"
                  value={heygen.voiceId}
                  onChange={(event) =>
                    patch({
                      vozId: event.target.value,
                      vozAuto: false,
                      heygen: { ...heygen, voiceId: event.target.value },
                    })
                  }
                >
                  <option value="">{loadingOptions ? "Cargando voces…" : "— elige una voz —"}</option>
                  {voiceOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                      {option.hint ? ` · ${option.hint}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {selectedVoice?.preview && (
                <audio className="mt-2 h-8 w-full" controls preload="none" src={selectedVoice.preview}>
                  Tu navegador no admite la preescucha de audio.
                </audio>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-white/15 px-3 py-2 text-xs hover:bg-white/5">
                {uploading === "audio" ? "Subiendo audio…" : "Elegir MP3 o WAV"}
                <input
                  className="sr-only"
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav"
                  disabled={Boolean(uploading)}
                  onChange={(event) => upload("audio", event.target.files?.[0] ?? null)}
                />
              </label>
              {heygen.audioLabel && (
                <span className="ml-3 text-xs text-[var(--color-state-ok)]">✓ {heygen.audioLabel}</span>
              )}
              <p className="mt-2 text-[10px] text-white/35">El audio se usa tal cual para sincronizar el avatar.</p>
            </div>
          )}
        </>
      )}

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-white/70">Coste estimado</span>
          <span className="text-sm font-semibold tabular-nums text-[var(--color-accent-2)]">
            {formatCostRange(cost.totalMin, cost.totalMax)}
          </span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {cost.lines.map((line) => (
            <li key={line.label} className="flex items-start justify-between gap-3 text-[11px]">
              <span className="min-w-0">
                <span className="text-white/65">{line.label}</span>
                <span className="mt-0.5 block text-white/35">{line.detail}</span>
              </span>
              <span className="shrink-0 tabular-nums text-white/50">
                {formatCostRange(line.usdMin, line.usdMax)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10px] text-white/30">{cost.note}</p>
      </div>

      {optionsError && <p className="text-xs text-[var(--color-state-pending)]">{optionsError}</p>}
      {uploadError && <p className="text-xs text-[var(--color-state-error)]">{uploadError}</p>}
    </fieldset>
  );
}
