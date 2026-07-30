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
} from "@/core/clips/contracts";

type Tools = { gemini: boolean; ffmpeg: boolean; ffprobe: boolean; ytdlp: boolean };
type Ranking = "viral" | "controversial";

const JSON_PLACEHOLDER = `{
  "top_10_virales": [{
    "ranking": 1,
    "start_time": "00:12:30",
    "end_time": "00:13:05",
    "hook_inicial": "Frase exacta con la que empieza",
    "transcripcion_completa": "Texto completo del fragmento...",
    "justificacion": "Por qué puede ser viral."
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
  const [tools, setTools] = useState<Tools>({ gemini: false, ffmpeg: false, ffprobe: false, ytdlp: false });
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

  const selected = jobs.find((job) => job.id === selectedId) ?? null;

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

  const needsGemini = selectionMode === "ai" || jsonTiming === "gemini";
  const requiredReady = (!needsGemini || tools.gemini) && tools.ffmpeg && tools.ffprobe
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
                      Usa exactamente texto y tiempos del JSON. Los cues se reparten localmente;
                      ideal para probar cuando ya sabes que la transcripción encaja.
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
                        {jsonTiming === "gemini" ? "Protección de sincronía activa" : "Sin verificación del audio"}
                      </div>
                      <p className="mt-1">
                        Cada corte debe durar 10–90 s y quedar dentro del vídeo.
                        {jsonTiming === "gemini"
                          ? " Si el texto no coincide con el audio, el render se bloquea."
                          : " No se consumirá Gemini; revisa el resultado porque la sincronía depende de tu JSON."}
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
        </div>

        <aside className="glass max-h-[360px] overflow-hidden p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Historial</h2>
            <span className="text-xs text-white/35">{jobs.length}</span>
          </div>
          <div className="app-scroll flex max-h-[285px] flex-col gap-2 overflow-y-auto pr-1">
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
                <button onClick={() => void retry(selected.id)} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15">Reintentar</button>
                <DeleteActions id={selected.id} confirmId={confirmDelete} setConfirmId={setConfirmDelete} onDelete={remove} />
              </div>
            </div>
          )}
          {selected.status === "ready" && selected.selection && (
            <>
              <div className="glass flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-sm font-semibold">{selected.title}</div>
                  <div className="mt-1 text-xs text-white/40">{selected.selection.summary || "Análisis multimodal completado."}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => void retry(selected.id)} className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5">
                    {(selected.selectionMode ?? "ai") !== "json"
                      ? "Reanalizar"
                      : selected.jsonTiming === "gemini"
                        ? "Revalidar sincronía"
                        : "Remontar desde JSON"}
                  </button>
                  <DeleteActions id={selected.id} confirmId={confirmDelete} setConfirmId={setConfirmDelete} onDelete={remove} />
                </div>
              </div>
              {selected.selection.source === "json" && selected.selection.jsonTiming === "direct" && (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-relaxed text-amber-100/75">
                  <span className="font-semibold">Modo directo sin Gemini.</span>{" "}
                  Los subtítulos usan el texto y los intervalos del JSON sin escuchar el audio.
                  Reproduce los clips para confirmar la sincronía o crea otro trabajo con verificación Gemini.
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
              <RankingTabs job={selected} ranking={ranking} setRanking={setRanking} />
            </>
          )}
        </section>
      )}
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

function RankingTabs({ job, ranking, setRanking }: { job: ClipJob; ranking: Ranking; setRanking: (value: Ranking) => void }) {
  const selection = job.selection!;
  const ids = ranking === "viral" ? selection.topViral : selection.topControversial;
  const moments = ids
    .map((id) => selection.moments.find((moment) => moment.id === id))
    .filter((moment): moment is ClipMoment => Boolean(moment?.outputName));
  return (
    <div className="glass overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 p-4">
        <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
          <ModeButton active={ranking === "viral"} onClick={() => setRanking("viral")}>Top virales · {selection.topViral.length}/10</ModeButton>
          <ModeButton active={ranking === "controversial"} onClick={() => setRanking("controversial")}>Top polémicos · {selection.topControversial.length}/10</ModeButton>
        </div>
        <span className="text-xs text-white/35">
          {selection.source === "json"
            ? selection.jsonTiming === "gemini"
              ? "Orden editorial importado · audio y texto sincronizados"
              : "Orden editorial importado · temporizado local sin Gemini"
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
}: {
  jobId: string;
  moment: ClipMoment;
  index: number;
  ranking: Ranking;
  imported: boolean;
  jsonTiming?: ClipJsonTimingMode;
}) {
  const primaryScore = ranking === "viral" ? moment.viralScore : moment.controversyScore;
  const importedRank = ranking === "viral"
    ? moment.importedRankViral
    : moment.importedRankControversial;
  const asset = `/api/clips/${jobId}/asset?name=${encodeURIComponent(moment.outputName!)}`;
  const poster = moment.thumbnailName ? `/api/clips/${jobId}/asset?name=${encodeURIComponent(moment.thumbnailName)}` : undefined;
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <div className="relative mx-auto aspect-[9/16] max-h-[520px] bg-black">
        <video className="h-full w-full object-contain" controls preload="metadata" src={asset} poster={poster} />
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
              ? jsonTiming === "gemini"
                ? `sincronía ${moment.alignmentScore ?? 0}%`
                : "timing del JSON"
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
        <a href={`${asset}&download=1`} className="block rounded-xl border border-white/10 py-2 text-center text-xs font-semibold hover:bg-white/5">Descargar MP4 ↓</a>
      </div>
    </article>
  );
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

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.round(seconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}
