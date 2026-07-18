"use client";

import { useCallback, useEffect, useState } from "react";
import {
  coerceNavStep,
  DEFAULT_CONFIG,
  EMPTY_HEYGEN,
  type DemoConfig,
  type MediaConfig,
  type NavStep,
} from "@/core/content/types";
import {
  MediaProviderConfigurator,
  mediaProviderError,
} from "@/components/MediaProviderConfigurator";
import { SelfRecordModal, type SavedMediaAsset } from "@/components/SelfRecordModal";

type AppFuncion = {
  nombre: string;
  descripcion: string;
  url: string;
  pasos: string[];
  navSteps?: NavStep[];
};

type RecordingAsset = SavedMediaAsset & { kind: string; duration: number | null };

export function DemoContentModal({
  projectId,
  onClose,
  onGenerate,
  busy,
}: {
  projectId: string;
  onClose: () => void;
  onGenerate: (demo: DemoConfig, config: Partial<MediaConfig>) => void;
  busy: boolean;
}) {
  const [funciones, setFunciones] = useState<AppFuncion[]>([]);
  const [loadingFuncs, setLoadingFuncs] = useState(false);
  const [funcsErr, setFuncsErr] = useState("");

  const [funcion, setFuncion] = useState("");
  const [funcionUrl, setFuncionUrl] = useState("");
  const [pasosText, setPasosText] = useState("");
  const [navSteps, setNavSteps] = useState<NavStep[] | undefined>();
  const [navStepsText, setNavStepsText] = useState("");
  const [navStepsError, setNavStepsError] = useState("");
  const [dryRunState, setDryRunState] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [dryRunMessage, setDryRunMessage] = useState("");

  const [grabacionModo, setGrabacionModo] = useState<"auto" | "manual" | "library">("auto");
  const [recordingAssetId, setRecordingAssetId] = useState("");
  const [recordings, setRecordings] = useState<RecordingAsset[]>([]);
  const [showRecorder, setShowRecorder] = useState(false);
  const [usarLogin, setUsarLogin] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginConfigured, setLoginConfigured] = useState(false);
  const [savingLogin, setSavingLogin] = useState(false);

  const [mediaConfig, setMediaConfig] = useState<MediaConfig>({
    ...DEFAULT_CONFIG,
    heygen: { ...EMPTY_HEYGEN },
  });

  const loadLogin = useCallback(async () => {
    const r = await fetch(`/api/projects/${projectId}/login`);
    if (r.ok) {
      const d = (await r.json()) as { configured: boolean };
      setLoginConfigured(d.configured);
    }
  }, [projectId]);

  useEffect(() => {
    loadLogin();
  }, [loadLogin]);

  const loadRecordings = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/media`, { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { assets?: RecordingAsset[] };
    setRecordings((data.assets ?? []).filter((asset) => ["recording", "video", "clip"].includes(asset.kind)));
  }, [projectId]);

  useEffect(() => { loadRecordings(); }, [loadRecordings]);

  async function analizar() {
    setLoadingFuncs(true);
    setFuncsErr("");
    const r = await fetch(`/api/projects/${projectId}/functions`, { method: "POST" });
    setLoadingFuncs(false);
    if (!r.ok) {
      setFuncsErr(`HTTP ${r.status}`);
      return;
    }
    const d = (await r.json()) as { funciones: AppFuncion[]; error?: string };
    setFunciones(d.funciones);
    if (d.error) setFuncsErr(d.error);
  }

  function pick(f: AppFuncion) {
    setFuncion(f.nombre);
    setFuncionUrl(f.url);
    setPasosText(f.pasos.join("\n"));
    setNavSteps(f.navSteps);
    setNavStepsText(f.navSteps?.length ? JSON.stringify(f.navSteps, null, 2) : "");
    setNavStepsError("");
    setDryRunState("idle");
    setDryRunMessage("");
  }

  async function saveLogin() {
    if (!loginUser || !loginPass) return;
    setSavingLogin(true);
    const r = await fetch(`/api/projects/${projectId}/login`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: loginUser, pass: loginPass }),
    });
    setSavingLogin(false);
    if (r.ok) {
      setLoginConfigured(true);
      setLoginPass("");
    }
  }

  function updateNavSteps(value: string) {
    setNavStepsText(value);
    setDryRunState("idle");
    setDryRunMessage("");
    if (!value.trim()) {
      setNavSteps(undefined);
      setNavStepsError("");
      return;
    }
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) throw new Error("El JSON debe ser una lista de pasos.");
      const coerced = parsed.map(coerceNavStep);
      if (coerced.some((step) => step === null)) {
        throw new Error("Hay una acción no válida. Usa goto, tap, fill, wait o scroll.");
      }
      setNavSteps(coerced as NavStep[]);
      setNavStepsError("");
    } catch (error) {
      setNavStepsError(error instanceof Error ? error.message : "JSON no válido.");
    }
  }

  function currentDemo(): DemoConfig {
    return {
      funcion: funcion.trim(),
      funcionUrl: funcionUrl.trim(),
      pasos: pasosText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      ...(navSteps?.length ? { navSteps } : {}),
      usarLogin,
      grabacionModo,
      ...(grabacionModo === "library" && recordingAssetId ? { recordingAssetId } : {}),
    };
  }

  async function testSteps() {
    setDryRunState("testing");
    setDryRunMessage("");
    try {
      const r = await fetch(`/api/projects/${projectId}/demo/dryrun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentDemo()),
      });
      const data = (await r.json()) as {
        ok?: boolean;
        failedStep?: number;
        error?: string;
      };
      if (!r.ok || !data.ok) {
        setDryRunState("error");
        setDryRunMessage(
          data.failedStep
            ? `Fallo en el paso ${data.failedStep}: ${data.error ?? "error desconocido"}`
            : data.error ?? `HTTP ${r.status}`,
        );
        return;
      }
      setDryRunState("ok");
      setDryRunMessage("URL y pasos validados correctamente.");
    } catch (error) {
      setDryRunState("error");
      setDryRunMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function submit() {
    if (!funcion.trim()) return;
    const demo = currentDemo();
    onGenerate(demo, mediaConfig);
  }

  const providerError = mediaProviderError(mediaConfig);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass max-h-[90vh] w-full max-w-lg overflow-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Generar contenido propio (mostrar la app)</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 text-sm">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-white/50">Funcionalidad a mostrar</span>
              <button
                onClick={analizar}
                disabled={loadingFuncs}
                className="rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/5 disabled:opacity-40"
              >
                {loadingFuncs ? "Analizando…" : "Analizar con IA"}
              </button>
            </div>
            <p className="mb-2 text-[11px] text-white/40">
              «Analizar con IA» propone funciones de tu app a partir del dossier y
              autorrellena la URL y los pasos. También puedes escribirlos a mano.
            </p>
            {funciones.length > 0 && (
              <div className="mb-2 flex flex-col gap-1">
                {funciones.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => pick(f)}
                    className={[
                      "rounded-lg border px-3 py-2 text-left text-xs",
                      funcion === f.nombre
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15"
                        : "border-white/15 hover:bg-white/5",
                    ].join(" ")}
                  >
                    <b>{f.nombre}</b>
                    <div className="text-white/50">{f.descripcion}</div>
                  </button>
                ))}
              </div>
            )}
            <input
              className="input"
              placeholder="Nombre de la funcionalidad"
              value={funcion}
              onChange={(e) => setFuncion(e.target.value)}
            />
          </div>

          <label className="block">
            <span className="mb-1 block text-xs text-white/50">URL / ruta a grabar</span>
            <input
              className="input"
              placeholder="https://tu-app…/funcionalidad"
              value={funcionUrl}
              onChange={(e) => setFuncionUrl(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/50">Pasos de navegación (uno por línea)</span>
            <textarea
              className="input min-h-20"
              placeholder={"Abrir la app\nIr a la sección…\nPulsar…"}
              value={pasosText}
              onChange={(e) => {
                setPasosText(e.target.value);
                // Los pasos de texto siguen siendo compatibles; al editarlos se
                // descartan selectores tipados que ya no corresponderian.
                setNavSteps(undefined);
                setNavStepsText("");
                setNavStepsError("");
                setDryRunState("idle");
                setDryRunMessage("");
              }}
            />
          </label>

          {grabacionModo === "auto" && (
            <label className="block">
              <span className="mb-1 block text-xs text-white/50">
                Pasos automáticos Playwright (JSON opcional)
              </span>
              <textarea
                className="input min-h-32 font-mono text-[11px]"
                placeholder={'[\n  { "action": "goto", "url": "https://…" },\n  { "action": "tap", "selector": "[data-testid=\\"boton\\"]" }\n]'}
                value={navStepsText}
                onChange={(event) => updateNavSteps(event.target.value)}
              />
              <span className="mt-1 block text-[10px] text-white/35">
                «Analizar con IA» los rellena con selectores del repositorio. Vacío mantiene el
                recorrido compatible por scroll.
              </span>
              {navStepsError && (
                <span className="mt-1 block text-xs text-[var(--color-state-error)]">
                  {navStepsError}
                </span>
              )}
            </label>
          )}

          <div>
            <span className="mb-1 block text-xs text-white/50">Grabación de la app</span>
            <div className="flex gap-2">
              {(["auto", "manual", "library"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setGrabacionModo(m)}
                  className={[
                    "flex-1 rounded-lg border px-3 py-2 text-sm",
                    grabacionModo === m
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15"
                      : "border-white/15 hover:bg-white/5",
                  ].join(" ")}
                >
                  {m === "auto" ? "Automática" : m === "manual" ? "Subir después" : "Mediateca / REC"}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-white/40">
              {grabacionModo === "auto"
                ? "Playwright abre tu app en tamaño móvil, navega los pasos y graba sola (requiere que la app sea accesible + login si lo marcas)."
                : grabacionModo === "manual"
                  ? "Se crea la pieza sin grabar; luego sube tu vídeo en su tarjeta."
                  : "Elige una grabación reutilizable o graba ahora con REC/STOP."}
            </p>
          </div>

          {grabacionModo === "library" && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <label className="text-xs text-white/55">Grabación de la mediateca
                <select className="input mt-1" value={recordingAssetId} onChange={(event) => setRecordingAssetId(event.target.value)}>
                  <option value="">Selecciona una grabación…</option>
                  {recordings.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}{asset.duration ? ` · ${asset.duration.toFixed(1)}s` : ""}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => setShowRecorder(true)} className="mt-2 rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white">● Grabar ahora</button>
            </div>
          )}

          {grabacionModo === "auto" && (
            <div className="flex flex-col gap-2">
              <div className="rounded-lg bg-white/5 p-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={usarLogin} onChange={(e) => setUsarLogin(e.target.checked)} />
                  <span className="text-xs text-white/70">
                    Requiere login {loginConfigured && <span className="text-[var(--color-state-ok)]">· credenciales guardadas</span>}
                  </span>
                </label>
                {usarLogin && (
                  <div className="mt-2 flex flex-col gap-2">
                    <input
                      className="input"
                      placeholder="Usuario / email"
                      value={loginUser}
                      onChange={(e) => setLoginUser(e.target.value)}
                    />
                    <input
                      className="input"
                      type="password"
                      placeholder={loginConfigured ? "•••••••• (guardada)" : "Contraseña"}
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                    />
                    <button
                      onClick={saveLogin}
                      disabled={savingLogin || !loginUser || !loginPass}
                      className="self-start rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/5 disabled:opacity-40"
                    >
                      {savingLogin ? "Guardando…" : "Guardar credenciales (cifradas)"}
                    </button>
                    <p className="text-[10px] text-white/30">
                      Se cifran en local (AES-256-GCM) por proyecto. La contraseña nunca se muestra ni sale del PC.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={testSteps}
                  disabled={dryRunState === "testing" || !funcionUrl.trim() || Boolean(navStepsError)}
                  className="rounded-lg border border-[var(--color-accent)]/40 px-3 py-2 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 disabled:opacity-40"
                >
                  {dryRunState === "testing" ? "Probando…" : "Probar pasos"}
                </button>
                {dryRunMessage && (
                  <span
                    className={[
                      "text-xs",
                      dryRunState === "ok"
                        ? "text-[var(--color-state-ok)]"
                        : "text-[var(--color-state-error)]",
                    ].join(" ")}
                  >
                    {dryRunMessage}
                  </span>
                )}
              </div>
            </div>
          )}

          <MediaProviderConfigurator
            value={mediaConfig}
            onChange={setMediaConfig}
            disabled={busy}
          />

          {providerError && (
            <div className="text-xs text-[var(--color-state-pending)]">{providerError}</div>
          )}
          {funcsErr && <div className="text-xs text-[var(--color-state-pending)]">{funcsErr}</div>}

          <div className="rounded-lg bg-white/5 p-3 text-xs text-white/50">
            Se genera un guion <b>product-led</b> y se combina el vídeo elegido con la grabación real
            de la app. Si eliges un avatar, puedes narrarlo con una voz del catálogo o con tu propio
            audio. Las claves se gestionan en Ajustes.
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
              disabled={
                busy ||
                !funcion.trim() ||
                (grabacionModo === "auto" && Boolean(navStepsError)) ||
                (grabacionModo === "library" && !recordingAssetId) ||
                Boolean(providerError)
              }
              className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
            >
              {busy ? "Lanzando…" : "Generar"}
            </button>
          </div>
        </div>
      </div>
      {showRecorder && (
        <SelfRecordModal
          projectId={projectId}
          initialUrl={funcionUrl}
          onClose={() => setShowRecorder(false)}
          onSaved={async (asset) => {
            await loadRecordings();
            setRecordingAssetId(asset.id);
            setShowRecorder(false);
          }}
        />
      )}
    </div>
  );
}
