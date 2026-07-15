"use client";

import { useCallback, useEffect, useState } from "react";
import type { DemoConfig, MediaConfig } from "@/core/content/types";

type AppFuncion = { nombre: string; descripcion: string; url: string; pasos: string[] };

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

  const [grabacionModo, setGrabacionModo] = useState<"auto" | "manual">("auto");
  const [usarLogin, setUsarLogin] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginConfigured, setLoginConfigured] = useState(false);
  const [savingLogin, setSavingLogin] = useState(false);

  const [videoAuto, setVideoAuto] = useState(true);
  const [videoModelo, setVideoModelo] = useState("");
  const [vozAuto, setVozAuto] = useState(true);
  const [vozId, setVozId] = useState("");

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

  function submit() {
    if (!funcion.trim()) return;
    const demo: DemoConfig = {
      funcion: funcion.trim(),
      funcionUrl: funcionUrl.trim(),
      pasos: pasosText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      usarLogin,
      grabacionModo,
    };
    const config: Partial<MediaConfig> = {
      videoAuto,
      videoModelo: videoAuto ? "" : videoModelo,
      vozAuto,
      vozId: vozAuto ? "" : vozId,
    };
    onGenerate(demo, config);
  }

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
              onChange={(e) => setPasosText(e.target.value)}
            />
          </label>

          <div>
            <span className="mb-1 block text-xs text-white/50">Grabación de la app</span>
            <div className="flex gap-2">
              {(["auto", "manual"] as const).map((m) => (
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
                  {m === "auto" ? "Automática (Playwright móvil)" : "Manual (subir vídeo)"}
                </button>
              ))}
            </div>
          </div>

          {grabacionModo === "auto" && (
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
          )}

          <div className="flex gap-3">
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={videoAuto} onChange={(e) => setVideoAuto(e.target.checked)} />
              Modelo de vídeo auto
            </label>
            {!videoAuto && (
              <input
                className="input flex-1"
                placeholder="id de modelo fal"
                value={videoModelo}
                onChange={(e) => setVideoModelo(e.target.value)}
              />
            )}
          </div>
          <div className="flex gap-3">
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={vozAuto} onChange={(e) => setVozAuto(e.target.checked)} />
              Voz auto (ElevenLabs)
            </label>
            {!vozAuto && (
              <input
                className="input flex-1"
                placeholder="id de voz ElevenLabs"
                value={vozId}
                onChange={(e) => setVozId(e.target.value)}
              />
            )}
          </div>

          {funcsErr && <div className="text-xs text-[var(--color-state-pending)]">{funcsErr}</div>}

          <div className="rounded-lg bg-white/5 p-3 text-xs text-white/50">
            Se genera un guion <b>product-led</b> y cortes B-roll (fal.ai) para intercalar con la grabación
            real de la app. El montaje final (FFmpeg) queda pendiente. Las keys reales están en Ajustes.
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
              disabled={busy || !funcion.trim()}
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
