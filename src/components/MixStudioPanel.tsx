"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MixOverlay, MixSegment } from "@/core/media/mix-contracts";
import type { StudioAsset } from "./MediaStudio";
import { useAppDialog } from "./AppDialog";

type PiecePick = {
  id: string;
  titulo: string;
  origin: string;
  content?: { guion?: { locucion?: string } };
  assets?: {
    recordingPath?: string;
    presenterPath?: string;
    videoPath?: string;
    audioPath?: string;
    clips?: string[];
  };
};
type MixDto = { id: string; pieceId: string | null; name: string; status: string; outputPath: string | null; error: string | null };

const VIDEO_KINDS = ["recording", "video", "clip", "presenter", "final"];
const MIN_SEGMENT_SECONDS = 0.25;

const ASSET_META: Record<string, { label: string; icon: string; badge: string }> = {
  recording: { label: "Navegación", icon: "▣", badge: "border-emerald-300/25 bg-emerald-300/15 text-emerald-100" },
  clip: { label: "Clip IA", icon: "✦", badge: "border-purple-300/25 bg-purple-300/15 text-purple-100" },
  presenter: { label: "Presentador", icon: "◉", badge: "border-pink-300/25 bg-pink-300/15 text-pink-100" },
  final: { label: "Vídeo final", icon: "◆", badge: "border-amber-300/25 bg-amber-300/15 text-amber-100" },
  video: { label: "Vídeo", icon: "▶", badge: "border-cyan-300/25 bg-cyan-300/15 text-cyan-100" },
};

function assetMeta(asset: Pick<StudioAsset, "kind" | "origin">) {
  if (asset.origin === "mix") return { label: "Versión MIX", icon: "◇", badge: "border-cyan-300/25 bg-cyan-300/15 text-cyan-100" };
  if (asset.kind === "recording" && asset.origin === "playwright") return { ...ASSET_META.recording, label: "Playwright" };
  if (asset.kind === "recording" && asset.origin === "recorder") return { ...ASSET_META.recording, label: "Grabación manual" };
  return ASSET_META[asset.kind] ?? ASSET_META.video;
}

type OverlayGesture = {
  overlayId: string;
  mode: "move" | "resize-start" | "resize-end";
  clientX: number;
  pixelsPerSecond: number;
  initial: MixOverlay;
  assetDuration: number;
};

type PreviewMode = "live" | "asset" | "mix";
type VideoFilter = "all" | "principal" | "clip" | "final" | "mix";

type BaseTimelineItem = {
  segment: MixSegment;
  asset: StudioAsset | null;
  start: number;
  end: number;
};

