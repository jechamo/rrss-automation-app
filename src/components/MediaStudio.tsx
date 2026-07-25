"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export function MediaStudio({
  projectId,
  projectName,
  projectUrl,
  hasLogo,
}: {
  projectId: string;
  projectName: string;
  projectUrl: string;
  hasLogo: boolean;
}) {
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [message, setMessage] = useState("");
  const uploadInputRef = useRef<HTMLInputElement>(null);
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
    <div className="h-[calc(100dvh-3rem)] min-h-0 lg:h-[calc(100dvh-4rem)]">
      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        accept="video/*,audio/*,.mp4,.webm,.mov,.mp3,.wav,.m4a"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />

      <MixStudioPanel
        projectId={projectId}
        projectName={projectName}
        hasLogo={hasLogo}
        assets={assets}
        onMediaChanged={load}
        onUpload={() => uploadInputRef.current?.click()}
        onRecord={() => setShowRecorder(true)}
        onManageMedia={() => setLibraryOpen(true)}
      />

      {libraryOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Mediateca">
          <section className="glass flex max-h-[88dvh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/12 shadow-2xl">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <h2 className="text-lg font-semibold">Mediateca del proyecto</h2>
                <p className="mt-1 text-xs text-white/40">{loading ? "Indexando recursos…" : `${assets.length} recursos`} · gestión avanzada de archivos</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => uploadInputRef.current?.click()} disabled={uploading} className="rounded-xl border border-white/12 px-4 py-2 text-xs hover:bg-white/5 disabled:opacity-50">{uploading ? "Subiendo…" : "Subir recurso ↑"}</button>
                <button type="button" onClick={() => setLibraryOpen(false)} className="rounded-xl border border-white/12 px-4 py-2 text-xs hover:bg-white/5">Cerrar</button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 studio-scrollbar">
              {message && <div className="mb-4 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-xs text-white/60">{message}</div>}
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
            </div>
          </section>
        </div>
      )}

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
