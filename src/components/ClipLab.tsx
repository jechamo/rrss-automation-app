"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type {
  ClipJob,
  ClipJsonTimingMode,
  ClipMoment,
  ClipSelectionMode,
  ClipSourceType,
  ClipStage,
  ClipSubtitleMode,
  ImportedClipPlan,
} from "@/core/clips/contracts";
import { composeTikTokCopy, type ClipPublishRanking } from "@/core/clips/publish";

type Tools = { gemini: boolean; ffmpeg: boolean; ffprobe: boolean; ytdlp: boolean; whisper: boolean };
type Ranking = "viral" | "controversial";
type CleanupScope = "outputs" | "history";

const JSON_PLACEHOLDER = `{
  "top_10_virales": [{
    "ranking": 1,
    "start_time": "00:12:30",
    "end_time": "00:13:05",
    "hook_inicial": "Frase exacta con la que empieza",
    "transcripcion_completa": "Texto completo del fragmento...",
    "justificacion": "Por qué puede ser viral.",
    "subtitulos_sincronizados": [
      {
        "start_time": "00:12:30",
        "end_time": "00:12:34",
        "texto": "Primer subtítulo ya sincronizado."
      }
    ]
  }],
  "top_10_polemicos": []
}`;

const STAGES: Array<{ id: ClipStage; label: string }> = [
  { id: "source", label: "Fuente" },
  { id: "understanding", label: "Comprensión" },
  { id: "selection", label: "Selección" },
  { id: "rendering", label: "Render vertical" },
  { id: "results", label: "Resultados" },
];

