"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MixSegment } from "@/core/media/mix-contracts";
import type { StudioAsset } from "./MediaStudio";

type PiecePick = {
  id: string;
  titulo: string;
  origin: string;
  content?: { guion?: { locucion?: string } };
  assets?: {
    recordingPath?: string;
    presenterPath?: string;
    videoPath?: string;
    clips?: string[];
  };
};
type MixDto = { id: string; pieceId: string | null; name: string; status: string; outputPath: string | null; error: string | null };

const VIDEO_KINDS = ["recording", "video", "clip", "presenter", "final"];
const MIN_SEGMENT_SECONDS = 0.25;

function segmentDuration(segment: MixSegment): number {
  return Math.max(0, segment.sourceEnd - segment.sourceStart);
}

function newSegment(asset: StudioAsset, locked = asset.kind === "recording"): MixSegment {
  const sourceDuration = Math.max(MIN_SEGMENT_SECONDS, asset.duration ?? 5);
  const initialDuration = asset.kind === "clip" ? Math.min(5, sourceDuration) : sourceDuration;
  return {
    id: `${asset.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    assetId: asset.id,
    sourceStart: 0,
    sourceEnd: initialDuration,
    label: asset.name,
    kind: asset.kind,
    locked,
  };
}

function fitTimelineToTarget(
  input: MixSegment[],
  target: number,
  assets: Map<string, StudioAsset>,
): { segments: MixSegment[]; remaining: number } {
  const segments = input.map((segment) => ({ ...segment }));
  let remaining = target - segments.reduce((sum, segment) => sum + segmentDuration(segment), 0);
  const editable = segments.filter((segment) => !segment.locked).reverse();
  for (const segment of editable) {
    if (Math.abs(remaining) <= 0.01) break;
    const asset = assets.get(segment.assetId);
    if (remaining > 0) {
      const capacity = Math.max(0, (asset?.duration ?? segment.sourceEnd) - segment.sourceEnd);
      const add = Math.min(capacity, remaining);
      segment.sourceEnd += add;
      remaining -= add;
    } else {
      const capacity = Math.max(0, segmentDuration(segment) - MIN_SEGMENT_SECONDS);
      const remove = Math.min(capacity, -remaining);
      segment.sourceEnd -= remove;
      remaining += remove;
    }
  }
  return { segments, remaining };
}

function recordingSegments(asset: StudioAsset): MixSegment[] {
  const markers = asset.metadata?.markers ?? [];
  if (!markers.length) return [newSegment(asset, true)];
  return markers.map((marker) => ({
    id: `${asset.id}-${marker.id}-${Date.now()}`,
    assetId: asset.id,
    sourceStart: marker.start,
    sourceEnd: marker.end,
    label: marker.label,
    kind: asset.kind,
    locked: marker.protected,
  }));
}

export function MixStudioPanel({ projectId, assets, onMediaChanged }: { projectId: string; assets: StudioAsset[]; onMediaChanged: () => Promise<void> }) {
  const [pieces, setPieces] = useState<PiecePick[]>([]);
  const [mixes, setMixes] = useState<MixDto[]>([]);
  const [name, setName] = useState("Nuevo MIX");
  const [pieceId, setPieceId] = useState("");
  const [segments, setSegments] = useState<MixSegment[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [draggingId, setDraggingId] = useState("");
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
  const videos = useMemo(() => assets.filter((asset) => VIDEO_KINDS.includes(asset.kind)), [assets]);
  const voices = useMemo(() => assets.filter((asset) => asset.kind === "audio"), [assets]);
  const music = useMemo(() => assets.filter((asset) => ["music", "audio"].includes(asset.kind)), [assets]);
  const byId = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const selectedSegment = segments.find((segment) => segment.id === selectedSegmentId) ?? null;
  const selectedAsset = selectedSegment ? byId.get(selectedSegment.assetId) ?? null : null;
  const selectedVoice = voiceId ? byId.get(voiceId) ?? null : null;
  const visualDuration = segments.reduce((sum, segment) => sum + segmentDuration(segment), 0);
  const voiceDuration = selectedVoice?.duration ?? null;
  const durationDelta = voiceDuration === null ? 0 : voiceDuration - visualDuration;
  const durationOk = voiceDuration === null || Math.abs(durationDelta) <= 0.25;

  function addAsset(asset: StudioAsset, locked?: boolean) {
    const segment = newSegment(asset, locked ?? asset.kind === "recording");
    setSegments((current) => [...current, segment]);
    setSelectedSegmentId(segment.id);
  }

  function prepareAutomatic() {
    const piece = pieces.find((item) => item.id === pieceId);
    const linkedPaths = new Set([
      piece?.assets?.recordingPath,
      piece?.assets?.presenterPath,
      piece?.assets?.videoPath,
      ...(piece?.assets?.clips ?? []),
    ].filter((value): value is string => Boolean(value)));
    const pieceAssets = pieceId
      ? videos.filter((asset) => asset.pieceId === pieceId || linkedPaths.has(asset.path))
      : videos;
    const recordings = pieceAssets.filter((asset) => asset.kind === "recording").flatMap(recordingSegments);
    const clips = pieceAssets.filter((asset) => asset.kind === "clip");
    const other = pieceAssets.filter((asset) => !["recording", "clip", "final"].includes(asset.kind));
    const ordered: Array<StudioAsset | MixSegment> = [];
    const max = Math.max(recordings.length, clips.length);
    for (let index = 0; index < max; index += 1) {
      if (clips[index]) ordered.push(clips[index]);
      if (recordings[index]) ordered.push(recordings[index]);
    }
    if (!ordered.length) ordered.push(...other.slice(0, 6));
    const pieceVoice = voices.find((asset) => !pieceId || asset.pieceId === pieceId);
    const proposed = ordered.map((item) => "assetId" in item ? item : newSegment(item, item.kind === "recording"));
    const fitted = pieceVoice?.duration
      ? fitTimelineToTarget(proposed, pieceVoice.duration, byId)
      : { segments: proposed, remaining: 0 };
    const next = fitted.segments;
    setSegments(next);
    setSelectedSegmentId(next[0]?.id ?? "");
    if (pieceVoice) setVoiceId(pieceVoice.id);
    const locucion = piece?.content?.guion?.locucion?.trim();
    if (locucion) setSubtitleText(locucion);
    setMessage(next.length
      ? Math.abs(fitted.remaining) <= 0.25
        ? "Propuesta armonizada. Las grabaciones quedan protegidas; revisa duración y recortes."
        : `Propuesta creada, pero quedan ${Math.abs(fitted.remaining).toFixed(2)}s por ajustar sin tocar protegidos.`
      : "No hay vídeos compatibles para preparar el MIX.");
  }

  function updateSegment(id: string, patch: Partial<MixSegment>) {
    setSegments((current) => current.map((segment) => {
      if (segment.id !== id) return segment;
      const asset = byId.get(segment.assetId);
      const next = { ...segment, ...patch };
      next.sourceStart = Math.max(0, next.sourceStart);
      const maxEnd = asset?.duration ?? Number.POSITIVE_INFINITY;
      next.sourceEnd = Math.min(maxEnd, Math.max(next.sourceStart + MIN_SEGMENT_SECONDS, next.sourceEnd));
      return next;
    }));
  }

  function move(id: string, direction: -1 | 1) {
    setSegments((current) => {
      const index = current.findIndex((segment) => segment.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function dropBefore(targetId: string) {
    if (!draggingId || draggingId === targetId) return;
    setSegments((current) => {
      const dragged = current.find((segment) => segment.id === draggingId);
      if (!dragged) return current;
      const rest = current.filter((segment) => segment.id !== draggingId);
      const targetIndex = rest.findIndex((segment) => segment.id === targetId);
      rest.splice(targetIndex < 0 ? rest.length : targetIndex, 0, dragged);
      return rest;
    });
    setDraggingId("");
  }

  function harmonize() {
    if (voiceDuration === null || Math.abs(durationDelta) <= 0.01) return;
    const fitted = fitTimelineToTarget(segments, voiceDuration, byId);
    setSegments(fitted.segments);
    setMessage(Math.abs(fitted.remaining) <= 0.25
      ? "Timeline ajustada a la locución sin tocar los bloques protegidos."
      : `Faltan ${Math.abs(fitted.remaining).toFixed(2)}s por ajustar. Desbloquea o añade un bloque con margen disponible.`);
  }

  async function renderMix() {
    setBusy(true);
    setMessage("Renderizando localmente con FFmpeg…");
    const response = await fetch(`/api/projects/${projectId}/mixes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        pieceId: pieceId || null,
        recipe: { version: 2, segments, voiceAssetId: voiceId, musicAssetId: musicId, subtitleText, musicVolume },
      }),
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
        <div><div className="text-xs uppercase tracking-[0.22em] text-[var(--color-accent-3)]">Montador ligero · REQ-012</div><h2 className="mt-1 text-xl font-bold">MIX inteligente</h2><p className="mt-1 text-xs text-white/40">Edita una receta nueva; nada cambia el final actual sin tu confirmación.</p></div>
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">CC Subtítulos siempre activos</div>
      </header>

      <div className="grid gap-5 p-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/50">Nombre<input className="input mt-1" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="text-xs text-white/50">Pieza destino (opcional)<select className="input mt-1" value={pieceId} onChange={(event) => setPieceId(event.target.value)}><option value="">Solo mediateca</option>{pieces.map((piece) => <option key={piece.id} value={piece.id}>{piece.titulo || "Sin título"} · {piece.origin}</option>)}</select></label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><div className="text-xs font-semibold text-white/70">Plan visual</div><div className="mt-1 text-[10px] text-white/35">Las grabaciones se protegen automáticamente; puedes desbloquearlas.</div></div>
              <button type="button" onClick={prepareAutomatic} className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">Preparar automáticamente</button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white/5 p-2"><span className="block text-[9px] uppercase text-white/30">Vídeo</span><b>{visualDuration.toFixed(2)}s</b></div>
              <div className="rounded-xl bg-white/5 p-2"><span className="block text-[9px] uppercase text-white/30">Locución</span><b>{voiceDuration === null ? "—" : `${voiceDuration.toFixed(2)}s`}</b></div>
              <div className={`rounded-xl p-2 ${durationOk ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-200"}`}><span className="block text-[9px] uppercase opacity-60">Diferencia</span><b>{voiceDuration === null ? "—" : `${durationDelta >= 0 ? "+" : ""}${durationDelta.toFixed(2)}s`}</b></div>
            </div>
            {!durationOk && <button type="button" onClick={harmonize} className="mt-2 w-full rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">Ajustar a locución sin tocar protegidos</button>}
          </div>

          {selectedAsset && selectedSegment && (
            <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[180px_1fr]">
              <video controls preload="metadata" src={`/api/projects/${projectId}/media/${selectedAsset.id}/file#t=${selectedSegment.sourceStart}`} className="aspect-[9/16] max-h-64 w-full rounded-xl bg-black object-contain" />
              <div className="space-y-3">
                <div><div className="text-sm font-semibold">{selectedSegment.label}</div><div className="text-[10px] text-white/35">Fuente: {selectedAsset.duration?.toFixed(2) ?? "?"}s · bloque: {segmentDuration(selectedSegment).toFixed(2)}s</div></div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-white/45">Entrada<input type="number" min="0" max={selectedAsset.duration ?? undefined} step="0.1" className="input mt-1" value={selectedSegment.sourceStart} disabled={selectedSegment.locked} onChange={(event) => updateSegment(selectedSegment.id, { sourceStart: Number(event.target.value) })} /></label>
                  <label className="text-[10px] text-white/45">Salida<input type="number" min="0.25" max={selectedAsset.duration ?? undefined} step="0.1" className="input mt-1" value={selectedSegment.sourceEnd} disabled={selectedSegment.locked} onChange={(event) => updateSegment(selectedSegment.id, { sourceEnd: Number(event.target.value) })} /></label>
                </div>
                <button type="button" onClick={() => updateSegment(selectedSegment.id, { locked: !selectedSegment.locked })} className={`rounded-lg border px-3 py-2 text-xs ${selectedSegment.locked ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-white/10"}`}>{selectedSegment.locked ? "🔒 Momento protegido" : "🔓 Proteger este momento"}</button>
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-white/65">Línea temporal · pista de vídeo</span><span className="text-[10px] text-white/30">Arrastra o usa las flechas</span></div>
            {segments.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-xs text-white/35">Prepara una propuesta o añade recursos desde la bandeja.</div> : (
              <div className="flex min-h-24 gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-3">
                {segments.map((segment, index) => {
                  const duration = segmentDuration(segment);
                  const selected = segment.id === selectedSegmentId;
                  return <article key={segment.id} draggable onDragStart={() => setDraggingId(segment.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropBefore(segment.id)} onClick={() => setSelectedSegmentId(segment.id)} style={{ flexBasis: `${Math.max(100, duration * 17)}px` }} className={`group relative min-w-[100px] flex-none cursor-pointer overflow-hidden rounded-xl border p-2 transition ${selected ? "border-cyan-300 bg-cyan-300/10" : segment.locked ? "border-emerald-300/25 bg-emerald-300/[0.06]" : "border-white/10 bg-white/5"}`}>
                    <div className="flex gap-1"><span className="text-[9px] text-white/30">{index + 1}</span><span className="ml-auto text-[9px]">{segment.locked ? "🔒" : "⋮⋮"}</span></div>
                    <div className="mt-2 line-clamp-2 text-[10px] font-medium">{segment.label}</div><div className="mt-1 text-[9px] text-white/35">{duration.toFixed(1)}s · {segment.kind}</div>
                    <div className="mt-2 flex gap-1"><button type="button" onClick={(event) => { event.stopPropagation(); move(segment.id, -1); }} className="rounded border border-white/10 px-1.5">↑</button><button type="button" onClick={(event) => { event.stopPropagation(); move(segment.id, 1); }} className="rounded border border-white/10 px-1.5">↓</button><button type="button" disabled={segment.locked} onClick={(event) => { event.stopPropagation(); setSegments((current) => current.filter((item) => item.id !== segment.id)); }} className="ml-auto rounded border border-red-300/10 px-1.5 text-red-300 disabled:opacity-25">×</button></div>
                  </article>;
                })}
              </div>
            )}
          </div>

          <div><div className="mb-2 text-xs font-semibold text-white/65">Bandeja de vídeos</div><div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">{videos.map((asset) => { const uses = segments.filter((segment) => segment.assetId === asset.id).length; return <div key={asset.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 p-2"><span className="min-w-0 flex-1"><span className="block truncate text-xs">{asset.name}</span><span className={`text-[9px] ${asset.kind === "clip" && uses === 0 ? "text-amber-300" : "text-white/35"}`}>{asset.kind} · {asset.duration?.toFixed(1) ?? "?"}s · {uses ? `${uses} uso${uses > 1 ? "s" : ""}` : "sin usar"}</span></span><button type="button" onClick={() => addAsset(asset)} className="rounded-lg border border-white/10 px-2 py-1 text-xs hover:bg-white/5">+ Añadir</button></div>; })}</div></div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/50">Locución<select className="input mt-1" value={voiceId} onChange={(event) => setVoiceId(event.target.value)}><option value="">Audio original</option>{voices.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.duration?.toFixed(1) ?? "?"}s</option>)}</select></label>
            <label className="text-xs text-white/50">Música<select className="input mt-1" value={musicId} onChange={(event) => setMusicId(event.target.value)}><option value="">Sin música</option>{music.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
          </div>
          {musicId && <label className="block text-xs text-white/50">Volumen · {Math.round(musicVolume * 100)}%<input className="mt-2 w-full accent-purple-500" type="range" min="0.02" max="0.5" step="0.01" value={musicVolume} onChange={(event) => setMusicVolume(Number(event.target.value))} /></label>}
          <label className="block text-xs text-white/50">Subtítulos obligatorios<textarea className="input mt-1 min-h-28" value={subtitleText} onChange={(event) => setSubtitleText(event.target.value)} placeholder="Pega la locución exacta. Se mostrará abajo, dentro de la zona segura." /></label>
          {message && <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">{message}</div>}
          <button onClick={renderMix} disabled={busy || !name.trim() || !segments.length || !subtitleText.trim() || !durationOk} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-3 text-sm font-bold disabled:opacity-35">{busy ? "Mezclando…" : durationOk ? "MIX · Generar nueva versión" : "Ajusta las duraciones antes de MIX"}</button>
        </div>

        <div><div className="mb-2 text-xs font-semibold text-white/65">Resultados</div><div className="space-y-3">{mixes.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-xs text-white/35">Tus versiones aparecerán aquí.</div>}{mixes.map((mix) => <article key={mix.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">{mix.status === "ready" ? <video controls src={`/api/projects/${projectId}/mixes/${mix.id}/file`} className="aspect-[9/16] max-h-[420px] w-full bg-black object-contain" /> : <div className="flex aspect-video items-center justify-center text-xs text-white/40">{mix.status === "error" ? "Render con error" : "Renderizando…"}</div>}<div className="p-3"><div className="flex gap-2"><span className="min-w-0 flex-1 truncate text-sm font-medium">{mix.name}</span><span className="text-[10px] text-white/40">{mix.status}</span></div>{mix.error && <p className="mt-2 text-[11px] text-red-300">{mix.error}</p>}<div className="mt-3 flex gap-2">{mix.status === "ready" && mix.pieceId && <button onClick={() => useAsFinal(mix)} className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold">Usar como final</button>}<button onClick={() => removeMix(mix)} className="ml-auto rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300">Eliminar</button></div></div></article>)}</div></div>
      </div>
    </section>
  );
}