const roundTenth = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function formatTimecode(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${rest.toFixed(1).padStart(4, "0")}`;
}

function segmentDuration(segment: MixSegment): number {
  return Math.max(0, segment.sourceEnd - segment.sourceStart);
}

function overlayDuration(overlay: MixOverlay): number {
  return Math.max(0, overlay.sourceEnd - overlay.sourceStart);
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

function newOverlay(asset: StudioAsset, timelineStart = 0): MixOverlay {
  const sourceDuration = Math.max(MIN_SEGMENT_SECONDS, asset.duration ?? 5);
  return {
    id: `overlay-${asset.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    assetId: asset.id,
    sourceStart: 0,
    sourceEnd: Math.min(5, sourceDuration),
    timelineStart: roundTenth(Math.max(0, timelineStart)),
    label: asset.name,
    kind: asset.kind,
    mode: "cover",
    position: "top-right",
    size: 0.36,
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
  const [overlays, setOverlays] = useState<MixOverlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState("");
  const [draggingId, setDraggingId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [musicId, setMusicId] = useState("");
  const [subtitleText, setSubtitleText] = useState("");
  const [musicVolume, setMusicVolume] = useState(0.12);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [overlayGesture, setOverlayGesture] = useState<OverlayGesture | null>(null);
  const [previewAssetId, setPreviewAssetId] = useState("");
  const [previewMixId, setPreviewMixId] = useState("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("live");
  const [playheadTime, setPlayheadTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(24);
  const [videoFilter, setVideoFilter] = useState<VideoFilter>("all");
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const appDialog = useAppDialog();

  const load = useCallback(async () => {
    const [pieceResponse, mixResponse] = await Promise.all([
      fetch(`/api/content/${projectId}`, { cache: "no-store" }),
      fetch(`/api/projects/${projectId}/mixes`, { cache: "no-store" }),
    ]);
    if (pieceResponse.ok) setPieces(((await pieceResponse.json()) as { pieces?: PiecePick[] }).pieces ?? []);
    if (mixResponse.ok) {
      const nextMixes = ((await mixResponse.json()) as { mixes?: MixDto[] }).mixes ?? [];
      setMixes(nextMixes);
      setPreviewMixId((current) => current && nextMixes.some((mix) => mix.id === current)
        ? current
        : nextMixes.find((mix) => mix.status === "ready")?.id ?? "");
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  const videos = useMemo(() => assets.filter((asset) => VIDEO_KINDS.includes(asset.kind)), [assets]);
  const filteredVideos = useMemo(() => videos.filter((asset) => {
    if (videoFilter === "all") return true;
    if (videoFilter === "mix") return asset.origin === "mix";
    if (videoFilter === "clip") return asset.kind === "clip";
    if (videoFilter === "final") return asset.kind === "final" && asset.origin !== "mix";
    return asset.origin !== "mix" && ["recording", "video", "presenter"].includes(asset.kind);
  }), [videoFilter, videos]);
  const voices = useMemo(() => assets.filter((asset) => asset.kind === "audio"), [assets]);
  const music = useMemo(() => assets.filter((asset) => ["music", "audio"].includes(asset.kind)), [assets]);
  const byId = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const selectedSegment = segments.find((segment) => segment.id === selectedSegmentId) ?? null;
  const selectedAsset = selectedSegment ? byId.get(selectedSegment.assetId) ?? null : null;
  const selectedOverlay = overlays.find((overlay) => overlay.id === selectedOverlayId) ?? null;
  const selectedOverlayAsset = selectedOverlay ? byId.get(selectedOverlay.assetId) ?? null : null;
  const selectedVoice = voiceId ? byId.get(voiceId) ?? null : null;
  const selectedMusic = musicId ? byId.get(musicId) ?? null : null;
  const previewAsset = previewAssetId ? byId.get(previewAssetId) ?? null : null;
  const previewMix = previewMixId ? mixes.find((mix) => mix.id === previewMixId) ?? null : null;
  const monitorAsset = previewAsset ?? selectedOverlayAsset ?? selectedAsset ?? videos[0] ?? null;
  const monitorMeta = monitorAsset ? assetMeta(monitorAsset) : null;
  const monitorSource = previewMode === "mix" && previewMix
    ? `/api/projects/${projectId}/mixes/${previewMix.id}/file`
    : previewMode === "asset" && monitorAsset
      ? `/api/projects/${projectId}/media/${monitorAsset.id}/file`
      : "";
  const visualDuration = segments.reduce((sum, segment) => sum + segmentDuration(segment), 0);
  const voiceDuration = selectedVoice?.duration ?? null;
  const durationDelta = voiceDuration === null ? 0 : voiceDuration - visualDuration;
  const layeredTail = overlays.length > 0 && durationDelta > 0.25;
  const durationOk = voiceDuration === null || Math.abs(durationDelta) <= 0.25 || layeredTail;
  const timelineDuration = voiceDuration ?? visualDuration;
  const baseTimeline = useMemo(() => {
    let cursor = 0;
    return segments.map((segment): BaseTimelineItem => {
      const start = cursor;
      cursor += segmentDuration(segment);
      return { segment, asset: byId.get(segment.assetId) ?? null, start, end: cursor };
    });
  }, [segments, byId]);
  const activeBase = baseTimeline.find((item) => playheadTime >= item.start && playheadTime < item.end)
    ?? (playheadTime >= visualDuration - 0.01 ? baseTimeline.at(-1) ?? null : null);
  const activeOverlays = overlays.filter((overlay) => (
    playheadTime >= overlay.timelineStart && playheadTime < overlay.timelineStart + overlayDuration(overlay)
  ));
  const timelineCanvasWidth = Math.max(720, timelineDuration * timelineZoom);
  const rulerStep = timelineZoom >= 36 ? 2 : timelineZoom >= 20 ? 5 : 10;
  const rulerTicks = Array.from(
    { length: Math.max(1, Math.floor(timelineDuration / rulerStep) + 1) },
    (_, index) => index * rulerStep,
  );
  const subtitleChunks = useMemo(
    () => (subtitleText.match(/[^.!?]+[.!?]?/g) ?? []).map((part) => part.trim()).filter(Boolean),
    [subtitleText],
  );
  const liveSubtitle = subtitleChunks.length > 0
    ? subtitleChunks[Math.min(subtitleChunks.length - 1, Math.floor((playheadTime / Math.max(0.01, timelineDuration)) * subtitleChunks.length))]
    : "";
  const overlaysFit = overlays.every(
    (overlay) => overlay.timelineStart + overlayDuration(overlay) <= timelineDuration + 0.01,
  );
  const protectedRanges = useMemo(() => {
    let cursor = 0;
    return segments.flatMap((segment) => {
      const start = cursor;
      cursor += segmentDuration(segment);
      return segment.locked ? [{ start, end: cursor, label: segment.label }] : [];
    });
  }, [segments]);
  const selectedOverlayEnd = selectedOverlay
    ? selectedOverlay.timelineStart + overlayDuration(selectedOverlay)
    : 0;
  const coversProtectedMoment = Boolean(selectedOverlay?.mode === "cover" && protectedRanges.some(
    (range) => selectedOverlay.timelineStart < range.end && selectedOverlayEnd > range.start,
  ));

  useEffect(() => {
    if (!overlayGesture || timelineDuration <= 0) return;
    const onPointerMove = (event: PointerEvent) => {
      const delta = (event.clientX - overlayGesture.clientX) / overlayGesture.pixelsPerSecond;
      const initial = overlayGesture.initial;
      const duration = overlayDuration(initial);
      setOverlays((current) => current.map((overlay) => {
        if (overlay.id !== overlayGesture.overlayId) return overlay;
        if (overlayGesture.mode === "move") {
          return {
            ...overlay,
            timelineStart: roundTenth(clamp(initial.timelineStart + delta, 0, Math.max(0, timelineDuration - duration))),
          };
        }
        if (overlayGesture.mode === "resize-start") {
          const adjusted = clamp(
            delta,
            Math.max(-initial.sourceStart, -initial.timelineStart),
            duration - MIN_SEGMENT_SECONDS,
          );
          return {
            ...overlay,
            timelineStart: roundTenth(initial.timelineStart + adjusted),
            sourceStart: roundTenth(initial.sourceStart + adjusted),
          };
        }
        const maxGrowth = Math.min(
          overlayGesture.assetDuration - initial.sourceEnd,
          timelineDuration - initial.timelineStart - duration,
        );
        const adjusted = clamp(delta, -(duration - MIN_SEGMENT_SECONDS), Math.max(0, maxGrowth));
        return { ...overlay, sourceEnd: roundTenth(initial.sourceEnd + adjusted) };
      }));
    };
    const onPointerUp = () => setOverlayGesture(null);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
    window.addEventListener("pointercancel", onPointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [overlayGesture, timelineDuration]);

  useEffect(() => {
    if (timelineDuration <= 0) {
      setPlayheadTime(0);
      setPlaying(false);
      return;
    }
    setPlayheadTime((current) => Math.min(current, timelineDuration));
  }, [timelineDuration]);

  useEffect(() => {
    if (!playing || timelineDuration <= 0) return;
    const startedAt = performance.now();
    const from = playheadTime >= timelineDuration - 0.02 ? 0 : playheadTime;
    if (from !== playheadTime) setPlayheadTime(from);
    let frame = 0;
    const tick = (now: number) => {
      const next = from + (now - startedAt) / 1000;
      if (next >= timelineDuration) {
        setPlayheadTime(timelineDuration);
        setPlaying(false);
        return;
      }
      setPlayheadTime(next);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
    // El inicio se captura al pulsar play; los frames posteriores no deben reiniciar el reloj.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, timelineDuration]);

  useEffect(() => {
    if (!playing) return;
    const viewport = timelineScrollRef.current;
    if (!viewport) return;
    const playheadX = playheadTime * timelineZoom;
    const visibleRight = viewport.scrollLeft + viewport.clientWidth;
    if (playheadX > visibleRight - 72) {
      viewport.scrollLeft = Math.max(0, playheadX - viewport.clientWidth * 0.25);
    }
  }, [playheadTime, playing, timelineZoom]);

  function beginOverlayGesture(event: React.PointerEvent, overlay: MixOverlay, mode: OverlayGesture["mode"]) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setPlaying(false);
    setPreviewMode("live");
    setSelectedOverlayId(overlay.id);
    setSelectedSegmentId("");
    setOverlayGesture({
      overlayId: overlay.id,
      mode,
      clientX: event.clientX,
      pixelsPerSecond: timelineZoom,
      initial: { ...overlay },
      assetDuration: byId.get(overlay.assetId)?.duration ?? overlay.sourceEnd,
    });
  }

  function seekTimeline(event: React.PointerEvent<HTMLElement>) {
    if (timelineDuration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const time = clamp((event.clientX - rect.left) / timelineZoom, 0, timelineDuration);
    setPlaying(false);
    setPreviewMode("live");
    setPlayheadTime(time);
  }

  function handleTimelineKey(event: React.KeyboardEvent<HTMLElement>) {
    if (timelineDuration <= 0) return;
    if (event.key === " ") {
      event.preventDefault();
      setPreviewMode("live");
      setPlaying((current) => !current);
      return;
    }
    const step = event.shiftKey ? 2 : 0.5;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    setPlaying(false);
    setPreviewMode("live");
    setPlayheadTime((current) => {
      if (event.key === "Home") return 0;
      if (event.key === "End") return timelineDuration;
      return clamp(current + (event.key === "ArrowLeft" ? -step : step), 0, timelineDuration);
    });
  }

  function applyPieceNarration(piece: PiecePick | undefined, pieceVoice: StudioAsset | undefined) {
    if (pieceVoice) {
      setVoiceId(pieceVoice.id);
      const voiceNarration = pieces.find((item) => (
        item.id === pieceVoice.pieceId || item.assets?.audioPath === pieceVoice.path
      ))?.content?.guion?.locucion?.trim() ?? "";
      if (voiceNarration) setSubtitleText(voiceNarration);
      return;
    }
    if (pieceId) {
      setVoiceId("");
      setSubtitleText(piece?.content?.guion?.locucion?.trim() ?? "");
    }
  }

  function selectVoice(nextVoiceId: string) {
    setVoiceId(nextVoiceId);
    if (!nextVoiceId) return;
    const voice = byId.get(nextVoiceId);
    const narration = pieces.find((piece) => (
      piece.id === voice?.pieceId || piece.assets?.audioPath === voice?.path
    ))?.content?.guion?.locucion?.trim() ?? "";
    if (narration) {
      setSubtitleText(narration);
      setMessage("Subtítulos recuperados automáticamente del guion asociado a esta locución.");
      return;
    }
    setMessage("Esta locución no tiene un guion asociado. Conservamos los subtítulos actuales para que puedas revisarlos o pegarlos a mano.");
  }

  function segmentFromOverlay(overlay: MixOverlay): MixSegment {
    return {
      id: `segment-${overlay.id}-${Date.now()}`,
      assetId: overlay.assetId,
      sourceStart: overlay.sourceStart,
      sourceEnd: overlay.sourceEnd,
      label: overlay.label,
      kind: overlay.kind,
      locked: false,
    };
  }

  function overlayFromSegment(segment: MixSegment, timelineStart: number, index: number): MixOverlay {
    return {
      id: `overlay-${segment.id}-${Date.now()}-${index}`,
      assetId: segment.assetId,
      sourceStart: segment.sourceStart,
      sourceEnd: segment.sourceEnd,
      timelineStart: roundTenth(Math.max(0, timelineStart)),
      label: segment.label,
      kind: segment.kind,
      mode: "pip",
      position: index % 2 === 0 ? "top-right" : "top-left",
      size: 0.36,
    };
  }

  function addAsset(asset: StudioAsset, locked?: boolean) {
    const segment = newSegment(asset, locked ?? asset.kind === "recording");
    setSegments((current) => [...current, segment]);
    setSelectedSegmentId(segment.id);
    setPreviewMode("live");
    setPlayheadTime(visualDuration);
  }

  function addOverlay(asset: StudioAsset) {
    const probe = newOverlay(asset);
    const lastEnd = overlays.reduce(
      (max, overlay) => Math.max(max, overlay.timelineStart + overlayDuration(overlay)),
      0,
    );
    probe.timelineStart = Math.min(
      Math.max(0, timelineDuration - overlayDuration(probe)),
      lastEnd,
    );
    setOverlays((current) => [...current, probe]);
    setSelectedOverlayId(probe.id);
    setSelectedSegmentId("");
    setPreviewMode("live");
    setPlayheadTime(probe.timelineStart);
  }

  function prepareAutomatic() {
    const piece = pieces.find((item) => item.id === pieceId);
    const pieceVoice = (voiceId ? byId.get(voiceId) : undefined)
      ?? voices.find((asset) => asset.pieceId === pieceId || asset.path === piece?.assets?.audioPath);
    if (segments.length || overlays.length) {
      const layerSegments = [...overlays]
        .sort((left, right) => left.timelineStart - right.timelineStart)
        .map(segmentFromOverlay);
      const proposed = [...segments, ...layerSegments];
      const fitted = pieceVoice?.duration
        ? fitTimelineToTarget(proposed, pieceVoice.duration, byId)
        : { segments: proposed, remaining: 0 };
      setSegments(fitted.segments);
      setOverlays([]);
      setSelectedSegmentId(fitted.segments[0]?.id ?? "");
      setSelectedOverlayId("");
      setPreviewMode("live");
      setPlayheadTime(0);
      applyPieceNarration(piece, pieceVoice);
      setMessage(layerSegments.length
        ? `Modo secuencial aplicado a tu selección: ${fitted.segments.length} bloque(s) en Principal y ninguna capa.`
        : "La selección ya estaba en modo secuencial; no se añadió ningún recurso nuevo.");
      return;
    }
    if (!pieceId) {
      setMessage("Añade recursos manualmente o elige una pieza destino antes de preparar una propuesta. No importaremos toda la mediateca.");
      return;
    }
    const linkedPaths = new Set([
      piece?.assets?.recordingPath,
      piece?.assets?.presenterPath,
      piece?.assets?.videoPath,
      ...(piece?.assets?.clips ?? []),
    ].filter((value): value is string => Boolean(value)));
    const pieceAssets = videos.filter((asset) => asset.pieceId === pieceId || linkedPaths.has(asset.path));
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
    const proposed = ordered.map((item) => "assetId" in item ? item : newSegment(item, item.kind === "recording"));
    const fitted = pieceVoice?.duration
      ? fitTimelineToTarget(proposed, pieceVoice.duration, byId)
      : { segments: proposed, remaining: 0 };
    const next = fitted.segments;
    setSegments(next);
    setOverlays([]);
    setSelectedSegmentId(next[0]?.id ?? "");
    setSelectedOverlayId("");
    setPreviewMode("live");
    setPlayheadTime(0);
    applyPieceNarration(piece, pieceVoice);
    setMessage(next.length
      ? Math.abs(fitted.remaining) <= 0.25
        ? "Propuesta armonizada. Las grabaciones quedan protegidas; revisa duración y recortes."
        : `Propuesta creada, pero quedan ${Math.abs(fitted.remaining).toFixed(2)}s por ajustar sin tocar protegidos.`
      : "No hay vídeos compatibles para preparar el MIX.");
  }

  function prepareLayered() {
    const piece = pieces.find((item) => item.id === pieceId);
    const pieceVoice = (voiceId ? byId.get(voiceId) : undefined)
      ?? voices.find((asset) => asset.pieceId === pieceId || asset.path === piece?.assets?.audioPath);
    if (segments.length) {
      const recordingBase = segments.filter((segment) => segment.kind === "recording");
      const base = recordingBase.length ? recordingBase : segments.slice(0, 1);
      const baseIds = new Set(base.map((segment) => segment.id));
      const promoteToLayers = segments.filter((segment) => !baseIds.has(segment.id));
      const baseDuration = base.reduce((sum, segment) => sum + segmentDuration(segment), 0);
      const targetDuration = pieceVoice?.duration ?? baseDuration;
      const converted = promoteToLayers.map((segment, index) => {
        const duration = segmentDuration(segment);
        const centered = ((index + 1) * targetDuration) / (promoteToLayers.length + 1) - duration / 2;
        return overlayFromSegment(
          segment,
          Math.min(Math.max(0, centered), Math.max(0, targetDuration - duration)),
          overlays.length + index,
        );
      });
      setSegments(base);
      setOverlays((current) => [...current, ...converted]);
      setSelectedSegmentId(base[0]?.id ?? "");
      setSelectedOverlayId("");
      setPreviewMode("live");
      setPlayheadTime(0);
      applyPieceNarration(piece, pieceVoice);
      setMessage(converted.length
        ? `Modo por capas aplicado a tu selección: ${base.length} bloque(s) en Principal y ${overlays.length + converted.length} capa(s).`
        : `La selección ya estaba en capas: ${base.length} bloque(s) en Principal y ${overlays.length} capa(s). No se añadió ningún recurso.`);
      return;
    }
    if (!pieceId) {
      setMessage("Añade primero un vídeo principal o elige una pieza destino. No importaremos todas las grabaciones del proyecto.");
      return;
    }
    const linkedPaths = new Set([
      piece?.assets?.recordingPath,
      piece?.assets?.presenterPath,
      ...(piece?.assets?.clips ?? []),
    ].filter((value): value is string => Boolean(value)));
    const pieceAssets = videos.filter((asset) => asset.pieceId === pieceId || linkedPaths.has(asset.path));
    const base = pieceAssets.filter((asset) => asset.kind === "recording").flatMap(recordingSegments);
    if (!base.length) {
      setMessage("Para preparar en capas necesitas una grabación manual o Playwright como pista base.");
      return;
    }
    const baseDuration = base.reduce((sum, segment) => sum + segmentDuration(segment), 0);
    const targetDuration = pieceVoice?.duration ?? baseDuration;
    const upperAssets = pieceAssets.filter((asset) => ["clip", "video", "presenter"].includes(asset.kind)).slice(0, 6);
    const proposedOverlays = upperAssets.map((asset, index) => {
      const overlay = newOverlay(asset);
      overlay.sourceEnd = Math.min(overlay.sourceEnd, overlay.sourceStart + targetDuration);
      const centered = ((index + 1) * targetDuration) / (upperAssets.length + 1) - overlayDuration(overlay) / 2;
      overlay.timelineStart = roundTenth(Math.max(0, Math.min(centered, targetDuration - overlayDuration(overlay))));
      overlay.mode = "pip";
      overlay.position = index % 2 === 0 ? "top-right" : "top-left";
      return overlay;
    });
    setSegments(base);
    setOverlays(proposedOverlays);
    setSelectedSegmentId(base[0]?.id ?? "");
    setSelectedOverlayId("");
    setPreviewMode("live");
    setPlayheadTime(0);
    applyPieceNarration(piece, pieceVoice);
    setMessage(proposedOverlays.length
      ? pieceVoice?.duration && pieceVoice.duration > baseDuration + 0.25
        ? "Propuesta en capas creada. La locución es más larga: tras terminar la navegación se mantendrá su último frame bajo los apoyos."
        : "Propuesta en capas creada: la navegación continúa debajo y los apoyos empiezan en picture-in-picture."
      : "Principal preparado. Añade apoyos con + Capa desde la bandeja.");
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

  function updateOverlay(id: string, patch: Partial<MixOverlay>) {
    setOverlays((current) => current.map((overlay) => {
      if (overlay.id !== id) return overlay;
      const asset = byId.get(overlay.assetId);
      const next = { ...overlay, ...patch };
      const maxEnd = asset?.duration ?? Number.POSITIVE_INFINITY;
      next.sourceStart = Math.min(
        Number.isFinite(maxEnd) ? Math.max(0, maxEnd - MIN_SEGMENT_SECONDS) : Number.POSITIVE_INFINITY,
        Math.max(0, next.sourceStart),
      );
      next.sourceEnd = Math.min(maxEnd, Math.max(next.sourceStart + MIN_SEGMENT_SECONDS, next.sourceEnd));
      const maxTimelineStart = Math.max(0, timelineDuration - overlayDuration(next));
      next.timelineStart = Math.min(maxTimelineStart, Math.max(0, next.timelineStart));
      next.size = Math.min(0.8, Math.max(0.2, next.size));
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
        recipe: { version: 2, segments, overlays, voiceAssetId: voiceId, musicAssetId: musicId, subtitleText, musicVolume },
      }),
    });
    const data = (await response.json()) as { error?: string };
    setMessage(response.ok ? "MIX terminado. Revisa el resultado antes de usarlo como final." : data.error || "El MIX falló.");
    setBusy(false);
    if (response.ok) {
      setPreviewMixId("");
      setPreviewMode("mix");
    }
    await Promise.all([load(), onMediaChanged()]);
  }

  async function useAsFinal(mix: MixDto) {
    if (!await appDialog.confirm({
      title: "Usar como vídeo final",
      message: `«${mix.name}» sustituirá el vídeo final actual de la pieza. El resto de versiones se conservará.`,
      confirmLabel: "Usar como final",
    })) return;
    const response = await fetch(`/api/projects/${projectId}/mixes/${mix.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ useAsFinal: true }) });
    const data = (await response.json()) as { error?: string };
    setMessage(response.ok ? "MIX seleccionado como vídeo final." : data.error || "No se pudo aplicar.");
  }

  async function removeMix(mix: MixDto) {
    if (!await appDialog.confirm({
      title: "Eliminar versión MIX",
      message: `Se eliminará «${mix.name}» y su archivo renderizado.`,
      confirmLabel: "Eliminar versión",
      tone: "danger",
    })) return;
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
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 text-[10px] font-bold">1</span><div><div className="text-xs font-semibold text-white/75">Configura la versión</div><div className="text-[10px] text-white/35">Ponle nombre y, si existe, vincúlala a una pieza.</div></div></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-white/50">Nombre<input className="input mt-1" value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label className="text-xs text-white/50">Pieza destino (opcional)<select className="input mt-1" value={pieceId} onChange={(event) => setPieceId(event.target.value)}><option value="">Solo mediateca</option>{pieces.map((piece) => <option key={piece.id} value={piece.id}>{piece.titulo || "Sin título"} · {piece.origin}</option>)}</select></label>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-400/15 text-[10px] font-bold text-purple-100">2</span><div><div className="text-xs font-semibold text-white/70">Elige el plan visual</div><div className="mt-1 text-[10px] text-white/35">Las grabaciones se protegen automáticamente; puedes desbloquearlas.</div></div></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={prepareAutomatic} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65">Preparar secuencial</button>
                <button type="button" onClick={prepareLayered} className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">Preparar en capas</button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-[10px] leading-relaxed sm:grid-cols-2">
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-2.5"><b className="text-white/70">Secuencial</b><span className="mt-0.5 block text-white/40">Coloca navegación y vídeos de apoyo uno después de otro. Es la opción adecuada cuando cada recurso debe ocupar toda la pantalla.</span></div>
              <div className="rounded-xl border border-cyan-400/12 bg-cyan-400/[0.035] p-2.5"><b className="text-cyan-200">En capas</b><span className="mt-0.5 block text-white/40">Mantiene la navegación como fondo continuo y superpone apoyos en pantalla completa o picture-in-picture.</span></div>
            </div>
            <p className="mt-2 text-[10px] text-white/35">En ambos modos, al elegir una pieza destino se recuperan su locución y sus subtítulos. Si la pieza no tiene guion, el campo queda vacío para que lo completes.</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white/5 p-2"><span className="block text-[9px] uppercase text-white/30">Vídeo</span><b>{visualDuration.toFixed(2)}s</b></div>
              <div className="rounded-xl bg-white/5 p-2"><span className="block text-[9px] uppercase text-white/30">Locución</span><b>{voiceDuration === null ? "—" : `${voiceDuration.toFixed(2)}s`}</b></div>
              <div className={`rounded-xl p-2 ${durationOk ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-200"}`}><span className="block text-[9px] uppercase opacity-60">Diferencia</span><b>{voiceDuration === null ? "—" : `${durationDelta >= 0 ? "+" : ""}${durationDelta.toFixed(2)}s`}</b></div>
            </div>
            {!durationOk && <button type="button" onClick={harmonize} className="mt-2 w-full rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">Ajustar a locución sin tocar protegidos</button>}
            {layeredTail && <div className="mt-2 rounded-lg border border-cyan-300/15 bg-cyan-300/5 px-3 py-2 text-[10px] text-cyan-100">La pista base es más corta que la locución: su último frame se mantendrá durante {durationDelta.toFixed(2)}s mientras las superposiciones continúan.</div>}
          </div>

          {selectedAsset && selectedSegment && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex items-center gap-2"><AssetBadge asset={selectedAsset} /><span className="text-sm font-semibold">{selectedSegment.label}</span></div><div className="mt-1 text-[10px] text-white/35">Fuente: {selectedAsset.duration?.toFixed(2) ?? "?"}s · bloque: {segmentDuration(selectedSegment).toFixed(2)}s</div></div><button type="button" onClick={() => { setPlaying(false); setPreviewAssetId(selectedAsset.id); setPreviewMode("asset"); }} className="rounded-lg border border-white/12 px-3 py-1.5 text-[10px] hover:bg-white/5">▶ Ver recurso</button></div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-white/45">Entrada<input type="number" min="0" max={selectedAsset.duration ?? undefined} step="0.1" className="input mt-1" value={selectedSegment.sourceStart} disabled={selectedSegment.locked} onChange={(event) => updateSegment(selectedSegment.id, { sourceStart: Number(event.target.value) })} /></label>
                  <label className="text-[10px] text-white/45">Salida<input type="number" min="0.25" max={selectedAsset.duration ?? undefined} step="0.1" className="input mt-1" value={selectedSegment.sourceEnd} disabled={selectedSegment.locked} onChange={(event) => updateSegment(selectedSegment.id, { sourceEnd: Number(event.target.value) })} /></label>
                </div>
                <button type="button" onClick={() => updateSegment(selectedSegment.id, { locked: !selectedSegment.locked })} className={`rounded-lg border px-3 py-2 text-xs ${selectedSegment.locked ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-white/10"}`}>{selectedSegment.locked ? "🔒 Momento protegido" : "🔓 Proteger este momento"}</button>
              </div>
            </div>
          )}

          {selectedOverlayAsset && selectedOverlay && (
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-3">
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><div className="flex items-center gap-2"><AssetBadge asset={selectedOverlayAsset} /><span className="text-sm font-semibold">{selectedOverlay.label}</span></div>
                  <div className="text-[10px] text-white/35">Capa visual · {overlayDuration(selectedOverlay).toFixed(2)}s · audio silenciado</div>
                  </div><button type="button" onClick={() => { setPlaying(false); setPreviewAssetId(selectedOverlayAsset.id); setPreviewMode("asset"); }} className="rounded-lg border border-cyan-300/20 px-3 py-1.5 text-[10px] text-cyan-100 hover:bg-cyan-300/5">▶ Ver recurso</button></div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-[10px] text-white/45">Empieza en<input type="number" min="0" max={Math.max(0, timelineDuration - overlayDuration(selectedOverlay))} step="0.1" className="input mt-1" value={selectedOverlay.timelineStart} onChange={(event) => updateOverlay(selectedOverlay.id, { timelineStart: Number(event.target.value) })} /></label>
                  <label className="text-[10px] text-white/45">Entrada<input type="number" min="0" max={selectedOverlayAsset.duration ?? undefined} step="0.1" className="input mt-1" value={selectedOverlay.sourceStart} onChange={(event) => updateOverlay(selectedOverlay.id, { sourceStart: Number(event.target.value) })} /></label>
                  <label className="text-[10px] text-white/45">Salida<input type="number" min="0.25" max={selectedOverlayAsset.duration ?? undefined} step="0.1" className="input mt-1" value={selectedOverlay.sourceEnd} onChange={(event) => updateOverlay(selectedOverlay.id, { sourceEnd: Number(event.target.value) })} /></label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[10px] text-white/45">Presentación<select className="input mt-1" value={selectedOverlay.mode} onChange={(event) => updateOverlay(selectedOverlay.id, { mode: event.target.value === "pip" ? "pip" : "cover" })}><option value="cover">Pantalla completa</option><option value="pip">Picture-in-picture</option></select></label>
                  {selectedOverlay.mode === "pip" && <label className="text-[10px] text-white/45">Posición<select className="input mt-1" value={selectedOverlay.position} onChange={(event) => updateOverlay(selectedOverlay.id, { position: event.target.value as MixOverlay["position"] })}><option value="top-right">Arriba derecha</option><option value="top-left">Arriba izquierda</option><option value="center">Centro</option><option value="bottom-right">Abajo derecha</option><option value="bottom-left">Abajo izquierda</option></select></label>}
                </div>
                {selectedOverlay.mode === "pip" && <label className="block text-[10px] text-white/45">Tamaño · {Math.round(selectedOverlay.size * 100)}%<input type="range" min="0.2" max="0.8" step="0.02" className="mt-2 w-full accent-cyan-400" value={selectedOverlay.size} onChange={(event) => updateOverlay(selectedOverlay.id, { size: Number(event.target.value) })} /></label>}
                {coversProtectedMoment && <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[10px] text-amber-100">Esta pantalla completa tapa un momento protegido de la navegación. Muévela o usa picture-in-picture.</div>}
                <button type="button" onClick={() => { setOverlays((current) => current.filter((item) => item.id !== selectedOverlay.id)); setSelectedOverlayId(""); }} className="rounded-lg border border-red-300/15 px-3 py-2 text-xs text-red-200">Quitar superposición</button>
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-400/15 text-[10px] font-bold text-cyan-100">3</span><div><span className="block text-xs font-semibold text-white/65">Timeline unificada</span><span className="text-[10px] text-white/30">Pista principal y capas comparten regla, cabezal y zona de edición.</span></div></div><span className="text-[10px] text-white/30">Clic para mover el cabezal · arrastra las capas</span></div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#090b12] shadow-inner">
              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-white/[0.025] p-3">
                <button type="button" disabled={timelineDuration <= 0} onClick={() => { setPreviewMode("live"); setPlaying((current) => !current); }} className="flex h-9 min-w-24 items-center justify-center gap-2 rounded-xl bg-white text-xs font-bold text-black disabled:opacity-30">{playing ? "Ⅱ Pausa" : "▶ Play"}</button>
                <button type="button" disabled={timelineDuration <= 0} onClick={() => { setPlaying(false); setPlayheadTime(0); setPreviewMode("live"); }} className="flex h-9 items-center justify-center rounded-xl border border-white/15 px-3 text-xs disabled:opacity-30">■ Stop</button>
                <button type="button" onClick={() => setPreviewMode("live")} className={`h-9 rounded-xl border px-3 text-xs ${previewMode === "live" ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/10 text-white/50"}`}>Monitor: montaje</button>
                <div className="ml-auto font-mono text-xs tabular-nums text-white/75">{formatTimecode(playheadTime)} <span className="text-white/25">/ {formatTimecode(timelineDuration)}</span></div>
                <label className="flex items-center gap-2 text-[10px] text-white/35">Zoom<input aria-label="Zoom de timeline" type="range" min="12" max="48" step="2" value={timelineZoom} onChange={(event) => setTimelineZoom(Number(event.target.value))} className="w-24 accent-cyan-400" /></label>
              </div>

              {segments.length === 0 ? <div className="p-12 text-center text-xs text-white/35">Elige una pista principal desde la bandeja o prepara una propuesta automática.</div> : (
                <div ref={timelineScrollRef} className="overflow-x-auto">
                  <div className="relative h-[250px]" style={{ width: `${timelineCanvasWidth}px` }}>
                    <div role="slider" aria-label="Cabezal de reproducción" aria-valuemin={0} aria-valuemax={timelineDuration} aria-valuenow={playheadTime} aria-valuetext={`${playheadTime.toFixed(1)} segundos`} tabIndex={0} onKeyDown={handleTimelineKey} onPointerDown={seekTimeline} className="absolute inset-x-0 top-0 h-9 cursor-crosshair border-b border-white/10 bg-black/20">
                      {rulerTicks.map((tick) => <span key={tick} className="absolute bottom-0 top-0 border-l border-white/10" style={{ left: `${tick * timelineZoom}px` }}><span className="absolute left-1 top-1 font-mono text-[8px] text-white/30">{formatTimecode(tick)}</span></span>)}
                    </div>

                    <div onPointerDown={seekTimeline} className="absolute inset-x-0 top-9 h-[88px] cursor-crosshair border-b border-white/8 bg-purple-400/[0.025]">
                      <span className="pointer-events-none sticky left-2 top-2 z-[1] inline-flex rounded-md bg-black/70 px-2 py-1 text-[8px] uppercase tracking-wider text-purple-200">Capas</span>
                      {overlays.length === 0 && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-white/20">Añade una capa desde la bandeja; aparecerá alineada sobre la pista principal.</span>}
                      {overlays.map((overlay) => {
                        const selected = overlay.id === selectedOverlayId;
                        const overlayAsset = byId.get(overlay.assetId);
                        return <article key={overlay.id} role="button" tabIndex={0} aria-label={`${overlay.label}, de ${overlay.timelineStart.toFixed(1)} a ${(overlay.timelineStart + overlayDuration(overlay)).toFixed(1)} segundos`} onPointerDown={(event) => beginOverlayGesture(event, overlay, "move")} onClick={() => { setSelectedOverlayId(overlay.id); setSelectedSegmentId(""); setPreviewMode("live"); setPlayheadTime(overlay.timelineStart); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { setSelectedOverlayId(overlay.id); setSelectedSegmentId(""); setPreviewMode("live"); setPlayheadTime(overlay.timelineStart); } }} style={{ left: `${overlay.timelineStart * timelineZoom}px`, width: `${Math.max(44, overlayDuration(overlay) * timelineZoom)}px`, touchAction: "none" }} className={`group absolute top-2 h-[72px] cursor-grab select-none overflow-hidden rounded-lg border text-left transition active:cursor-grabbing ${selected ? "z-10 border-purple-200 shadow-[0_0_18px_rgba(216,180,254,.2)]" : "border-purple-300/25"}`}>
                          {overlayAsset && <video aria-hidden="true" muted playsInline preload="metadata" src={`/api/projects/${projectId}/media/${overlayAsset.id}/file#t=${Math.max(0.05, overlay.sourceStart)}`} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50" />}
                          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />
                          <button type="button" aria-label={`Ajustar inicio de ${overlay.label}`} title="Arrastra para ajustar el inicio" onPointerDown={(event) => beginOverlayGesture(event, overlay, "resize-start")} className="absolute inset-y-0 left-0 z-[2] w-2 cursor-ew-resize border-r border-white/25 bg-black/20 hover:bg-purple-200/35" />
                          <div className="relative z-[1] px-3 py-2"><span className="block truncate text-[10px] font-semibold">{overlay.label}</span><span className="mt-1 block text-[9px] text-white/65">{overlay.timelineStart.toFixed(1)}–{(overlay.timelineStart + overlayDuration(overlay)).toFixed(1)}s</span><span className="text-[8px] text-purple-100/70">{overlay.mode === "cover" ? "Pantalla completa" : "PIP"}</span></div>
                          <button type="button" aria-label={`Ajustar final de ${overlay.label}`} title="Arrastra para ajustar el final" onPointerDown={(event) => beginOverlayGesture(event, overlay, "resize-end")} className="absolute inset-y-0 right-0 z-[2] w-2 cursor-ew-resize border-l border-white/25 bg-black/20 hover:bg-purple-200/35" />
                        </article>;
                      })}
                    </div>

                    <div onPointerDown={seekTimeline} className="absolute inset-x-0 top-[124px] h-[126px] cursor-crosshair bg-cyan-400/[0.02]">
                      <span className="pointer-events-none sticky left-2 top-2 z-[1] inline-flex rounded-md bg-black/70 px-2 py-1 text-[8px] uppercase tracking-wider text-cyan-200">Principal</span>
                      {baseTimeline.map((item, index) => {
                        const { segment, asset: segmentAsset, start } = item;
                        const duration = segmentDuration(segment);
                        const selected = segment.id === selectedSegmentId;
                        const meta = segmentAsset ? assetMeta(segmentAsset) : ASSET_META.video;
                        return <article key={segment.id} draggable onDragStart={() => setDraggingId(segment.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropBefore(segment.id)} onClick={(event) => { event.stopPropagation(); setSelectedSegmentId(segment.id); setSelectedOverlayId(""); setPreviewMode("live"); setPlayheadTime(start); }} style={{ left: `${start * timelineZoom}px`, width: `${Math.max(44, duration * timelineZoom)}px` }} className={`group absolute top-8 h-[86px] cursor-pointer overflow-hidden rounded-lg border transition ${selected ? "border-cyan-200 shadow-[0_0_16px_rgba(34,211,238,.18)]" : segment.locked ? "border-emerald-300/25" : "border-white/15"}`}>
                          {segmentAsset && <video aria-hidden="true" muted playsInline preload="metadata" src={`/api/projects/${projectId}/media/${segmentAsset.id}/file#t=${Math.max(0.05, segment.sourceStart)}`} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-55" />}
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />
                          <div className="relative z-[1] flex h-full flex-col p-2"><div className="flex items-center gap-1"><span className={`rounded border px-1.5 py-0.5 text-[8px] ${meta.badge}`}>{meta.icon} {meta.label}</span><span className="ml-auto text-[9px]">{segment.locked ? "🔒" : "⋮⋮"}</span></div><div className="mt-auto truncate text-[10px] font-semibold">{index + 1}. {segment.label}</div><div className="flex items-end gap-1 text-[8px] text-white/55"><span>{duration.toFixed(1)}s</span><span className="ml-auto flex gap-1"><button type="button" aria-label={`Mover antes ${segment.label}`} onClick={(event) => { event.stopPropagation(); move(segment.id, -1); }} className="rounded border border-white/15 bg-black/40 px-1">←</button><button type="button" aria-label={`Mover después ${segment.label}`} onClick={(event) => { event.stopPropagation(); move(segment.id, 1); }} className="rounded border border-white/15 bg-black/40 px-1">→</button><button type="button" aria-label={`Quitar ${segment.label}`} disabled={segment.locked} onClick={(event) => { event.stopPropagation(); setSegments((current) => current.filter((candidate) => candidate.id !== segment.id)); }} className="rounded border border-red-300/15 bg-black/40 px-1 text-red-200 disabled:opacity-25">×</button></span></div></div>
                        </article>;
                      })}
                    </div>

                    <div aria-hidden="true" className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-red-400 shadow-[0_0_8px_rgba(248,113,113,.8)]" style={{ left: `${playheadTime * timelineZoom}px` }}><span className="absolute -left-1.5 top-0 h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-red-400" /></div>
                  </div>
                </div>
              )}
            </div>
            {!overlaysFit && <div className="mt-2 rounded-lg border border-red-300/20 bg-red-300/10 px-3 py-2 text-[10px] text-red-100">Una capa termina fuera de la duración final. Muévela o acórtala desde sus asas.</div>}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-400/15 text-[10px] font-bold text-amber-100">4</span><div><span className="block text-xs font-semibold text-white/65">Explora la bandeja de vídeos</span><span className="text-[10px] text-white/30">Ver recurso inspecciona un archivo; Principal y Capa lo añaden al montaje vivo.</span></div></div><span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-white/40">{filteredVideos.length} de {videos.length}</span></div>
            <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Filtrar bandeja de vídeos">
              {([
                ["all", "Todos"],
                ["principal", "Principal"],
                ["clip", "Clips"],
                ["final", "Finales"],
                ["mix", "MIX"],
              ] as Array<[VideoFilter, string]>).map(([id, label]) => {
                const count = videos.filter((asset) => id === "all"
                  || id === "mix" && asset.origin === "mix"
                  || id === "clip" && asset.kind === "clip"
                  || id === "final" && asset.kind === "final" && asset.origin !== "mix"
                  || id === "principal" && asset.origin !== "mix" && ["recording", "video", "presenter"].includes(asset.kind)).length;
                return <button key={id} type="button" onClick={() => setVideoFilter(id)} className={`rounded-lg border px-3 py-1.5 text-[10px] transition ${videoFilter === id ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : "border-white/8 text-white/40 hover:bg-white/5"}`}>{label} <span className="ml-1 opacity-55">{count}</span></button>;
              })}
            </div>
            <div className="grid max-h-[620px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVideos.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-white/12 px-5 py-10 text-center text-xs text-white/35">No hay recursos de este tipo.</div>}
              {filteredVideos.map((asset) => {
                const baseUses = segments.filter((segment) => segment.assetId === asset.id).length;
                const overlayUses = overlays.filter((overlay) => overlay.assetId === asset.id).length;
                const uses = baseUses + overlayUses;
                const meta = assetMeta(asset);
                const activePreview = previewMode === "asset" && previewAssetId === asset.id;
                return <article key={asset.id} className={`overflow-hidden rounded-2xl border bg-black/20 transition ${activePreview ? "border-cyan-300/60 shadow-[0_0_20px_rgba(34,211,238,.12)]" : "border-white/10 hover:border-white/20"}`}>
                  <button type="button" onClick={() => { setPlaying(false); setPreviewAssetId(asset.id); setPreviewMode("asset"); }} className="group relative block aspect-[16/10] w-full overflow-hidden bg-black text-left" aria-label={`Ver recurso ${asset.name}`}>
                    <video aria-hidden="true" muted playsInline preload="metadata" src={`/api/projects/${projectId}/media/${asset.id}/file#t=0.1`} className="pointer-events-none h-full w-full object-cover opacity-75 transition duration-300 group-hover:scale-[1.03] group-hover:opacity-90" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                    <span className={`absolute left-2 top-2 rounded-lg border px-2 py-1 text-[9px] font-semibold ${meta.badge}`}>{meta.icon} {meta.label}</span>
                    <span className="absolute right-2 top-2 rounded-lg bg-black/65 px-2 py-1 text-[9px] text-white/80">{asset.duration?.toFixed(1) ?? "?"}s</span>
                    <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/55 text-sm text-white shadow-lg transition group-hover:scale-110 group-hover:bg-cyan-500/70">▶</span></span>
                    <span className="absolute bottom-2 left-2 right-2 truncate text-[10px] font-medium text-white">{asset.name}</span>
                  </button>
                  <div className="p-2.5">
                    <div className="flex items-center justify-between gap-2 text-[9px]"><span className="truncate text-white/35">{asset.origin}</span><span className={asset.kind === "clip" && uses === 0 ? "text-amber-300" : uses ? "text-emerald-300" : "text-white/35"}>{uses ? `${uses} uso${uses > 1 ? "s" : ""}` : "Sin usar"}</span></div>
                    <div className="mt-2 grid grid-cols-2 gap-1"><button type="button" onClick={() => addAsset(asset)} className="rounded-lg border border-white/10 px-2 py-1.5 text-[10px] hover:bg-white/5">+ Principal</button><button type="button" disabled={visualDuration <= 0} onClick={() => addOverlay(asset)} className="rounded-lg border border-purple-300/20 bg-purple-300/5 px-2 py-1.5 text-[10px] text-purple-100 disabled:opacity-30">+ Capa</button></div>
                  </div>
                </article>;
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-pink-400/15 text-[10px] font-bold text-pink-100">5</span><div><span className="block text-xs font-semibold text-white/65">Escucha y revisa el audio</span><span className="text-[10px] text-white/30">Previsualiza la locución antes de generar y comprueba el texto exacto.</span></div></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                <label className="text-xs text-white/50">Locución<select className="input mt-1" value={voiceId} onChange={(event) => selectVoice(event.target.value)}><option value="">Audio original</option>{voices.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.duration?.toFixed(1) ?? "?"}s</option>)}</select></label>
                {selectedVoice ? <div className="mt-3"><div className="mb-1 flex items-center justify-between gap-2 text-[9px] text-white/35"><span className="truncate">{selectedVoice.name}</span><span>{selectedVoice.duration?.toFixed(1) ?? "?"}s</span></div><audio key={selectedVoice.id} controls preload="metadata" className="h-9 w-full" src={`/api/projects/${projectId}/media/${selectedVoice.id}/file`} /></div> : <p className="mt-3 text-[10px] text-white/30">Se conservará el audio original de la pista de vídeo.</p>}
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                <label className="text-xs text-white/50">Música<select className="input mt-1" value={musicId} onChange={(event) => setMusicId(event.target.value)}><option value="">Sin música</option>{music.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
                {selectedMusic ? <div className="mt-3"><audio key={selectedMusic.id} controls preload="metadata" className="h-9 w-full" src={`/api/projects/${projectId}/media/${selectedMusic.id}/file`} /><label className="mt-2 block text-[10px] text-white/45">Volumen · {Math.round(musicVolume * 100)}%<input className="mt-1 w-full accent-purple-500" type="range" min="0.02" max="0.5" step="0.01" value={musicVolume} onChange={(event) => setMusicVolume(Number(event.target.value))} /></label></div> : <p className="mt-3 text-[10px] text-white/30">Sin música de fondo.</p>}
              </div>
            </div>
            <label className="mt-3 block text-xs text-white/50">Subtítulos obligatorios<textarea className="input mt-1 min-h-28" value={subtitleText} onChange={(event) => setSubtitleText(event.target.value)} placeholder="Pega la locución exacta. Se mostrará abajo, dentro de la zona segura." /></label>
          </div>
          {message && <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">{message}</div>}
          <button onClick={renderMix} disabled={busy || !name.trim() || !segments.length || !subtitleText.trim() || !durationOk || !overlaysFit} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-3 text-sm font-bold disabled:opacity-35">{busy ? "Mezclando…" : !overlaysFit ? "Ajusta las superposiciones" : durationOk ? "MIX · Generar nueva versión" : "Ajusta las duraciones antes de MIX"}</button>
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 p-3"><div><div className="text-xs font-semibold text-white/75">Visor</div><div className="text-[10px] text-white/35">La timeline controla el montaje vivo sin generar archivos.</div></div>{previewMode === "live" ? <span className="rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-[9px] text-cyan-100">● Montaje vivo</span> : previewMode === "mix" && previewMix ? <span className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[9px] text-amber-100">◆ Resultado renderizado</span> : monitorAsset && monitorMeta ? <span className={`rounded-lg border px-2 py-1 text-[9px] ${monitorMeta.badge}`}>{monitorMeta.icon} {monitorMeta.label}</span> : null}</div>
            <div className="flex min-h-[360px] items-center justify-center bg-black/70 p-3">
              {previewMode === "live" ? (
                <div className="relative aspect-[9/16] max-h-[560px] w-full overflow-hidden rounded-xl border border-white/10 bg-[#050608]">
                  {activeBase?.asset ? <SyncedVideo key={`base-${activeBase.segment.id}`} src={`/api/projects/${projectId}/media/${activeBase.asset.id}/file`} sourceTime={activeBase.segment.sourceStart + clamp(playheadTime - activeBase.start, 0, Math.max(0, segmentDuration(activeBase.segment) - 0.04))} playing={playing} muted={Boolean(selectedVoice)} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-white/25">Añade una pista principal para ver el montaje.</div>}
                  {activeOverlays.map((overlay) => {
                    const overlayAsset = byId.get(overlay.assetId);
                    if (!overlayAsset) return null;
                    const sourceTime = overlay.sourceStart + clamp(playheadTime - overlay.timelineStart, 0, Math.max(0, overlayDuration(overlay) - 0.04));
                    return <SyncedVideo key={`layer-${overlay.id}`} src={`/api/projects/${projectId}/media/${overlayAsset.id}/file`} sourceTime={sourceTime} playing={playing} muted className={overlay.mode === "cover" ? "absolute inset-0 z-10 h-full w-full object-cover" : "absolute z-10 rounded-lg border border-white/35 bg-black object-cover shadow-2xl"} style={overlay.mode === "pip" ? pipPreviewStyle(overlay) : undefined} />;
                  })}
                  {liveSubtitle && <div className="absolute inset-x-[7%] bottom-[8%] z-30 text-center text-[clamp(10px,1.1vw,15px)] font-bold leading-tight text-white [text-shadow:0_2px_4px_#000,0_0_2px_#000]"><span className="rounded-md bg-black/65 box-decoration-clone px-2 py-1">{liveSubtitle}</span></div>}
                  <div className="absolute left-2 top-2 z-30 rounded-md bg-black/65 px-2 py-1 font-mono text-[9px] text-white/75">{formatTimecode(playheadTime)}</div>
                  {selectedVoice && <SyncedAudio src={`/api/projects/${projectId}/media/${selectedVoice.id}/file`} sourceTime={playheadTime} playing={playing} volume={1} />}
                  {selectedMusic && <SyncedAudio src={`/api/projects/${projectId}/media/${selectedMusic.id}/file`} sourceTime={playheadTime} playing={playing} volume={musicVolume} loop />}
                </div>
              ) : monitorSource ? <video key={monitorSource} controls preload="metadata" src={monitorSource} className="aspect-[9/16] max-h-[560px] w-full rounded-xl bg-black object-contain" /> : <div className="px-6 text-center text-xs text-white/30">No hay ningún recurso seleccionado.</div>}
            </div>
            <div className="border-t border-white/8 p-3">
              <div className="truncate text-xs font-medium">{previewMode === "live" ? "Montaje actual de la timeline" : previewMode === "mix" ? previewMix?.name ?? "Resultado" : monitorAsset?.name ?? "Sin selección"}</div>
              <p className="mt-1 text-[10px] leading-relaxed text-white/35">{previewMode === "live" ? "Play, Stop y el cabezal muestran inmediatamente la pista principal, las capas activas, la locución, la música y una aproximación de subtítulos." : previewMode === "mix" ? "MP4 exacto producido por FFmpeg. Revísalo antes de usarlo como final." : "Vista aislada del recurso: no representa el montaje. Vuelve a «Monitor: montaje» para ver la composición."}</p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-white/65">Versiones renderizadas</span><span className="text-[10px] text-white/30">{mixes.length} resultado{mixes.length === 1 ? "" : "s"}</span></div>
            <div className="space-y-2">
              {mixes.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-xs text-white/35">Tus versiones aparecerán aquí y podrás reproducirlas en el monitor.</div>}
              {mixes.map((mix) => {
                const active = previewMode === "mix" && previewMixId === mix.id;
                return <article key={mix.id} className={`rounded-2xl border p-3 transition ${active ? "border-amber-300/35 bg-amber-300/[0.06]" : "border-white/10 bg-black/20"}`}>
                  <div className="flex items-start gap-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/25 to-cyan-400/20 text-sm">◆</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{mix.name}</div><span className={`text-[10px] ${mix.status === "ready" ? "text-emerald-300" : mix.status === "error" ? "text-red-300" : "text-amber-200"}`}>{mix.status === "ready" ? "Listo para previsualizar" : mix.status === "error" ? "Error de render" : "Renderizando…"}</span></div></div>
                  {mix.error && <p className="mt-2 text-[11px] text-red-300">{mix.error}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">{mix.status === "ready" && <button type="button" onClick={() => { setPlaying(false); setPreviewMixId(mix.id); setPreviewMode("mix"); }} className={`rounded-lg border px-3 py-2 text-xs ${active ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : "border-white/12 hover:bg-white/5"}`}>▶ {active ? "Viendo resultado" : "Ver resultado"}</button>}{mix.status === "ready" && mix.pieceId && <button onClick={() => useAsFinal(mix)} className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold">Usar como final</button>}<button onClick={() => removeMix(mix)} className="ml-auto rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300">Eliminar</button></div>
                </article>;
              })}
            </div>
          </div>
        </aside>
      </div>
      {appDialog.dialog}
    </section>
  );
}

function SyncedVideo({
  src,
  sourceTime,
  playing,
  muted,
  className,
  style,
}: {
  src: string;
  sourceTime: number;
  playing: boolean;
  muted: boolean;
  className: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const target = clamp(sourceTime, 0, Math.max(0, video.duration - 0.03));
    if (Math.abs(video.currentTime - target) > 0.28) video.currentTime = target;
  }, [sourceTime]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [playing, src]);

  return <video ref={ref} src={src} playsInline muted={muted} preload="auto" className={className} style={style} onLoadedMetadata={(event) => { const video = event.currentTarget; video.currentTime = clamp(sourceTime, 0, Math.max(0, video.duration - 0.03)); if (playing) void video.play().catch(() => undefined); }} />;
}

function SyncedAudio({
  src,
  sourceTime,
  playing,
  volume,
  loop = false,
}: {
  src: string;
  sourceTime: number;
  playing: boolean;
  volume: number;
  loop?: boolean;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = ref.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const target = loop ? sourceTime % audio.duration : clamp(sourceTime, 0, Math.max(0, audio.duration - 0.03));
    if (Math.abs(audio.currentTime - target) > 0.28) audio.currentTime = target;
  }, [sourceTime, loop]);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.volume = clamp(volume, 0, 1);
    if (playing) void audio.play().catch(() => undefined);
    else audio.pause();
  }, [playing, src, volume]);

  return <audio ref={ref} src={src} preload="auto" loop={loop} aria-hidden="true" />;
}

function pipPreviewStyle(overlay: MixOverlay): React.CSSProperties {
  const size = `${Math.round(overlay.size * 100)}%`;
  const common: React.CSSProperties = { width: size, aspectRatio: "9 / 16" };
  if (overlay.position === "top-left") return { ...common, left: "4%", top: "4%" };
  if (overlay.position === "bottom-left") return { ...common, bottom: "10%", left: "4%" };
  if (overlay.position === "bottom-right") return { ...common, bottom: "10%", right: "4%" };
  if (overlay.position === "center") return { ...common, left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  return { ...common, right: "4%", top: "4%" };
}

function AssetBadge({ asset }: { asset: Pick<StudioAsset, "kind" | "origin"> }) {
  const meta = assetMeta(asset);
  return <span className={`shrink-0 rounded-lg border px-2 py-1 text-[9px] font-semibold ${meta.badge}`}>{meta.icon} {meta.label}</span>;
}
