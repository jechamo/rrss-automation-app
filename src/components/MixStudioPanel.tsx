"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StudioAsset } from "./MediaStudio";

type PiecePick = { id: string; titulo: string; origin: string };
type MixDto = { id: string; pieceId: string | null; name: string; status: string; outputPath: string | null; error: string | null };

export function MixStudioPanel({ projectId, assets, onMediaChanged }: { projectId: string; assets: StudioAsset[]; onMediaChanged: () => Promise<void> }) {
  const [pieces, setPieces] = useState<PiecePick[]>([]);
  const [mixes, setMixes] = useState<MixDto[]>([]);
  const [name, setName] = useState("Nuevo MIX");
  const [pieceId, setPieceId] = useState("");
  const [videoIds, setVideoIds] = useState<string[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [musicId, setMusicId] = useState("");
  const [subtitleText, setSubtitleText] = useState("");
  const [musicVolume, setMusicVolume] = useState(0.12);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [pieceResponse, mixResponse] = await Promise.all([
      fetch(`/api/content/${projectId}`, { cache: "no-store" }),
      fetch(`/api/projects/${projectId}/mixes`, { cache: "no-store" }),
    ]);
    if (pieceResponse.ok) setPieces(((await pieceResponse.json()) as { pieces?: PiecePick[] }).pieces ?? []);
    if (mixResponse.ok) setMixes(((await mixResponse.json()) as { mixes?: MixDto[] }).mixes ?? []);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  const videos = useMemo(() => assets.filter((asset) => ["recording", "video", "clip", "presenter", "final"].includes(asset.kind)), [assets]);
  const voices = useMemo(() => assets.filter((asset) => asset.kind === "audio"), [assets]);
  const music = useMemo(() => assets.filter((asset) => ["music", "audio"].includes(asset.kind)), [assets]);

  function toggleVideo(id: string) {
    setVideoIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }
  function move(id: string, direction: -1 | 1) {
    setVideoIds((current) => {
      const index = current.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function renderMix() {
    setBusy(true);
    setMessage("Renderizando localmente con FFmpeg…");
    const response = await fetch(`/api/projects/${projectId}/mixes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, pieceId: pieceId || null, recipe: { videoAssetIds: videoIds, voiceAssetId: voiceId, musicAssetId: musicId, subtitleText, musicVolume } }),
    });
    const data = (await response.json()) as { error?: string };
    setMessage(response.ok ? "MIX terminado. Revisa el resultado antes de usarlo como final." : data.error || "El MIX falló.");
    setBusy(false);
    await Promise.all([load(), onMediaChanged()]);
  }

  async function useAsFinal(mix: MixDto) {
    if (!window.confirm(`¿Usar «${mix.name}» como vídeo final?`)) return;
    const response = await fetch(`/api/projects/${projectId}/mixes/${mix.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ useAsFinal: true }) });
    const data = (await response.json()) as { error?: string };
    setMessage(response.ok ? "MIX seleccionado como vídeo final." : data.error || "No se pudo aplicar.");
  }

  async function removeMix(mix: MixDto) {
    if (!window.confirm(`¿Eliminar «${mix.name}»?`)) return;
    const response = await fetch(`/api/projects/${projectId}/mixes/${mix.id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    setMessage(response.ok ? "MIX eliminado." : data.error || "No se pudo eliminar.");
    if (response.ok) await Promise.all([load(), onMediaChanged()]);
  }

  return (
    <section className="glass mt-6 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
        <div><div className="text-xs uppercase tracking-[0.22em] text-[var(--color-accent-3)]">Montaje aditivo</div><h2 className="mt-1 text-xl font-bold">MIX inteligente</h2><p className="mt-1 text-xs text-white/40">Crea una versión nueva; el final actual solo cambia si tú lo confirmas.</p></div>
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">CC Subtítulos siempre activos</div>
      </header>
      <div className="grid gap-5 p-5 xl:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/50">Nombre<input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="text-xs text-white/50">Pieza destino (opcional)<select className="input mt-1" value={pieceId} onChange={(e) => setPieceId(e.target.value)}><option value="">Solo mediateca</option>{pieces.map((piece) => <option key={piece.id} value={piece.id}>{piece.titulo || "Sin título"} · {piece.origin}</option>)}</select></label>
          </div>
          <div><div className="mb-2 text-xs font-semibold text-white/65">1. Vídeos y orden</div><div className="grid gap-2 sm:grid-cols-2">
            {videos.map((asset) => { const selected = videoIds.includes(asset.id); const position = videoIds.indexOf(asset.id); return <div key={asset.id} className={`rounded-xl border p-3 ${selected ? "border-cyan-400/50 bg-cyan-400/5" : "border-white/10 bg-black/15"}`}><label className="flex cursor-pointer gap-2"><input type="checkbox" checked={selected} onChange={() => toggleVideo(asset.id)} /><span className="min-w-0"><span className="block truncate text-xs font-medium">{asset.name}</span><span className="text-[10px] text-white/35">{asset.kind} · {asset.duration?.toFixed(1) ?? "?"}s</span></span></label>{selected && <div className="mt-2 flex items-center gap-1 text-[10px]"><span className="mr-auto text-white/35">Bloque {position + 1}</span><button onClick={() => move(asset.id, -1)} className="rounded border border-white/10 px-2 py-1">↑</button><button onClick={() => move(asset.id, 1)} className="rounded border border-white/10 px-2 py-1">↓</button></div>}</div>; })}
          </div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/50">2. Locución<select className="input mt-1" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}><option value="">Audio original</option>{voices.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
            <label className="text-xs text-white/50">3. Música<select className="input mt-1" value={musicId} onChange={(e) => setMusicId(e.target.value)}><option value="">Sin música</option>{music.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
          </div>
          {musicId && <label className="block text-xs text-white/50">Volumen · {Math.round(musicVolume * 100)}%<input className="mt-2 w-full accent-purple-500" type="range" min="0.02" max="0.5" step="0.01" value={musicVolume} onChange={(e) => setMusicVolume(Number(e.target.value))} /></label>}
          <label className="block text-xs text-white/50">4. Texto de subtítulos obligatorio<textarea className="input mt-1 min-h-28" value={subtitleText} onChange={(e) => setSubtitleText(e.target.value)} placeholder="Pega la locución exacta. Se mostrará abajo, dentro de la zona segura." /></label>
          {message && <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">{message}</div>}
          <button onClick={renderMix} disabled={busy || !name.trim() || !videoIds.length || !subtitleText.trim()} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-3 text-sm font-bold disabled:opacity-35">{busy ? "Mezclando…" : "MIX · Generar vídeo"}</button>
        </div>
        <div><div className="mb-2 text-xs font-semibold text-white/65">Resultados</div><div className="space-y-3">{mixes.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-xs text-white/35">Tus versiones aparecerán aquí.</div>}{mixes.map((mix) => <article key={mix.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">{mix.status === "ready" ? <video controls src={`/api/projects/${projectId}/mixes/${mix.id}/file`} className="aspect-[9/16] max-h-[420px] w-full bg-black object-contain" /> : <div className="flex aspect-video items-center justify-center text-xs text-white/40">{mix.status === "error" ? "Render con error" : "Renderizando…"}</div>}<div className="p-3"><div className="flex gap-2"><span className="min-w-0 flex-1 truncate text-sm font-medium">{mix.name}</span><span className="text-[10px] text-white/40">{mix.status}</span></div>{mix.error && <p className="mt-2 text-[11px] text-red-300">{mix.error}</p>}<div className="mt-3 flex gap-2">{mix.status === "ready" && mix.pieceId && <button onClick={() => useAsFinal(mix)} className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold">Usar como final</button>}<button onClick={() => removeMix(mix)} className="ml-auto rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300">Eliminar</button></div></div></article>)}</div></div>
      </div>
    </section>
  );
}
