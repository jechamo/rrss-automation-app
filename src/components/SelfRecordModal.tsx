"use client";

import { useEffect, useRef, useState } from "react";

export type SavedMediaAsset = {
  id: string;
  name: string;
  path: string;
  mimeType: string;
};

type RecorderState = "ready" | "requesting" | "recording" | "review" | "saving";

export function SelfRecordModal({
  projectId,
  initialUrl,
  onClose,
  onSaved,
}: {
  projectId: string;
  initialUrl: string;
  onClose: () => void;
  onSaved: (asset: SavedMediaAsset) => void | Promise<void>;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [name, setName] = useState(`Grabación ${new Date().toLocaleDateString("es-ES")}`);
  const [state, setState] = useState<RecorderState>("ready");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (state !== "recording") return;
    const started = Date.now() - seconds * 1000;
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [state, seconds]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function openMobile() {
    setError("");
    try {
      const parsed = new URL(url.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      window.open(parsed.toString(), "rrss-self-record", "popup=yes,width=430,height=880,resizable=yes,scrollbars=yes");
    } catch {
      setError("Escribe una URL http/https válida.");
    }
  }

  async function startRecording() {
    setError("");
    setBlob(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setSeconds(0);
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 }, displaySurface: "window" },
        audio: false,
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const result = new Blob(chunksRef.current, { type: "video/webm" });
        const objectUrl = URL.createObjectURL(result);
        setBlob(result);
        setPreview(objectUrl);
        setState("review");
        stream.getTracks().forEach((track) => track.stop());
      };
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorder.state !== "inactive") recorder.stop();
      });
      recorder.start(500);
      setState("recording");
    } catch (cause) {
      setState("ready");
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar la captura.");
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function save() {
    if (!blob || !name.trim()) return;
    setState("saving");
    setError("");
    const form = new FormData();
    form.set("file", new File([blob], "screencast.webm", { type: "video/webm" }));
    form.set("kind", "recording");
    form.set("origin", "recorder");
    form.set("name", name.trim());
    try {
      const response = await fetch(`/api/projects/${projectId}/media`, { method: "POST", body: form });
      const data = (await response.json()) as { asset?: SavedMediaAsset; error?: string };
      if (!response.ok || !data.asset) throw new Error(data.error || `HTTP ${response.status}`);
      await onSaved(data.asset);
    } catch (cause) {
      setState("review");
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la grabación.");
    }
  }

  const timer = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const step = state === "recording" ? 3 : state === "review" || state === "saving" ? 4 : 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="glass-strong w-full max-w-3xl overflow-hidden shadow-2xl">
        <header className="flex items-start justify-between border-b border-white/10 p-5">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-accent-2)]">Captura local</div>
            <h2 className="mt-1 text-xl font-bold">Graba tú mismo</h2>
            <p className="mt-1 text-xs text-white/45">Tu login sucede en tu app; RRSS Studio no ve ni guarda la contraseña.</p>
          </div>
          <button onClick={onClose} disabled={state === "recording" || state === "saving"} className="text-white/45 hover:text-white disabled:opacity-30">✕</button>
        </header>

        <div className="grid grid-cols-4 border-b border-white/10 text-center text-[11px]">
          {["Preparar", "Compartir", "Grabar", "Revisar"].map((label, index) => (
            <div key={label} className={`px-2 py-2 ${step >= index + 1 ? "bg-white/5 text-white" : "text-white/30"}`}>
              <span className="mr-1 text-[var(--color-accent-2)]">{index + 1}</span>{label}
            </div>
          ))}
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col gap-4">
            <label className="text-xs text-white/55">
              URL de tu app
              <input className="input mt-1" value={url} onChange={(event) => setUrl(event.target.value)} disabled={state === "recording"} />
            </label>
            <button onClick={openMobile} disabled={state === "recording"} className="rounded-xl border border-[var(--color-accent-2)]/40 bg-[var(--color-accent-2)]/10 px-4 py-3 text-sm font-medium hover:bg-[var(--color-accent-2)]/15 disabled:opacity-40">
              Abrir app en formato móvil ↗
            </button>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-white/50">
              Abre la app, inicia sesión y vuelve aquí. Al pulsar REC elige la ventana móvil en el selector del navegador. Ese paso de seguridad no puede automatizarse.
            </div>
            {state === "review" || state === "saving" ? (
              <label className="text-xs text-white/55">Nombre de la grabación<input className="input mt-1" value={name} onChange={(event) => setName(event.target.value)} /></label>
            ) : null}
          </div>

          <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/45 p-4">
            {preview ? (
              <video src={preview} controls className="max-h-[420px] w-full rounded-xl bg-black" />
            ) : (
              <div className="text-center">
                <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 ${state === "recording" ? "border-red-400 bg-red-500/20 shadow-[0_0_40px_rgba(248,113,113,.35)]" : "border-white/10 bg-white/5"}`}>
                  <span className={`h-7 w-7 ${state === "recording" ? "animate-pulse rounded bg-red-500" : "rounded-full bg-red-500"}`} />
                </div>
                <div className="mt-4 font-mono text-3xl tracking-wider">{timer}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-white/35">
                  {state === "requesting" ? "Elige una ventana" : state === "recording" ? "Grabando" : "Preparado"}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <div className="mx-5 mb-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}

        <footer className="flex flex-wrap justify-end gap-2 border-t border-white/10 p-4">
          {state === "ready" || state === "requesting" ? (
            <button onClick={startRecording} disabled={state === "requesting"} className="rounded-xl bg-red-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 disabled:opacity-40">● REC</button>
          ) : null}
          {state === "recording" ? (
            <button onClick={stopRecording} className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-black">■ STOP</button>
          ) : null}
          {state === "review" || state === "saving" ? (
            <>
              <button onClick={() => { setBlob(null); setPreview(""); setState("ready"); setSeconds(0); }} disabled={state === "saving"} className="rounded-xl border border-white/15 px-4 py-3 text-sm hover:bg-white/5">Repetir</button>
              <button onClick={save} disabled={state === "saving" || !name.trim()} className="rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold disabled:opacity-40">{state === "saving" ? "Guardando…" : "Guardar grabación"}</button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