export function ClipLab() {
  const [jobs, setJobs] = useState<ClipJob[]>([]);
  const [tools, setTools] = useState<Tools>({ gemini: false, ffmpeg: false, ffprobe: false, ytdlp: false, whisper: false });
  const [selectedId, setSelectedId] = useState<string>("");
  const [sourceType, setSourceType] = useState<ClipSourceType>("upload");
  const [selectionMode, setSelectionMode] = useState<ClipSelectionMode>("ai");
  const [jsonTiming, setJsonTiming] = useState<ClipJsonTimingMode>("direct");
  const [file, setFile] = useState<File | null>(null);
  const [selectionJson, setSelectionJson] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [title, setTitle] = useState("");
  const [ranking, setRanking] = useState<Ranking>("viral");
  const [starting, setStarting] = useState(false);
  const [sourceReset, setSourceReset] = useState(0);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string>("");
  const [cleanupScope, setCleanupScope] = useState<CleanupScope | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [notice, setNotice] = useState("");
  const [regenerateId, setRegenerateId] = useState("");
  const [rerenderTarget, setRerenderTarget] = useState<{ jobId: string; momentId: string } | null>(null);
  const [publishTarget, setPublishTarget] = useState<{
    jobId: string;
    momentId: string;
    ranking: ClipPublishRanking;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const selected = jobs.find((job) => job.id === selectedId) ?? null;
  const directUsesSyncedCues = Boolean(
    selected?.selection?.source === "json"
    && selected.selection.jsonTiming === "direct"
    && selected.selection.moments.length > 0
    && selected.selection.moments.every((moment) => moment.subtitleSource === "synced_json"),
  );

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/clips", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json() as { jobs: ClipJob[]; tools: Tools };
      setJobs(data.jobs);
      setTools(data.tools);
      setSelectedId((current) => current || data.jobs[0]?.id || "");
    } catch {
      setError("No se pudo cargar el historial. Comprueba que RRSS Studio siga en ejecución.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedId || (selected?.status !== "processing" && selected?.status !== "pending")) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/clips/${selectedId}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { job: ClipJob };
        setJobs((current) => {
          const exists = current.some((job) => job.id === data.job.id);
          const next = exists
            ? current.map((job) => job.id === data.job.id ? data.job : job)
            : [data.job, ...current];
          return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });
      } catch {
        // El siguiente pulso recupera el estado si el servidor local vuelve a estar disponible.
      }
    }, 1600);
    return () => window.clearInterval(timer);
  }, [selectedId, selected?.status]);

  async function submit() {
    if (sourceType === "upload" && !file) {
      setError("Selecciona un vídeo local.");
      return;
    }
    if (sourceType === "youtube" && !sourceUrl.trim()) {
      setError("Introduce la URL pública de YouTube.");
      return;
    }
    if (selectionMode === "json" && !selectionJson.trim()) {
      setError("Pega el JSON editorial o selecciona un fichero .json.");
      return;
    }
    setStarting(true);
    setError("");
    const form = new FormData();
    form.set("sourceType", sourceType);
    form.set("selectionMode", selectionMode);
    if (selectionMode === "json") form.set("jsonTiming", jsonTiming);
    form.set("title", title);
    if (selectionMode === "json") form.set("selectionJson", selectionJson);
    if (file) form.set("file", file);
    if (sourceUrl) form.set("sourceUrl", sourceUrl);
    try {
      const response = await fetch("/api/clips", { method: "POST", body: form });
      const data = await response.json().catch(() => ({})) as { job?: ClipJob; error?: string };
      if (!response.ok || !data.job) {
        setError(data.error ?? "No se pudo iniciar el análisis.");
        return;
      }
      setJobs((current) => [data.job!, ...current.filter((job) => job.id !== data.job!.id)]);
      setSelectedId(data.job.id);
      setFile(null);
      setSourceUrl("");
      setSelectionJson("");
      setTitle("");
      setSourceReset((current) => current + 1);
    } catch {
      setError("Se perdió la conexión local antes de iniciar el análisis.");
    } finally {
      setStarting(false);
    }
  }

  async function retry(id: string) {
    setError("");
    try {
      const response = await fetch(`/api/clips/${id}/retry`, { method: "POST" });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo reintentar.");
        return;
      }
      await load();
      setSelectedId(id);
    } catch {
      setError("Se perdió la conexión local al reintentar.");
    }
  }

  async function remove(id: string) {
    try {
      const response = await fetch(`/api/clips/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setError("No se pudo eliminar el análisis.");
        return;
      }
      const next = jobs.filter((job) => job.id !== id);
      setJobs(next);
      setSelectedId(next[0]?.id ?? "");
      setConfirmDelete("");
    } catch {
      setError("Se perdió la conexión local al eliminar.");
    }
  }

  async function resumePending(id: string) {
    setActionBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/clips/${id}/resume`, { method: "POST" });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo continuar el trabajo.");
        return;
      }
      setJobs((current) => current.map((job) => job.id === id
        ? {
            ...job,
            status: "processing",
            stage: "rendering",
            error: undefined,
            activeOperation: {
              kind: "full",
              label: `Continuando ${pendingClipCount(job)} clip(s) pendiente(s)`,
            },
          }
        : job));
      setSelectedId(id);
      setNotice("Reanudación iniciada: se validan los MP4 existentes y solo se generan los pendientes o incompletos, sin usar Gemini.");
    } catch {
      setError("Se perdió la conexión local al continuar el trabajo.");
    } finally {
      setActionBusy(false);
    }
  }

  async function cleanup(scope: CleanupScope) {
    setCleaning(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/clips?scope=${scope}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({})) as {
        error?: string;
        summary?: { jobs: number; files: number; bytes: number };
      };
      if (!response.ok || !data.summary) {
        setError(data.error ?? "No se pudo completar la limpieza.");
        return;
      }
      const saved = formatBytes(data.summary.bytes);
      setNotice(
        scope === "outputs"
          ? `Se eliminaron ${data.summary.files} archivo(s) procesado(s) de ${data.summary.jobs} trabajo(s) y se liberaron ${saved}. Las fuentes y el historial siguen disponibles.`
          : `Historial vaciado: ${data.summary.jobs} trabajo(s) y ${data.summary.files} archivo(s) eliminados; ${saved} liberados.`,
      );
      setCleanupScope(null);
      await load();
      if (scope === "history") setSelectedId("");
    } catch {
      setError("Se perdió la conexión local durante la limpieza.");
    } finally {
      setCleaning(false);
    }
  }

  async function regenerateHistory(input: {
    jobId: string;
    title: string;
    selectionMode: ClipSelectionMode;
    jsonTiming: ClipJsonTimingMode;
    selectionJson: string;
  }) {
    setActionBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/clips/${input.jobId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json().catch(() => ({})) as { job?: ClipJob; error?: string };
      if (!response.ok || !data.job) {
        setError(data.error ?? "No se pudo crear la nueva versión.");
        return;
      }
      setJobs((current) => [data.job!, ...current.filter((job) => job.id !== data.job!.id)]);
      setSelectedId(data.job.id);
      setRegenerateId("");
      setNotice("Nueva versión creada en el historial. La fuente original se reutiliza y el trabajo anterior se conserva.");
    } catch {
      setError("Se perdió la conexión local al regenerar el historial.");
    } finally {
      setActionBusy(false);
    }
  }

  async function rerenderMoment(
    jobId: string,
    momentId: string,
    subtitleMode: ClipSubtitleMode,
  ) {
    setActionBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/clips/${jobId}/moments/${encodeURIComponent(momentId)}/render`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subtitleMode }),
        },
      );
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo iniciar la regeneración del clip.");
        return;
      }
      setRerenderTarget(null);
      await load();
      setSelectedId(jobId);
      setNotice("Regenerando únicamente el clip seleccionado. No se modificarán los demás vídeos.");
    } catch {
      setError("Se perdió la conexión local al regenerar el clip.");
    } finally {
      setActionBusy(false);
    }
  }

  const needsGemini = selectionMode === "ai" || jsonTiming === "gemini";
  const requiredReady = (!needsGemini || tools.gemini) && tools.ffmpeg && tools.ffprobe && tools.whisper
    && (sourceType !== "youtube" || tools.ytdlp);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <header className="relative overflow-hidden rounded-2xl border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,.18),transparent_42%),radial-gradient(circle_at_top_right,rgba(34,211,238,.12),transparent_36%),rgba(5,5,12,.9)] p-6">
        <div className="relative max-w-3xl">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-fuchsia-300">REQ-018 · Editor inteligente</div>
          <h1 className="text-3xl font-black tracking-tight">Laboratorio de clips virales y polémicos</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            Detecta momentos con hook, tensión y contexto real. La herramienta descarta cortes débiles,
            crea rankings independientes y entrega vídeos verticales subtitulados listos para revisar.
          </p>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="glass p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Nueva fuente</h2>
              <p className="text-xs text-white/40">El análisis no se inicia si faltan herramientas.</p>
            </div>
            <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
              <ModeButton active={sourceType === "upload"} onClick={() => setSourceType("upload")}>Subir vídeo</ModeButton>
              <ModeButton active={sourceType === "youtube"} onClick={() => setSourceType("youtube")}>YouTube</ModeButton>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/60">Nombre del análisis · opcional</span>
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Entrevista sobre inteligencia artificial" />
            </label>
            {sourceType === "upload" ? (
              <label key={`upload-source-${sourceReset}`} className="block">
                <span className="mb-1.5 block text-xs font-medium text-white/60">Vídeo · MP4, MOV, WebM o M4V · máx. 500 MB</span>
                <input
                  className="input file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-500/20 file:px-3 file:py-1 file:text-xs file:text-fuchsia-100"
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,.m4v"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
            ) : (
              <label key="youtube-source" className="block">
                <span className="mb-1.5 block text-xs font-medium text-white/60">URL pública de YouTube</span>
                <input className="input" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
              </label>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-white/8 bg-black/15 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Cómo se eligen los cortes</div>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/40">
                  Elige un único método. Con JSON se respetan exactamente tus rankings y tiempos;
                  después decides si temporizar localmente o verificar contra el audio con Gemini.
                </p>
              </div>
              <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
                <ModeButton active={selectionMode === "ai"} onClick={() => setSelectionMode("ai")}>Descubrir con IA</ModeButton>
                <ModeButton active={selectionMode === "json"} onClick={() => setSelectionMode("json")}>Usar mi JSON</ModeButton>
              </div>
            </div>

            {selectionMode === "json" && (
              <div className="mt-4">
                <div className="mb-4 grid gap-2 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setJsonTiming("direct")}
                    className={`rounded-xl border p-3 text-left transition ${jsonTiming === "direct" ? "border-emerald-300/35 bg-emerald-400/10" : "border-white/8 bg-black/15 hover:border-white/15"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">Directo · sin Gemini</span>
                      <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-200">0 créditos IA</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                      Usa exactamente <code className="text-emerald-100/70">subtitulos_sincronizados</code> cuando
                      existan. Si faltan, extrae el audio exacto de cada corte y lo transcribe con
                      Whisper local; nunca temporiza el texto proporcionalmente.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setJsonTiming("gemini")}
                    className={`rounded-xl border p-3 text-left transition ${jsonTiming === "gemini" ? "border-cyan-300/35 bg-cyan-400/10" : "border-white/8 bg-black/15 hover:border-white/15"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">Verificar con Gemini</span>
                      <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] text-cyan-100">Más preciso</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                      Escucha solo tus intervalos, corrige el texto literal y bloquea el montaje si
                      detecta que transcripción o timecodes no corresponden.
                    </p>
                  </button>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-white/60">JSON editorial</span>
                  <textarea
                    className="input min-h-56 resize-y font-mono text-[11px] leading-relaxed"
                    value={selectionJson}
                    onChange={(event) => setSelectionJson(event.target.value)}
                    placeholder={JSON_PLACEHOLDER}
                    spellCheck={false}
                  />
                  </label>
                  <div className="space-y-3">
                    <label className="block rounded-xl border border-dashed border-fuchsia-300/20 bg-fuchsia-400/5 p-3">
                      <span className="mb-2 block text-xs font-semibold text-fuchsia-100">O cargar fichero .json</span>
                      <input
                        key={`json-source-${sourceReset}`}
                        className="block w-full text-[11px] text-white/45 file:mr-2 file:rounded-lg file:border-0 file:bg-fuchsia-500/20 file:px-2.5 file:py-1.5 file:text-fuchsia-100"
                        type="file"
                        accept="application/json,.json"
                        onChange={(event) => {
                          const jsonFile = event.target.files?.[0];
                          if (!jsonFile) return;
                          if (jsonFile.size > 2 * 1024 * 1024) {
                            setError("El JSON no puede superar 2 MB.");
                            return;
                          }
                          void jsonFile.text()
                            .then((value) => {
                              setSelectionJson(value);
                              setError("");
                            })
                            .catch(() => setError("No se pudo leer el fichero JSON."));
                        }}
                      />
                    </label>
                    <div className={`rounded-xl border p-3 text-[11px] leading-relaxed text-white/50 ${jsonTiming === "gemini" ? "border-cyan-300/15 bg-cyan-300/5" : "border-amber-300/15 bg-amber-300/5"}`}>
                      <div className={`font-semibold ${jsonTiming === "gemini" ? "text-cyan-100" : "text-amber-100"}`}>
                        {jsonTiming === "gemini" ? "Protección de sincronía activa" : "Timing exacto del JSON"}
                      </div>
                      <p className="mt-1">
                        Cada corte debe durar 10–90 s y quedar dentro del vídeo.
                        {jsonTiming === "gemini"
                          ? " Si el texto no coincide con el audio, el render se bloquea."
                          : " No se consumirá Gemini: se usarán cues sincronizados, CC de YouTube o Whisper local."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
            <div className="flex flex-wrap gap-2">
              {needsGemini
                ? <ToolBadge label="Gemini" ok={tools.gemini} />
                : <span className="rounded-full border border-emerald-300/20 bg-emerald-400/8 px-2.5 py-1 text-[11px] text-emerald-200">✓ Sin consumo Gemini</span>}
              <ToolBadge label="FFmpeg" ok={tools.ffmpeg} />
              <ToolBadge label="ffprobe" ok={tools.ffprobe} />
              <ToolBadge label="Whisper local" ok={tools.whisper} />
              {sourceType === "youtube" && <ToolBadge label="yt-dlp" ok={tools.ytdlp} />}
              {!requiredReady && <Link href="/ajustes" className="rounded-full border border-amber-300/25 px-2.5 py-1 text-[11px] text-amber-200 hover:bg-amber-300/10">Revisar Ajustes →</Link>}
            </div>
            <button
              onClick={() => void submit()}
              disabled={starting || !requiredReady}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-2.5 text-sm font-bold shadow-[0_0_28px_rgba(217,70,239,.2)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {starting
                ? "Preparando fuente…"
                : selectionMode === "json"
                  ? "Validar JSON y crear clips"
                  : "Analizar y crear clips"}
            </button>
          </div>
          {error && <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
          {notice && <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/8 p-3 text-sm text-emerald-100">{notice}</div>}
        </div>

        <aside className="glass max-h-[440px] overflow-hidden p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Historial</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/35">{jobs.length}</span>
              {jobs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCleanupScope((current) => current ? null : "outputs")}
                  className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/55 hover:bg-white/5"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
          {cleanupScope && (
            <div className="mb-3 rounded-xl border border-rose-300/15 bg-rose-500/5 p-3">
              <div className="text-xs font-semibold text-white/80">Limpieza general</div>
              <p className="mt-1 text-[10px] leading-relaxed text-white/40">
                {cleanupScope === "outputs"
                  ? "Elimina MP4, miniaturas y subtítulos generados. Conserva fuentes, JSON, análisis y registro."
                  : "Elimina definitivamente todos los trabajos, fuentes, resultados y registros de Clip Lab."}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setCleanupScope("outputs")}
                  className={`rounded-lg border px-2 py-1.5 text-[10px] ${cleanupScope === "outputs" ? "border-amber-300/35 bg-amber-300/10 text-amber-100" : "border-white/8 text-white/40"}`}
                >
                  Vídeos procesados
                </button>
                <button
                  type="button"
                  onClick={() => setCleanupScope("history")}
                  className={`rounded-lg border px-2 py-1.5 text-[10px] ${cleanupScope === "history" ? "border-rose-300/35 bg-rose-300/10 text-rose-100" : "border-white/8 text-white/40"}`}
                >
                  Todo el historial
                </button>
              </div>
              <div className="mt-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => setCleanupScope(null)}
                  disabled={cleaning}
                  className="flex-1 rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-white/55"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void cleanup(cleanupScope)}
                  disabled={cleaning}
                  className="flex-1 rounded-lg bg-rose-500/20 px-2 py-1.5 text-[10px] font-semibold text-rose-100 disabled:opacity-50"
                >
                  {cleaning ? "Eliminando…" : "Confirmar"}
                </button>
              </div>
            </div>
          )}
          <div className="app-scroll flex max-h-[315px] flex-col gap-2 overflow-y-auto pr-1">
            {jobs.length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-white/35">Todavía no hay análisis.</div>}
            {jobs.map((job) => (
              <button
                key={job.id}
                onClick={() => { setSelectedId(job.id); setConfirmDelete(""); }}
                className={`rounded-xl border p-3 text-left transition ${selectedId === job.id ? "border-fuchsia-400/40 bg-fuchsia-400/10" : "border-white/8 bg-black/15 hover:border-white/15"}`}
              >
                <div className="line-clamp-1 text-sm font-semibold">{job.title}</div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-white/40">
                  <span>
                    {job.sourceType === "youtube" ? "YouTube" : "Archivo local"}
                    {" · "}
                    {(job.selectionMode ?? "ai") === "json" ? "JSON" : "IA"}
                    {(job.selectionMode ?? "ai") === "json" && (
                      <> · {job.jsonTiming === "gemini" ? "Gemini" : "Directo"}</>
                    )}
                    {pendingClipCount(job) > 0 && <> · {pendingClipCount(job)} pendientes</>}
                  </span>
                  <StatusLabel status={job.status} />
                </div>
              </button>
            ))}
          </div>
        </aside>
      </section>

      {selected && (
        <section className="flex flex-col gap-4">
          <JobProgress job={selected} />
          {selected.status === "error" && (
            <div className="glass border border-rose-400/25 p-4">
              <div className="font-semibold text-rose-200">No se pudo completar</div>
              <p className="mt-1 text-sm text-white/55">{selected.error}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {selected.selection && selected.sourceFile && (
                  <button
                    onClick={() => void resumePending(selected.id)}
                    disabled={actionBusy}
                    className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-2 text-sm font-semibold disabled:opacity-40"
                  >
                    {pendingClipCount(selected) > 0
                      ? `Continuar ${pendingClipCount(selected)} pendientes`
                      : "Validar y continuar"}
                  </button>
                )}
                <button
                  onClick={() => void retry(selected.id)}
                  disabled={actionBusy}
                  className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-40"
                >
                  Reiniciar desde cero
                </button>
                <button onClick={() => setRegenerateId(selected.id)} className="rounded-lg border border-fuchsia-300/20 px-3 py-2 text-sm text-fuchsia-100 hover:bg-fuchsia-400/10">Regenerar con opciones</button>
                <DeleteActions id={selected.id} confirmId={confirmDelete} setConfirmId={setConfirmDelete} onDelete={remove} />
              </div>
            </div>
          )}
          {(selected.status === "ready" || selected.status === "processing" || selected.status === "error") && selected.selection && (
            <>
              <div className="glass flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-sm font-semibold">{selected.title}</div>
                  <div className="mt-1 text-xs text-white/40">{selected.selection.summary || "Análisis multimodal completado."}</div>
                </div>
                <div className="flex items-center gap-2">
                  {selected.status !== "error" && pendingClipCount(selected) > 0 && (
                    <button
                      onClick={() => void resumePending(selected.id)}
                      disabled={selected.status === "processing" || actionBusy}
                      className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-2 text-xs font-semibold disabled:opacity-40"
                    >
                      Continuar {pendingClipCount(selected)} pendientes
                    </button>
                  )}
                  <button
                    onClick={() => setRegenerateId(selected.id)}
                    disabled={selected.status === "processing"}
                    className="rounded-lg border border-fuchsia-300/20 px-3 py-2 text-xs text-fuchsia-100 hover:bg-fuchsia-400/10 disabled:opacity-40"
                  >
                    Regenerar con opciones
                  </button>
                  <DeleteActions id={selected.id} confirmId={confirmDelete} setConfirmId={setConfirmDelete} onDelete={remove} />
                </div>
              </div>
              {selected.selection.source === "json" && selected.selection.jsonTiming === "direct" && (
                <div className={`rounded-xl border p-4 text-xs leading-relaxed ${directUsesSyncedCues ? "border-emerald-300/20 bg-emerald-300/5 text-emerald-100/75" : "border-amber-300/20 bg-amber-300/5 text-amber-100/75"}`}>
                  <span className="font-semibold">
                    {directUsesSyncedCues ? "Subtítulos sincronizados desde el JSON." : "Modo directo compatible."}
                  </span>{" "}
                  {directUsesSyncedCues
                    ? "Se han respetado exactamente sus textos y timecodes, sin consumir Gemini."
                    : "Los cortes sin cues del JSON se subtitulan desde sus CC de YouTube o desde el audio exacto con Whisper local."}
                </div>
              )}
              {selected.selection.moments.some((moment) => moment.renderError) && (
                <details className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs text-amber-100/75">
                  <summary className="cursor-pointer font-semibold">Algunos candidatos no pudieron renderizarse</summary>
                  <div className="mt-2 space-y-1">
                    {selected.selection.moments
                      .filter((moment) => moment.renderError)
                      .map((moment) => <div key={moment.id}>• {moment.title}: {moment.renderError}</div>)}
                  </div>
                </details>
              )}
              {selected.outputsDeletedAt && !selected.selection.moments.some((moment) => moment.outputName) && (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-relaxed text-amber-100/75">
                  <span className="font-semibold">Vídeos procesados eliminados.</span>{" "}
                  La fuente, el análisis y los rankings se conservan. Usa «Continuar pendientes» para reconstruirlos sin repetir el análisis.
                </div>
              )}
              <RankingTabs
                job={selected}
                ranking={ranking}
                setRanking={setRanking}
                onRerender={(momentId) => setRerenderTarget({ jobId: selected.id, momentId })}
                onPublish={(momentId, targetRanking) => setPublishTarget({
                  jobId: selected.id,
                  momentId,
                  ranking: targetRanking,
                })}
              />
            </>
          )}
        </section>
      )}
      {regenerateId && jobs.find((job) => job.id === regenerateId) && (
        <RegenerateJobModal
          job={jobs.find((job) => job.id === regenerateId)!}
          tools={tools}
          busy={actionBusy}
          onClose={() => setRegenerateId("")}
          onSubmit={regenerateHistory}
        />
      )}
      {rerenderTarget && (() => {
        const job = jobs.find((candidate) => candidate.id === rerenderTarget.jobId);
        const moment = job?.selection?.moments.find((candidate) => candidate.id === rerenderTarget.momentId);
        return job && moment ? (
          <RerenderClipModal
            job={job}
            moment={moment}
            tools={tools}
            busy={actionBusy}
            onClose={() => setRerenderTarget(null)}
            onSubmit={(mode) => rerenderMoment(job.id, moment.id, mode)}
          />
        ) : null;
      })()}
      {publishTarget && (() => {
        const job = jobs.find((candidate) => candidate.id === publishTarget.jobId);
        const moment = job?.selection?.moments.find((candidate) => candidate.id === publishTarget.momentId);
        return job && moment ? (
          <ClipPublishModal
            job={job}
            moment={moment}
            ranking={publishTarget.ranking}
            onClose={() => setPublishTarget(null)}
          />
        ) : null;
      })()}
    </div>
  );
}

function JobProgress({ job }: { job: ClipJob }) {
  const activeIndex = STAGES.findIndex((stage) => stage.id === job.stage);
  return (
    <div className="glass p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{job.title}</div>
          <div className="text-xs text-white/40">{job.sourceName}{job.duration ? ` · ${formatDuration(job.duration)}` : ""}</div>
          {job.activeOperation && (
            <div className="mt-1 text-[11px] font-medium text-cyan-200">{job.activeOperation.label}</div>
          )}
        </div>
        <span className="text-sm font-bold text-cyan-200">{job.progress}%</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {STAGES.map((stage, index) => {
          const done = index < activeIndex || job.status === "ready";
          const active = index === activeIndex && job.status !== "ready";
          return (
            <div key={stage.id} className={`rounded-xl border px-2 py-3 text-center text-[11px] ${done ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : active ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,.12)]" : "border-white/8 bg-black/15 text-white/30"}`}>
              <div className="mb-1 text-sm">{done ? "✓" : active ? "●" : "○"}</div>
              {(job.selectionMode ?? "ai") === "json" && stage.id === "understanding"
                ? job.jsonTiming === "gemini" ? "Sincronía" : "Temporizado"
                : (job.selectionMode ?? "ai") === "json" && stage.id === "selection"
                  ? "JSON validado"
                  : stage.label}
            </div>
          );
        })}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500 transition-all" style={{ width: `${job.progress}%` }} />
      </div>
      {job.logs.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-white/40">Registro de proceso ({job.logs.length})</summary>
          <div className="app-scroll mt-2 max-h-36 overflow-y-auto rounded-xl bg-black/25 p-3 font-mono text-[11px] text-white/45">
            {job.logs.map((log, index) => <div key={`${index}-${log}`}>› {log}</div>)}
          </div>
        </details>
      )}
    </div>
  );
}

