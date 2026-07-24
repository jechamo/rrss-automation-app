"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SelfRecordModal, type SavedMediaAsset } from "./SelfRecordModal";
import { MixStudioPanel } from "./MixStudioPanel";
import { useAppDialog } from "./AppDialog";

export type StudioAsset = SavedMediaAsset & {
  projectId: string;
  pieceId: string | null;
  kind: string;
  origin: string;
  size: number;
  duration: number | null;
  metadata: {
    markers?: Array<{
      id: string;
      label: string;
      start: number;
      end: number;
      protected: boolean;
      origin: "playwright" | "manual";
    }>;
  };
  createdAt: string;
  updatedAt: string;
};

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "recording", label: "Grabaciones" },
  { id: "video", label: "Vídeos" },
  { id: "audio", label: "Audio" },
  { id: "final", label: "Finales" },
] as const;

export function MediaStudio({ projectId, projectName, projectUrl }: { projectId: string; projectName: string; projectUrl: string }) {
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [message, setMessage] = useState("");
  const appDialog = useAppDialog();

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/projects/${projectId}/media`, { cache: "no-store" });
    const data = (await response.json()) as { assets?: StudioAsset[]; error?: string };
    setAssets(data.assets ?? []);
    if (!response.ok) setMessage(data.error || "No se pudo cargar la mediateca.");
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => assets.filter((asset) => {
    if (filter === "all") return true;
    if (filter === "video") return ["video", "clip", "presenter"].includes(asset.kind);
    if (filter === "audio") return ["audio", "music"].includes(asset.kind);
    return asset.kind === filter;
  }), [assets, filter]);

  async function upload(file: File) {
    setUploading(true);
    setMessage("");
    const audio = file.type.startsWith("audio/");
    const form = new FormData();
    form.set("file", file);
    form.set("kind", audio ? "music" : "video");
    form.set("origin", "upload");
    form.set("name", file.name);
    const response = await fetch(`/api/projects/${projectId}/media`, { method: "POST", body: form });
    const data = (await response.json()) as { error?: string };
    setMessage(response.ok ? "Recurso guardado en la mediateca." : data.error || "No se pudo subir.");
    setUploading(false);
    if (response.ok) await load();
  }

  async function rename(asset: StudioAsset) {
    const name = (await appDialog.prompt({
      title: "Renombrar recurso",
      message: "El nuevo nombre se mostrará en la mediateca y en el montador MIX.",
      inputLabel: "Nuevo nombre",
      initialValue: asset.name,
      confirmLabel: "Guardar nombre",
    }))?.trim();
    if (!name || name === asset.name) return;
    const response = await fetch(`/api/projects/${projectId}/media/${asset.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
    });
    if (response.ok) await load();
  }

  async function remove(asset: StudioAsset) {
    if (!await appDialog.confirm({
      title: "Eliminar recurso",
      message: `Se eliminará «${asset.name}». Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar recurso",
      tone: "danger",
    })) return;
    const response = await fetch(`/api/projects/${projectId}/media/${asset.id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    setMessage(response.ok ? "Recurso eliminado." : data.error || "No se pudo eliminar.");
    if (response.ok) await load();
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="hero glass glow-border mb-6 overflow-hidden p-6">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-[var(--color-accent-2)]">{projectName}</div>
            <h1 className="mt-2 text-3xl font-bold"><span className="text-gradient">Estudio multimedia</span></h1>
            <p className="mt-2 max-w-2xl text-sm text-white/50">Grabaciones, clips, voces, música y montajes en un solo espacio reutilizable.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-xl border border-white/15 px-4 py-3 text-sm hover:bg-white/5">
              {uploading ? "Subiendo…" : "Subir recurso ↑"}
              <input type="file" className="hidden" accept="video/*,audio/*,.mp4,.webm,.mov,.mp3,.wav,.m4a" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = ""; }} />
            </label>
            <button onClick={() => setShowRecorder(true)} className="rounded-xl bg-red-500 px-5 py-3 text-sm font-bold shadow-lg shadow-red-500/20">● Graba tú mismo</button>
          </div>
        </div>
      </header>

      <section className="glass overflow-hidden">
        <button type="button" aria-expanded={libraryOpen} onClick={() => setLibraryOpen((current) => !current)} className="flex w-full flex-wrap items-center justify-between gap-3 p-5 text-left hover:bg-white/[0.025]">
          <div>
            <h2 className="font-semibold">Mediateca</h2>
            <p className="text-xs text-white/40">{loading ? "Indexando recursos…" : `${assets.length} recursos`} · abre solo cuando quieras gestionar archivos</p>
          </div>
          <span className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55"><span>{libraryOpen ? "Ocultar" : "Abrir mediateca"}</span><span aria-hidden="true" className={`transition-transform ${libraryOpen ? "rotate-180" : ""}`}>⌄</span></span>
        </button>
        {message && <div className="mx-5 mb-4 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">{message}</div>}
        {libraryOpen && <div className="border-t border-white/10 p-5">
          <div className="flex flex-wrap gap-1">
              {FILTERS.map((item) => <button key={item.id} onClick={() => setFilter(item.id)} className={`rounded-lg px-3 py-1.5 text-xs ${filter === item.id ? "bg-white/12 text-white" : "text-white/45 hover:bg-white/5"}`}>{item.label}</button>)}
          </div>
          {loading ? <div className="py-16 text-center text-sm text-white/35">Indexando recursos…</div> : visible.length === 0 ? (
            <div className="my-6 rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center"><div className="text-4xl">◉</div><p className="mt-3 text-sm text-white/55">Todavía no hay recursos en este filtro.</p><p className="mt-1 text-xs text-white/30">Graba tu app o sube un vídeo/audio para empezar.</p></div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((asset) => <AssetCard key={asset.id} projectId={projectId} asset={asset} onRename={() => rename(asset)} onDelete={() => remove(asset)} />)}
            </div>
          )}
        </div>}
      </section>

      <MixStudioPanel projectId={projectId} assets={assets} onMediaChanged={load} />

      {showRecorder && <SelfRecordModal projectId={projectId} initialUrl={projectUrl} onClose={() => setShowRecorder(false)} onSaved={async () => { setShowRecorder(false); setMessage("Grabación guardada. Ya puedes reutilizarla en tus piezas o en MIX."); await load(); }} />}
      {appDialog.dialog}
    </div>
  );
}