function RankingTabs({
  job,
  ranking,
  setRanking,
  onRerender,
  onPublish,
}: {
  job: ClipJob;
  ranking: Ranking;
  setRanking: (value: Ranking) => void;
  onRerender: (momentId: string) => void;
  onPublish: (momentId: string, ranking: ClipPublishRanking) => void;
}) {
  const selection = job.selection!;
  const ids = ranking === "viral" ? selection.topViral : selection.topControversial;
  const moments = ids
    .map((id) => selection.moments.find((moment) => moment.id === id))
    .filter((moment): moment is ClipMoment => Boolean(moment));
  return (
    <div className="glass overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 p-4">
        <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
          <ModeButton active={ranking === "viral"} onClick={() => setRanking("viral")}>Top virales · {selection.topViral.length}/10</ModeButton>
          <ModeButton active={ranking === "controversial"} onClick={() => setRanking("controversial")}>Top polémicos · {selection.topControversial.length}/10</ModeButton>
        </div>
        <span className="text-xs text-white/35">
          {selection.source === "json"
            ? selection.moments.every((moment) => moment.subtitleSource === "synced_json")
              ? "Orden editorial importado · cues exactos del JSON · 0 créditos IA"
              : "Orden editorial importado · fuente de subtítulos indicada en cada clip"
            : `${selection.rejectedCount} candidato(s) descartado(s) por calidad o solapamiento`}
        </span>
      </div>
      {moments.length === 0 ? (
        <div className="p-8 text-center text-sm text-white/40">No hubo momentos que superasen el umbral para este ranking.</div>
      ) : (
        <div className="grid gap-4 p-4 md:grid-cols-2 2xl:grid-cols-3">
          {moments.map((moment, index) => (
            <MomentCard
              key={moment.id}
              jobId={job.id}
              moment={moment}
              index={index}
              ranking={ranking}
              imported={selection.source === "json"}
              jsonTiming={selection.jsonTiming}
              jobUpdatedAt={job.updatedAt}
              busy={job.status === "processing"}
              onRerender={() => onRerender(moment.id)}
              onPublish={() => onPublish(
                moment.id,
                ranking === "viral" ? "viral" : "controversial",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MomentCard({
  jobId,
  moment,
  index,
  ranking,
  imported,
  jsonTiming,
  jobUpdatedAt,
  busy,
  onRerender,
  onPublish,
}: {
  jobId: string;
  moment: ClipMoment;
  index: number;
  ranking: Ranking;
  imported: boolean;
  jsonTiming?: ClipJsonTimingMode;
  jobUpdatedAt: string;
  busy: boolean;
  onRerender: () => void;
  onPublish: () => void;
}) {
  const primaryScore = ranking === "viral" ? moment.viralScore : moment.controversyScore;
  const importedRank = ranking === "viral"
    ? moment.importedRankViral
    : moment.importedRankControversial;
  const revision = encodeURIComponent(jobUpdatedAt);
  const asset = moment.outputName
    ? `/api/clips/${jobId}/asset?name=${encodeURIComponent(moment.outputName)}&v=${revision}`
    : "";
  const poster = moment.thumbnailName ? `/api/clips/${jobId}/asset?name=${encodeURIComponent(moment.thumbnailName)}&v=${revision}` : undefined;
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <div className="relative mx-auto aspect-[9/16] max-h-[520px] bg-black">
        {asset ? (
          <video className="h-full w-full object-contain" controls preload="metadata" src={asset} poster={poster} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle,rgba(34,211,238,.08),transparent_55%)] px-6 text-center">
            <span className="text-3xl text-white/20">◌</span>
            <span className="text-sm font-semibold text-white/55">Vídeo pendiente</span>
            <span className="text-[11px] leading-relaxed text-white/30">
              El intervalo y sus datos se conservan. Puedes generarlo individualmente.
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/75 px-2.5 py-1 text-xs font-black backdrop-blur">#{index + 1}</div>
        <div className={`pointer-events-none absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-black backdrop-blur ${ranking === "viral" ? "bg-violet-500/85" : "bg-rose-500/85"}`}>
          {imported ? `JSON #${importedRank ?? index + 1}` : `${primaryScore}/100`}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="font-bold leading-tight">{moment.title}</h3>
          <div className="mt-1 text-[11px] text-white/40">
            {formatTime(moment.start)}–{formatTime(moment.end)} · {Math.round(moment.duration)} s ·{" "}
            {imported
              ? moment.subtitleSource === "gemini"
                ? `Gemini · sincronía ${moment.alignmentScore ?? 0}%`
                : moment.subtitleSource === "synced_json"
                  ? "cues sincronizados del JSON"
                  : moment.subtitleSource === "youtube_cc"
                    ? "CC sincronizados de YouTube"
                    : moment.subtitleSource === "local_whisper"
                      ? "audio transcrito con Whisper local"
                      : jsonTiming === "gemini"
                        ? "Gemini pendiente"
                        : "subtítulos pendientes"
              : `confianza ${moment.confidence}%`}
          </div>
        </div>
        {!imported && (
          <div className="grid grid-cols-2 gap-2">
            <MiniScore label="Viral" value={moment.viralScore} color="bg-violet-400" />
            <MiniScore label="Polémica" value={moment.controversyScore} color="bg-rose-400" />
          </div>
        )}
        <Info label="Hook" value={moment.hook} />
        <blockquote className="rounded-xl border-l-2 border-cyan-300/60 bg-cyan-300/5 p-3 text-xs italic text-white/65">“{moment.evidence}”</blockquote>
        <Info label={ranking === "viral" ? "Por qué puede funcionar" : "Por qué generará debate"} value={ranking === "viral" ? moment.whyViral : moment.whyControversial} />
        {(moment.context || moment.risk !== "low") && (
          <div className={`rounded-xl border p-3 text-xs ${moment.risk === "high" ? "border-rose-400/25 bg-rose-500/8 text-rose-100/75" : "border-amber-300/15 bg-amber-300/5 text-white/55"}`}>
            <div className="mb-1 font-semibold uppercase tracking-wide">{moment.risk === "low" ? "Contexto" : `Riesgo ${moment.risk}`}</div>
            {moment.riskReason || moment.context}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onRerender}
            disabled={busy}
            className="rounded-xl border border-cyan-300/15 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/5 disabled:opacity-40"
          >
            Regenerar clip
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={busy || !asset}
            className="rounded-xl border border-fuchsia-300/20 py-2 text-xs font-semibold text-fuchsia-100 hover:bg-fuchsia-300/5 disabled:opacity-40"
          >
            Publicar en TikTok ↗
          </button>
        </div>
        {asset && (
          <a href={`${asset}&download=1`} className="block rounded-xl border border-white/10 py-2 text-center text-xs font-semibold hover:bg-white/5">Descargar MP4 ↓</a>
        )}
      </div>
    </article>
  );
}

function RegenerateJobModal({
  job,
  tools,
  busy,
  onClose,
  onSubmit,
}: {
  job: ClipJob;
  tools: Tools;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: {
    jobId: string;
    title: string;
    selectionMode: ClipSelectionMode;
    jsonTiming: ClipJsonTimingMode;
    selectionJson: string;
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<ClipSelectionMode>(job.selectionMode ?? "ai");
  const [timing, setTiming] = useState<ClipJsonTimingMode>(job.jsonTiming ?? "direct");
  const [name, setName] = useState(job.title);
  const [json, setJson] = useState(() => editorialJsonFromJob(job));
  const needsGemini = mode === "ai" || timing === "gemini";
  const ready = (!needsGemini || tools.gemini)
    && tools.ffmpeg
    && tools.ffprobe
    && tools.whisper
    && (job.sourceType !== "youtube" || tools.ytdlp)
    && (mode !== "json" || Boolean(json.trim()));
  return (
    <ModalShell title="Regenerar historial con opciones" onClose={onClose}>
      <p className="text-xs leading-relaxed text-white/45">
        Se creará una versión nueva y se conservará esta entrada. La fuente ya descargada o subida
        se reutiliza localmente.
      </p>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-medium text-white/60">Nombre de la nueva versión</span>
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="mt-4">
        <div className="mb-2 text-xs font-medium text-white/60">Selección de cortes</div>
        <div className="grid grid-cols-2 gap-2">
          <ChoiceCard
            active={mode === "ai"}
            title="Descubrir con IA"
            detail="Gemini vuelve a analizar la fuente completa."
            badge="Gemini"
            onClick={() => setMode("ai")}
          />
          <ChoiceCard
            active={mode === "json"}
            title="Usar mi JSON"
            detail="Respeta rankings, tiempos y texto editorial."
            badge="Determinista"
            onClick={() => setMode("json")}
          />
        </div>
      </div>
      {mode === "json" && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ChoiceCard
              active={timing === "direct"}
              title="Directo"
              detail="JSON → CC → Whisper local."
              badge="0 créditos IA"
              onClick={() => setTiming("direct")}
            />
            <ChoiceCard
              active={timing === "gemini"}
              title="Verificar con Gemini"
              detail="Comprueba audio y texto en tus intervalos."
              badge="Gemini"
              onClick={() => setTiming("gemini")}
            />
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-medium text-white/60">JSON editorial</span>
            <textarea
              className="input min-h-64 resize-y font-mono text-[11px] leading-relaxed"
              value={json}
              onChange={(event) => setJson(event.target.value)}
              spellCheck={false}
            />
          </label>
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {needsGemini && <ToolBadge label="Gemini" ok={tools.gemini} />}
        <ToolBadge label="FFmpeg" ok={tools.ffmpeg} />
        <ToolBadge label="Whisper local" ok={tools.whisper} />
        {job.sourceType === "youtube" && <ToolBadge label="yt-dlp" ok={tools.ytdlp} />}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-white/60">
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy || !ready}
          onClick={() => void onSubmit({
            jobId: job.id,
            title: name,
            selectionMode: mode,
            jsonTiming: timing,
            selectionJson: json,
          })}
          className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-xs font-bold disabled:opacity-40"
        >
          {busy ? "Creando versión…" : "Crear nueva versión"}
        </button>
      </div>
    </ModalShell>
  );
}

function RerenderClipModal({
  job,
  moment,
  tools,
  busy,
  onClose,
  onSubmit,
}: {
  job: ClipJob;
  moment: ClipMoment;
  tools: Tools;
  busy: boolean;
  onClose: () => void;
  onSubmit: (mode: ClipSubtitleMode) => Promise<void>;
}) {
  const initialMode: ClipSubtitleMode = job.sourceType === "youtube"
    ? "youtube_cc"
    : "local_whisper";
  const [mode, setMode] = useState<ClipSubtitleMode>(initialMode);
  const available = mode === "youtube_cc"
    ? job.sourceType === "youtube" && tools.ytdlp
    : mode === "local_whisper"
      ? tools.whisper
      : tools.gemini;
  return (
    <ModalShell title="Regenerar sólo este clip" onClose={onClose}>
      <div className="rounded-xl border border-white/8 bg-black/20 p-3">
        <div className="text-sm font-semibold">{moment.title}</div>
        <div className="mt-1 text-[11px] text-white/40">
          {formatTime(moment.start)}–{formatTime(moment.end)} · {Math.round(moment.duration)} s
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-white/45">
        Se sustituirán únicamente su MP4, miniatura y subtítulos. Los otros clips permanecen intactos
        y, si esta operación falla, se conserva el vídeo actual.
      </p>
      <div className="mt-4 grid gap-2">
        <ChoiceCard
          active={mode === "youtube_cc"}
          disabled={job.sourceType !== "youtube" || !tools.ytdlp}
          title="CC de YouTube"
          detail="Relee la pista temporizada oficial o automática del vídeo."
          badge="0 créditos"
          onClick={() => setMode("youtube_cc")}
        />
        <ChoiceCard
          active={mode === "local_whisper"}
          disabled={!tools.whisper}
          title="Whisper local"
          detail="Extrae el audio exacto del corte y lo transcribe en tu PC."
          badge="0 créditos"
          onClick={() => setMode("local_whisper")}
        />
        <ChoiceCard
          active={mode === "gemini"}
          disabled={!tools.gemini}
          title="Gemini"
          detail="Envía únicamente este fragmento para verificar texto y sincronía."
          badge="Consume Gemini"
          onClick={() => setMode("gemini")}
        />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-white/60">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void onSubmit(mode)}
          disabled={busy || !available}
          className="rounded-xl bg-cyan-400/20 px-4 py-2 text-xs font-bold text-cyan-100 disabled:opacity-40"
        >
          {busy ? "Preparando…" : "Regenerar este clip"}
        </button>
      </div>
    </ModalShell>
  );
}

function ClipPublishModal({
  job,
  moment,
  ranking,
  onClose,
}: {
  job: ClipJob;
  moment: ClipMoment;
  ranking: ClipPublishRanking;
  onClose: () => void;
}) {
  const initial = composeTikTokCopy(moment, ranking);
  const [caption, setCaption] = useState(initial.caption);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [opened, setOpened] = useState(false);
  const asset = moment.outputName
    ? `/api/clips/${job.id}/asset?name=${encodeURIComponent(moment.outputName)}&download=1`
    : "";

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <ModalShell title="Publicar clip en TikTok" onClose={onClose}>
      <p className="text-xs leading-relaxed text-white/45">
        Flujo asistido y seguro: prepara el archivo y el copy, y abre la subida oficial. TikTok
        requiere que selecciones tú el MP4 descargado.
      </p>
      <div className="mt-4 space-y-3">
        <PublishStep number={1} done={downloaded} title="Descarga el MP4">
          <a
            href={asset}
            onClick={() => setDownloaded(true)}
            className="inline-flex rounded-lg border border-white/12 px-3 py-2 text-xs font-semibold hover:bg-white/5"
          >
            Descargar «{initial.title.slice(0, 46)}» ↓
          </a>
        </PublishStep>
        <PublishStep number={2} done={copied} title="Revisa y copia descripción + hashtags">
          <textarea
            className="input min-h-36 resize-y text-xs leading-relaxed"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {initial.hashtags.map((tag) => (
              <span key={tag} className="rounded-full bg-fuchsia-400/8 px-2 py-1 text-[10px] text-fuchsia-100/70">{tag}</span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void copyCaption()}
            className="mt-2 rounded-lg border border-fuchsia-300/20 px-3 py-2 text-xs font-semibold text-fuchsia-100 hover:bg-fuchsia-300/5"
          >
            {copied ? "Copiado ✓" : "Copiar descripción y hashtags"}
          </button>
        </PublishStep>
        <PublishStep number={3} done={opened} title="Abre TikTok y selecciona el MP4">
          <button
            type="button"
            onClick={() => {
              window.open("https://www.tiktok.com/upload", "_blank", "noopener,noreferrer");
              setOpened(true);
            }}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-3 py-2 text-xs font-bold"
          >
            Abrir subida de TikTok ↗
          </button>
          <p className="mt-2 text-[11px] text-white/35">
            Pega el texto copiado y elige el vídeo desde Descargas. No se comparten credenciales con RRSS Studio.
          </p>
        </PublishStep>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="glass app-scroll max-h-[92vh] w-full max-w-2xl overflow-y-auto border border-white/10 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/50 hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ChoiceCard({
  active,
  disabled = false,
  title,
  detail,
  badge,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  title: string;
  detail: string;
  badge: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-35 ${active ? "border-cyan-300/35 bg-cyan-300/8" : "border-white/8 bg-black/15 hover:border-white/15"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-white/45">{badge}</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-white/40">{detail}</p>
    </button>
  );
}

function PublishStep({
  number,
  done,
  title,
  children,
}: {
  number: number;
  done: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/15 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${done ? "bg-emerald-400 text-black" : "bg-white/10 text-white/50"}`}>
          {done ? "✓" : number}
        </span>
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <div className="pl-7">{children}</div>
    </div>
  );
}

function editorialJsonFromJob(job: ClipJob): string {
  const fromPlan = job.importedPlan
    ? importedPlanToObject(job.importedPlan)
    : selectionToEditorialObject(job);
  return JSON.stringify(fromPlan, null, 2);
}

function importedPlanToObject(plan: ImportedClipPlan) {
  const mapEntry = (entry: ImportedClipPlan["viral"][number]) => ({
    ranking: entry.ranking,
    start_time: formatJsonTime(entry.start),
    end_time: formatJsonTime(entry.end),
    hook_inicial: entry.hook,
    transcripcion_completa: entry.transcript,
    justificacion: entry.justification,
    ...(entry.subtitles?.length
      ? {
          subtitulos_sincronizados: entry.subtitles.map((cue) => ({
            start_time: formatJsonTime(cue.start),
            end_time: formatJsonTime(cue.end),
            texto: cue.text,
          })),
        }
      : {}),
  });
  return {
    top_10_virales: plan.viral.map(mapEntry),
    top_10_polemicos: plan.controversial.map(mapEntry),
  };
}

function selectionToEditorialObject(job: ClipJob) {
  const selection = job.selection;
  if (!selection) return { top_10_virales: [], top_10_polemicos: [] };
  const entry = (momentId: string, index: number, kind: Ranking) => {
    const moment = selection.moments.find((candidate) => candidate.id === momentId)!;
    const cues = selection.transcript.filter((cue) => cue.momentId === momentId);
    return {
      ranking: index + 1,
      start_time: formatJsonTime(moment.start),
      end_time: formatJsonTime(moment.end),
      hook_inicial: moment.hook || moment.title,
      transcripcion_completa: moment.alignedTranscript || moment.sourceTranscript || moment.evidence,
      justificacion: kind === "viral"
        ? moment.whyViral || moment.whyControversial || moment.context
        : moment.whyControversial || moment.whyViral || moment.context,
      ...(cues.length
        ? {
            subtitulos_sincronizados: cues.map((cue) => ({
              start_time: formatJsonTime(cue.start),
              end_time: formatJsonTime(cue.end),
              texto: cue.text,
            })),
          }
        : {}),
    };
  };
  return {
    top_10_virales: selection.topViral.map((id, index) => entry(id, index, "viral")),
    top_10_polemicos: selection.topControversial.map((id, index) => entry(id, index, "controversial")),
  };
}

function formatJsonTime(seconds: number): string {
  const totalMillis = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMillis / 3_600_000);
  const minutes = Math.floor((totalMillis % 3_600_000) / 60_000);
  const rest = Math.floor((totalMillis % 60_000) / 1000);
  const millis = totalMillis % 1000;
  const base = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  return millis > 0 ? `${base}.${String(millis).padStart(3, "0")}` : base;
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${active ? "bg-white/12 text-white shadow-sm" : "text-white/40 hover:text-white/70"}`}>{children}</button>;
}

function ToolBadge({ label, ok }: { label: string; ok: boolean }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] ${ok ? "border-emerald-300/20 bg-emerald-400/8 text-emerald-200" : "border-rose-300/20 bg-rose-400/8 text-rose-200"}`}>{ok ? "✓" : "×"} {label}</span>;
}

function StatusLabel({ status }: { status: ClipJob["status"] }) {
  const meta = status === "ready" ? ["Listo", "text-emerald-300"] : status === "error" ? ["Error", "text-rose-300"] : status === "processing" ? ["Procesando", "text-cyan-300"] : ["Pendiente", "text-white/40"];
  return <span className={meta[1]}>{meta[0]}</span>;
}

function DeleteActions({ id, confirmId, setConfirmId, onDelete }: { id: string; confirmId: string; setConfirmId: (id: string) => void; onDelete: (id: string) => Promise<void> }) {
  return confirmId === id ? (
    <div className="flex gap-2">
      <button onClick={() => setConfirmId("")} className="rounded-lg border border-white/10 px-3 py-2 text-xs">Cancelar</button>
      <button onClick={() => void onDelete(id)} className="rounded-lg bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-200">Confirmar eliminación</button>
    </div>
  ) : (
    <button onClick={() => setConfirmId(id)} className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs text-rose-200 hover:bg-rose-400/10">Eliminar</button>
  );
}

function MiniScore({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="rounded-lg bg-white/[0.03] p-2"><div className="flex justify-between text-[10px] text-white/45"><span>{label}</span><span>{value}</span></div><div className="mt-1 h-1 rounded-full bg-white/8"><div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} /></div></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return value ? <div><div className="text-[10px] font-semibold uppercase tracking-wide text-white/35">{label}</div><p className="mt-1 text-xs leading-relaxed text-white/65">{value}</p></div> : null;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

function pendingClipCount(job: ClipJob): number {
  if (!job.selection) return 0;
  const expected = new Set([
    ...job.selection.topViral,
    ...job.selection.topControversial,
    ...job.selection.moments
      .filter((moment) => moment.renderError)
      .map((moment) => moment.id),
  ]);
  return [...expected].filter((momentId) => {
    const moment = job.selection?.moments.find((candidate) => candidate.id === momentId);
    return !moment?.outputName;
  }).length;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.round(seconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unit);
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