function AssetCard({ projectId, asset, onRename, onDelete }: { projectId: string; asset: StudioAsset; onRename: () => void; onDelete: () => void }) {
  const file = `/api/projects/${projectId}/media/${asset.id}/file`;
  const audio = ["audio", "music"].includes(asset.kind);
  const duration = asset.duration ? `${asset.duration.toFixed(1)} s` : "duración pendiente";
  return <article className="card-lift overflow-hidden rounded-2xl border border-white/10 bg-black/20">
    <div className="flex aspect-video items-center justify-center bg-black/50">
      {audio ? <audio controls src={file} className="w-[90%]" /> : <video controls preload="metadata" src={file} className="h-full w-full object-contain" />}
    </div>
    <div className="p-4">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-medium" title={asset.name}>{asset.name}</div><div className="mt-1 text-[11px] text-white/35">{asset.kind} · {asset.origin} · {duration}</div></div><span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-white/45">{asset.pieceId ? "Pieza" : "Libre"}</span></div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs"><a href={`${file}?download=1`} className="rounded-lg border border-white/10 px-2 py-1.5 hover:bg-white/5">Descargar</a><button onClick={onRename} className="rounded-lg border border-white/10 px-2 py-1.5 hover:bg-white/5">Renombrar</button><button onClick={onDelete} className="ml-auto rounded-lg border border-red-400/20 px-2 py-1.5 text-red-300 hover:bg-red-500/10">Eliminar</button></div>
    </div>
  </article>;
}
