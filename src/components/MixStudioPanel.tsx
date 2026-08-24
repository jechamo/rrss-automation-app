"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MixOverlay, MixRecipe, MixSegment } from "@/core/media/mix-contracts";
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

type MixDto = {
  id: string;
  pieceId: string | null;
  name: string;
  status: "draft" | "rendering" | "ready" | "error" | string;
  recipe: MixRecipe;
  outputPath: string | null;
  error: string | null;
  isFinal: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProjectPick = { id: string; name: string };
type PreviewMode = "live" | "asset" | "mix";
type LibraryTab = "app" | "layers";
type LayerFilter = "all" | "clip" | "presenter" | "upload";
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type BaseTimelineItem = {
  segment: MixSegment;
  asset: StudioAsset | null;
  start: number;
  end: number;
};

type OverlayGesture = {
  overlayId: string;
  mode: "move" | "resize-start" | "resize-end";
  clientX: number;
  pixelsPerSecond: number;
  initial: MixOverlay;
  assetDuration: number;
};

type DraftPayload = {
  name: string;
  pieceId: string;
  recipe: MixRecipe;
};

type MixStudioPanelProps = {
  projectId: string;
  projectName: string;
  hasLogo: boolean;
  assets: StudioAsset[];
  onMediaChanged: () => Promise<void>;
  onUpload: () => void;
  onRecord: () => void;
  onManageMedia: () => void;
};

const VIDEO_KINDS = ["recording", "video", "clip", "presenter"];
const MIN_SEGMENT_SECONDS = 0.25;
const BRAND_OUTRO_SECONDS = 3;
const DRAG_ASSET = "application/x-rrss-media-asset";
const DRAG_SEGMENT = "application/x-rrss-mix-segment";

const ASSET_META: Record<string, { label: string; icon: string; badge: string }> = {
  recording: { label: "Navegación", icon: "▣", badge: "border-emerald-300/25 bg-emerald-300/15 text-emerald-100" },
  clip: { label: "Clip IA", icon: "✦", badge: "border-purple-300/25 bg-purple-300/15 text-purple-100" },
  presenter: { label: "Presentador", icon: "◉", badge: "border-pink-300/25 bg-pink-300/15 text-pink-100" },
  video: { label: "Vídeo", icon: "▶", badge: "border-cyan-300/25 bg-cyan-300/15 text-cyan-100" },
};

const roundTenth = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function assetMeta(asset: Pick<StudioAsset, "kind" | "origin">) {
  if (asset.kind === "recording" && asset.origin === "playwright") return { ...ASSET_META.recording, label: "Playwright" };
  if (asset.kind === "recording" && asset.origin === "recorder") return { ...ASSET_META.recording, label: "Grabación manual" };
  return ASSET_META[asset.kind] ?? ASSET_META.video;
}

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
    mode: "pip",
    position: "top-right",
    size: 0.36,
  };
}

function recordingSegments(asset: StudioAsset): MixSegment[] {
  const markers = asset.metadata?.markers ?? [];
  if (!markers.length) return [newSegment(asset, true)];
  return markers.map((marker) => ({
    id: `${asset.id}-${marker.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    assetId: asset.id,
    sourceStart: marker.start,
    sourceEnd: marker.end,
    label: marker.label,
    kind: asset.kind,
    locked: marker.protected,
  }));
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

function signatureFor(payload: DraftPayload): string {
  return JSON.stringify(payload);
}

function draftPayloadFromMix(mix: MixDto): DraftPayload {
  return {
    name: mix.name,
    pieceId: mix.pieceId ?? "",
    recipe: mix.recipe,
  };
}

export function MixStudioPanel({
  projectId,
  projectName,
  hasLogo,
  assets,
  onMediaChanged,
  onUpload,
  onRecord,
  onManageMedia,
}: MixStudioPanelProps) {
  const [pieces, setPieces] = useState<PiecePick[]>([]);
  const [mixes, setMixes] = useState<MixDto[]>([]);
  const [projects, setProjects] = useState<ProjectPick[]>([]);
  const [name, setName] = useState("Nuevo borrador");
  const [pieceId, setPieceId] = useState("");
  const [segments, setSegments] = useState<MixSegment[]>([]);
  const [overlays, setOverlays] = useState<MixOverlay[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [musicId, setMusicId] = useState("");
  const [subtitleText, setSubtitleText] = useState("");
  const [musicVolume, setMusicVolume] = useState(0.12);
  const [includeBrandOutro, setIncludeBrandOutro] = useState(hasLogo);
  const [draftId, setDraftId] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveRevision, setSaveRevision] = useState(0);
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [selectedOverlayId, setSelectedOverlayId] = useState("");
  const [previewAssetId, setPreviewAssetId] = useState("");
  const [previewMixId, setPreviewMixId] = useState("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("live");
  const [playheadTime, setPlayheadTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(26);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("app");
  const [layerFilter, setLayerFilter] = useState<LayerFilter>("all");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [overlayGesture, setOverlayGesture] = useState<OverlayGesture | null>(null);
  const appDialog = useAppDialog();

  const initializedRef = useRef(false);
  const lastSavedSignatureRef = useRef("");
  const latestDraftRef = useRef<{ payload: DraftPayload; signature: string; hasContent: boolean } | null>(null);
  const draftIdRef = useRef("");
  const saveTimerRef = useRef<number | null>(null);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  const sourceVideos = useMemo(
    () => assets.filter((asset) => VIDEO_KINDS.includes(asset.kind) && asset.origin !== "mix"),
    [assets],
  );
  const appVideos = useMemo(() => sourceVideos.filter((asset) => asset.kind === "recording"), [sourceVideos]);
  const layerVideos = useMemo(() => sourceVideos.filter((asset) => asset.kind !== "recording"), [sourceVideos]);
  const visibleLayerVideos = useMemo(() => layerVideos.filter((asset) => {
    if (layerFilter === "all") return true;
    if (layerFilter === "clip") return asset.kind === "clip";
    if (layerFilter === "presenter") return asset.kind === "presenter";
    return asset.origin === "upload";
  }), [layerFilter, layerVideos]);
  const visibleLibrary = libraryTab === "app" ? appVideos : visibleLayerVideos;
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

  const visualDuration = segments.reduce((sum, segment) => sum + segmentDuration(segment), 0);
  const voiceDuration = selectedVoice?.duration ?? null;
  const contentDuration = voiceDuration ?? visualDuration;
  const outroEnabled = includeBrandOutro && hasLogo;
  const timelineDuration = contentDuration + (outroEnabled ? BRAND_OUTRO_SECONDS : 0);
  const durationDelta = voiceDuration === null ? 0 : voiceDuration - visualDuration;
  const layeredTail = overlays.length > 0 && durationDelta > 0.25;
  const durationOk = voiceDuration === null || Math.abs(durationDelta) <= 0.25 || layeredTail;
  const overlaysFit = overlays.every(
    (overlay) => overlay.timelineStart + overlayDuration(overlay) <= contentDuration + 0.01,
  );

  const baseTimeline = useMemo(() => {
    let cursor = 0;
    return segments.map((segment): BaseTimelineItem => {
      const start = cursor;
      cursor += segmentDuration(segment);
      return { segment, asset: byId.get(segment.assetId) ?? null, start, end: cursor };
    });
  }, [segments, byId]);
  const activeBase = baseTimeline.find((item) => playheadTime >= item.start && playheadTime < item.end)
    ?? (playheadTime >= visualDuration - 0.01 && playheadTime < contentDuration
      ? baseTimeline.at(-1) ?? null
      : null);
  const activeOverlays = overlays.filter((overlay) => (
    playheadTime >= overlay.timelineStart
    && playheadTime < overlay.timelineStart + overlayDuration(overlay)
    && playheadTime < contentDuration
  ));
  const inBrandOutro = outroEnabled && playheadTime >= contentDuration;
  const timelineCanvasWidth = Math.max(820, timelineDuration * timelineZoom);
  const rulerStep = timelineZoom >= 38 ? 2 : timelineZoom >= 22 ? 5 : 10;
  const rulerTicks = Array.from(
    { length: Math.max(1, Math.floor(timelineDuration / rulerStep) + 1) },
    (_, index) => index * rulerStep,
  );
  const subtitleChunks = useMemo(
    () => (subtitleText.match(/[^.!?]+[.!?]?/g) ?? []).map((part) => part.trim()).filter(Boolean),
    [subtitleText],
  );
  const liveSubtitle = !inBrandOutro && subtitleChunks.length > 0
    ? subtitleChunks[Math.min(
        subtitleChunks.length - 1,
        Math.floor((playheadTime / Math.max(0.01, contentDuration)) * subtitleChunks.length),
      )]
    : "";

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

  const recipe = useMemo<MixRecipe>(() => ({
    version: 2,
    videoAssetIds: [],
    segments,
    overlays,
    voiceAssetId: voiceId,
    musicAssetId: musicId,
    subtitleText,
    musicVolume,
    includeBrandOutro,
  }), [includeBrandOutro, musicId, musicVolume, overlays, segments, subtitleText, voiceId]);
  const draftPayload = useMemo<DraftPayload>(() => ({
    name: name.trim() || "Borrador sin nombre",
    pieceId,
    recipe,
  }), [name, pieceId, recipe]);
  const draftSignature = useMemo(() => signatureFor(draftPayload), [draftPayload]);
  const hasDraftContent = segments.length > 0
    || overlays.length > 0
    || Boolean(pieceId || voiceId || musicId || subtitleText.trim())
    || name.trim() !== "Nuevo borrador";
  const draftDirty = initializedRef.current && draftSignature !== lastSavedSignatureRef.current;
  latestDraftRef.current = { payload: draftPayload, signature: draftSignature, hasContent: hasDraftContent };
  draftIdRef.current = draftId;

  const applyDraft = useCallback((draft: MixDto) => {
    setName(draft.name);
    setPieceId(draft.pieceId ?? "");
    setSegments(draft.recipe.segments);
    setOverlays(draft.recipe.overlays);
    setVoiceId(draft.recipe.voiceAssetId);
    setMusicId(draft.recipe.musicAssetId);
    setSubtitleText(draft.recipe.subtitleText);
    setMusicVolume(draft.recipe.musicVolume);
    setIncludeBrandOutro(draft.recipe.includeBrandOutro);
    setDraftId(draft.id);
    draftIdRef.current = draft.id;
    lastSavedSignatureRef.current = signatureFor(draftPayloadFromMix(draft));
    initializedRef.current = true;
    setSaveState("saved");
    setSelectedSegmentId(draft.recipe.segments[0]?.id ?? "");
    setSelectedOverlayId("");
    setPlayheadTime(0);
    setPlaying(false);
    setPreviewMode("live");
    setMessage(`Borrador «${draft.name}» recuperado.`);
  }, []);

  const load = useCallback(async () => {
    const [pieceResponse, mixResponse, projectResponse] = await Promise.all([
      fetch(`/api/content/${projectId}`, { cache: "no-store" }),
      fetch(`/api/projects/${projectId}/mixes`, { cache: "no-store" }),
      fetch("/api/projects", { cache: "no-store" }),
    ]);
    const pieceData = pieceResponse.ok
      ? await pieceResponse.json() as { pieces?: PiecePick[] }
      : {};
    const mixData = mixResponse.ok
      ? await mixResponse.json() as { mixes?: MixDto[] }
      : {};
    const projectData = projectResponse.ok
      ? await projectResponse.json() as { projects?: ProjectPick[] }
      : {};
    const nextMixes = mixData.mixes ?? [];
    setPieces(pieceData.pieces ?? []);
    setMixes(nextMixes);
    setProjects((projectData.projects ?? []).map((project) => ({ id: project.id, name: project.name })));
    if (!initializedRef.current) {
      const latestDraft = nextMixes.find((mix) => mix.status === "draft");
      if (latestDraft) {
        applyDraft(latestDraft);
      } else {
        lastSavedSignatureRef.current = signatureFor({
          name: "Nuevo borrador",
          pieceId: "",
          recipe: {
            version: 2,
            videoAssetIds: [],
            segments: [],
            overlays: [],
            voiceAssetId: "",
            musicAssetId: "",
            subtitleText: "",
            musicVolume: 0.12,
            includeBrandOutro: hasLogo,
          },
        });
        initializedRef.current = true;
        setSaveState("idle");
      }
    }
  }, [applyDraft, hasLogo, projectId]);

  useEffect(() => { void load(); }, [load]);

  const persistDraft = useCallback(async (payload: DraftPayload, signature: string): Promise<boolean> => {
    if (savePromiseRef.current) return savePromiseRef.current;
    const promise = (async () => {
      setSaveState("saving");
      const currentDraftId = draftIdRef.current;
      const response = await fetch(
        currentDraftId
          ? `/api/projects/${projectId}/mixes/${currentDraftId}`
          : `/api/projects/${projectId}/mixes/draft`,
        {
          method: currentDraftId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json().catch(() => ({})) as { mix?: MixDto; error?: string };
      if (!response.ok || !data.mix) {
        setSaveState("error");
        setMessage(data.error || "No se pudo guardar el borrador.");
        return false;
      }
      if (!currentDraftId) {
        setDraftId(data.mix.id);
        draftIdRef.current = data.mix.id;
      }
      lastSavedSignatureRef.current = signature;
      setSaveState("saved");
      setMixes((current) => {
        const exists = current.some((mix) => mix.id === data.mix!.id);
        return exists
          ? current.map((mix) => mix.id === data.mix!.id ? data.mix! : mix)
          : [data.mix!, ...current];
      });
      return true;
    })();
    savePromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      savePromiseRef.current = null;
      setSaveRevision((current) => current + 1);
    }
  }, [projectId]);

  const saveDraftNow = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const latest = latestDraftRef.current;
    if (!latest?.hasContent || latest.signature === lastSavedSignatureRef.current) return true;
    if (savePromiseRef.current) {
      const previous = await savePromiseRef.current;
      if (!previous) return false;
      const refreshed = latestDraftRef.current;
      if (!refreshed || refreshed.signature === lastSavedSignatureRef.current) return true;
      return persistDraft(refreshed.payload, refreshed.signature);
    }
    return persistDraft(latest.payload, latest.signature);
  }, [persistDraft]);

  useEffect(() => {
    if (!initializedRef.current || !hasDraftContent || !draftDirty || saveState === "saving") return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    setSaveState("dirty");
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      const latest = latestDraftRef.current;
      if (latest) void persistDraft(latest.payload, latest.signature);
    }, 850);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [draftDirty, draftSignature, hasDraftContent, persistDraft, saveRevision, saveState]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!draftDirty && saveState !== "saving") return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [draftDirty, saveState]);

  useEffect(() => {
    if (!overlayGesture || contentDuration <= 0) return;
    const onPointerMove = (event: PointerEvent) => {
      const delta = (event.clientX - overlayGesture.clientX) / overlayGesture.pixelsPerSecond;
      const initial = overlayGesture.initial;
      const duration = overlayDuration(initial);
      setOverlays((current) => current.map((overlay) => {
        if (overlay.id !== overlayGesture.overlayId) return overlay;
        if (overlayGesture.mode === "move") {
          return {
            ...overlay,
            timelineStart: roundTenth(clamp(initial.timelineStart + delta, 0, Math.max(0, contentDuration - duration))),
          };
        }
        if (overlayGesture.mode === "resize-start") {
          const adjusted = clamp(delta, Math.max(-initial.sourceStart, -initial.timelineStart), duration - MIN_SEGMENT_SECONDS);
          return {
            ...overlay,
            timelineStart: roundTenth(initial.timelineStart + adjusted),
            sourceStart: roundTenth(initial.sourceStart + adjusted),
          };
        }
        const maxGrowth = Math.min(
          overlayGesture.assetDuration - initial.sourceEnd,
          contentDuration - initial.timelineStart - duration,
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
  }, [contentDuration, overlayGesture]);

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
    // El reloj se captura al pulsar play; los frames no reinician este efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, timelineDuration]);

  useEffect(() => {
    if (!playing) return;
    const viewport = timelineScrollRef.current;
    if (!viewport) return;
    const playheadX = 140 + playheadTime * timelineZoom;
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

  function narrationForVoice(voice: StudioAsset | undefined | null): string {
    if (!voice) return "";
    return pieces.find((piece) => (
      piece.id === voice.pieceId || piece.assets?.audioPath === voice.path
    ))?.content?.guion?.locucion?.trim() ?? "";
  }

  function selectVoice(nextVoiceId: string) {
    setVoiceId(nextVoiceId);
    if (!nextVoiceId) return;
    const narration = narrationForVoice(byId.get(nextVoiceId));
    if (narration) {
      setSubtitleText(narration);
      setMessage("Subtítulos recuperados automáticamente de la locución.");
    } else {
      setMessage("Esta locución no tiene guion asociado; se conserva el texto actual.");
    }
  }

  function applyPieceNarration(piece: PiecePick | undefined, pieceVoice: StudioAsset | undefined) {
    if (pieceVoice) {
      setVoiceId(pieceVoice.id);
      const narration = narrationForVoice(pieceVoice);
      if (narration) setSubtitleText(narration);
      return;
    }
    if (pieceId) {
      setVoiceId("");
      setSubtitleText(piece?.content?.guion?.locucion?.trim() ?? "");
    }
  }

  function addAssetAt(asset: StudioAsset, atTime = visualDuration) {
    const additions = asset.kind === "recording" ? recordingSegments(asset) : [newSegment(asset)];
    const targetIndex = baseTimeline.findIndex((item) => atTime < item.start + (item.end - item.start) / 2);
    setSegments((current) => {
      const next = [...current];
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, ...additions);
      return next;
    });
    setSelectedSegmentId(additions[0]?.id ?? "");
    setSelectedOverlayId("");
    setPreviewMode("live");
    setPlayheadTime(Math.min(atTime, Math.max(0, timelineDuration)));
  }

  function addOverlayAt(asset: StudioAsset, atTime = Math.min(playheadTime, contentDuration)) {
    const overlay = newOverlay(asset, atTime);
    overlay.timelineStart = roundTenth(clamp(atTime, 0, Math.max(0, contentDuration - overlayDuration(overlay))));
    setOverlays((current) => [...current, overlay]);
    setSelectedOverlayId(overlay.id);
    setSelectedSegmentId("");
    setPreviewMode("live");
    setPlayheadTime(overlay.timelineStart);
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

  function prepareSequential() {
    const piece = pieces.find((item) => item.id === pieceId);
    const pieceVoice = (voiceId ? byId.get(voiceId) : undefined)
      ?? voices.find((asset) => asset.pieceId === pieceId || asset.path === piece?.assets?.audioPath);
    if (segments.length || overlays.length) {
      const layerSegments = [...overlays].sort((left, right) => left.timelineStart - right.timelineStart).map(segmentFromOverlay);
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
        ? `Secuencial aplicado: ${fitted.segments.length} bloque(s) en Principal.`
        : "La selección ya estaba en modo secuencial.");
      return;
    }
    if (!pieceId) {
      setMessage("Añade recursos o elige una pieza destino antes de preparar una propuesta.");
      return;
    }
    const linkedPaths = new Set([
      piece?.assets?.recordingPath,
      piece?.assets?.presenterPath,
      piece?.assets?.videoPath,
      ...(piece?.assets?.clips ?? []),
    ].filter((value): value is string => Boolean(value)));
    const pieceAssets = sourceVideos.filter((asset) => asset.pieceId === pieceId || linkedPaths.has(asset.path));
    const recordings = pieceAssets.filter((asset) => asset.kind === "recording").flatMap(recordingSegments);
    const clips = pieceAssets.filter((asset) => asset.kind === "clip");
    const other = pieceAssets.filter((asset) => !["recording", "clip"].includes(asset.kind));
    const ordered: Array<StudioAsset | MixSegment> = [];
    const max = Math.max(recordings.length, clips.length);
    for (let index = 0; index < max; index += 1) {
      if (clips[index]) ordered.push(clips[index]);
      if (recordings[index]) ordered.push(recordings[index]);
    }
    if (!ordered.length) ordered.push(...other);
    const proposed = ordered.map((item) => "assetId" in item ? item : newSegment(item, item.kind === "recording"));
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
    setMessage(fitted.segments.length ? "Propuesta secuencial preparada." : "La pieza no tiene vídeos compatibles.");
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
        ? `Capas aplicadas: ${base.length} bloque(s) principales y ${overlays.length + converted.length} capa(s).`
        : "La selección ya estaba organizada en capas.");
      return;
    }
    if (!pieceId) {
      setMessage("Añade un vídeo principal o elige una pieza destino.");
      return;
    }
    const linkedPaths = new Set([
      piece?.assets?.recordingPath,
      piece?.assets?.presenterPath,
      ...(piece?.assets?.clips ?? []),
    ].filter((value): value is string => Boolean(value)));
    const pieceAssets = sourceVideos.filter((asset) => asset.pieceId === pieceId || linkedPaths.has(asset.path));
    const base = pieceAssets.filter((asset) => asset.kind === "recording").flatMap(recordingSegments);
    if (!base.length) {
      setMessage("Esta pieza no tiene una grabación manual o Playwright para usar como Principal.");
      return;
    }
    const baseDuration = base.reduce((sum, segment) => sum + segmentDuration(segment), 0);
    const targetDuration = pieceVoice?.duration ?? baseDuration;
    const upperAssets = pieceAssets.filter((asset) => ["clip", "video", "presenter"].includes(asset.kind));
    const proposedOverlays = upperAssets.map((asset, index) => {
      const overlay = newOverlay(asset);
      overlay.sourceEnd = Math.min(overlay.sourceEnd, overlay.sourceStart + targetDuration);
      const centered = ((index + 1) * targetDuration) / (upperAssets.length + 1) - overlayDuration(overlay) / 2;
      overlay.timelineStart = roundTenth(Math.max(0, Math.min(centered, targetDuration - overlayDuration(overlay))));
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
    setMessage("Propuesta en capas preparada.");
  }

  function harmonize() {
    if (voiceDuration === null) return;
    const result = fitTimelineToTarget(segments, voiceDuration, byId);
    setSegments(result.segments);
    setMessage(Math.abs(result.remaining) <= 0.25
      ? "Timeline ajustada a la locución sin tocar momentos protegidos."
      : `Quedan ${Math.abs(result.remaining).toFixed(2)}s por ajustar.`);
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
      next.timelineStart = Math.min(Math.max(0, contentDuration - overlayDuration(next)), Math.max(0, next.timelineStart));
      next.size = Math.min(0.8, Math.max(0.2, next.size));
      return next;
    }));
  }

  function moveSegment(id: string, direction: -1 | 1) {
    setSegments((current) => {
      const index = current.findIndex((segment) => segment.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function moveOverlay(id: string, direction: -1 | 1) {
    setOverlays((current) => {
      const index = current.findIndex((overlay) => overlay.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function seekFromPointer(event: React.PointerEvent<HTMLElement>) {
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

  function dragLibraryAsset(event: React.DragEvent, asset: StudioAsset) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(DRAG_ASSET, asset.id);
  }

  function dropOnPrincipal(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    const assetId = event.dataTransfer.getData(DRAG_ASSET);
    const segmentId = event.dataTransfer.getData(DRAG_SEGMENT);
    const rect = event.currentTarget.getBoundingClientRect();
    const atTime = clamp((event.clientX - rect.left) / timelineZoom, 0, visualDuration);
    if (assetId) {
      const asset = byId.get(assetId);
      if (asset) addAssetAt(asset, atTime);
      return;
    }
    if (segmentId) {
      setSegments((current) => {
        const dragged = current.find((segment) => segment.id === segmentId);
        if (!dragged) return current;
        const remaining = current.filter((segment) => segment.id !== segmentId);
        let cursor = 0;
        let targetIndex = remaining.length;
        for (let index = 0; index < remaining.length; index += 1) {
          const midpoint = cursor + segmentDuration(remaining[index]) / 2;
          if (atTime < midpoint) {
            targetIndex = index;
            break;
          }
          cursor += segmentDuration(remaining[index]);
        }
        const next = [...remaining];
        next.splice(targetIndex, 0, dragged);
        return next;
      });
    }
  }

  function dropOnLayer(event: React.DragEvent<HTMLElement>, suggestedTime?: number) {
    event.preventDefault();
    const asset = byId.get(event.dataTransfer.getData(DRAG_ASSET));
    if (!asset) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const atTime = suggestedTime ?? clamp((event.clientX - rect.left) / timelineZoom, 0, contentDuration);
    addOverlayAt(asset, atTime);
  }

  async function changeProject(nextProjectId: string) {
    if (!nextProjectId || nextProjectId === projectId) return;
    if (hasDraftContent) {
      const confirmed = await appDialog.confirm({
        title: "Guardar borrador y cambiar",
        message: "La timeline actual se guardará como borrador antes de abrir el otro proyecto.",
        confirmLabel: "Guardar y cambiar",
      });
      if (!confirmed) return;
      if (!await saveDraftNow()) {
        await appDialog.alert({
          title: "No se pudo cambiar de proyecto",
          message: "El borrador no se ha guardado. Revisa el error antes de salir.",
        });
        return;
      }
    }
    window.location.assign(`/proyecto/${nextProjectId}/estudio`);
  }

  async function openDraft(draft: MixDto) {
    if (draft.id === draftId) {
      setVersionsOpen(false);
      return;
    }
    if (!await saveDraftNow()) return;
    applyDraft(draft);
    setVersionsOpen(false);
  }

  function resetEditorToBlank() {
    setName("Nuevo borrador");
    setPieceId("");
    setSegments([]);
    setOverlays([]);
    setVoiceId("");
    setMusicId("");
    setSubtitleText("");
    setMusicVolume(0.12);
    setIncludeBrandOutro(hasLogo);
    setDraftId("");
    draftIdRef.current = "";
    const blankPayload: DraftPayload = {
      name: "Nuevo borrador",
      pieceId: "",
      recipe: {
        version: 2,
        videoAssetIds: [],
        segments: [],
        overlays: [],
        voiceAssetId: "",
        musicAssetId: "",
        subtitleText: "",
        musicVolume: 0.12,
        includeBrandOutro: hasLogo,
      },
    };
    lastSavedSignatureRef.current = signatureFor(blankPayload);
    setSaveState("idle");
    setSelectedSegmentId("");
    setSelectedOverlayId("");
    setPlayheadTime(0);
    setPreviewMode("live");
    setVersionsOpen(false);
  }

  async function createNewDraft() {
    if (!await saveDraftNow()) return;
    resetEditorToBlank();
  }

  async function renderMix() {
    setMessage("");
    if (!await saveDraftNow()) return;
    setBusy(true);
    const response = await fetch(`/api/projects/${projectId}/mixes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        pieceId,
        recipe,
      }),
    });
    const data = await response.json().catch(() => ({})) as { error?: string; mix?: MixDto };
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error || "No se pudo generar la versión.");
      await load();
      return;
    }
    setMessage("Versión generada. El borrador se conserva para seguir editando.");
    await Promise.all([load(), onMediaChanged()]);
    setVersionsOpen(true);
  }

  async function markAsFinal(mix: MixDto) {
    if (!await appDialog.confirm({
      title: "Usar como vídeo final",
      message: `«${mix.name}» sustituirá el final actual de la pieza. La versión seguirá conservada.`,
      confirmLabel: "Usar como final",
    })) return;
    const response = await fetch(`/api/projects/${projectId}/mixes/${mix.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ useAsFinal: true }),
    });
    const data = await response.json().catch(() => ({})) as { error?: string };
    setMessage(response.ok ? "Versión seleccionada como vídeo final." : data.error || "No se pudo aplicar.");
    if (response.ok) await load();
  }

  async function removeMix(mix: MixDto) {
    if (!await appDialog.confirm({
      title: mix.status === "draft" ? "Eliminar borrador" : "Eliminar versión",
      message: `Se eliminará «${mix.name}». Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      tone: "danger",
    })) return;
    const response = await fetch(`/api/projects/${projectId}/mixes/${mix.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setMessage(data.error || "No se pudo eliminar.");
      return;
    }
    if (mix.id === draftId) resetEditorToBlank();
    await Promise.all([load(), onMediaChanged()]);
  }

  const previewAssetForMonitor = previewAsset ?? selectedOverlayAsset ?? selectedAsset ?? sourceVideos[0] ?? null;
  const monitorSource = previewMode === "mix" && previewMix
    ? `/api/projects/${projectId}/mixes/${previewMix.id}/file`
    : previewMode === "asset" && previewAssetForMonitor
      ? `/api/projects/${projectId}/media/${previewAssetForMonitor.id}/file`
      : "";
  const saveLabel = saveState === "saving" ? "Guardando…"
    : saveState === "saved" ? "Borrador guardado"
      : saveState === "error" ? "Error al guardar"
        : saveState === "dirty" ? "Cambios pendientes"
          : "Borrador nuevo";
  const saveTone = saveState === "error" ? "text-red-200 border-red-300/20 bg-red-300/8"
    : saveState === "saved" ? "text-emerald-200 border-emerald-300/20 bg-emerald-300/8"
      : "text-amber-100 border-amber-300/15 bg-amber-300/5";
  const renderDisabled = busy
    || !name.trim()
    || !segments.length
    || !subtitleText.trim()
    || !durationOk
    || !overlaysFit;

  return (
    <section className="h-full min-h-0 overflow-hidden rounded-3xl border border-white/10 bg-[#090a10] shadow-2xl">
      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-white/10 bg-[#0b0912] lg:border-b-0 lg:border-r">
          <div className="border-b border-white/10 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold">Biblioteca de vídeos</h2>
                <p className="mt-0.5 text-[10px] text-white/35">Arrastra un recurso a su pista.</p>
              </div>
              <span className="rounded-full bg-white/5 px-2 py-1 text-[9px] text-white/40">{sourceVideos.length}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={onUpload} className="rounded-lg border border-white/10 px-2 py-2 text-[10px] text-white/65 hover:bg-white/5">＋ Subir</button>
              <button type="button" onClick={onRecord} className="rounded-lg border border-red-300/20 bg-red-500/10 px-2 py-2 text-[10px] text-red-100">● REC</button>
            </div>
          </div>

          <div className="grid grid-cols-2 border-b border-white/10 px-3 pt-3">
            <button type="button" onClick={() => setLibraryTab("app")} className={`rounded-t-xl border px-2 py-2 text-[11px] ${libraryTab === "app" ? "border-emerald-300/25 border-b-[#0b0912] bg-emerald-300/8 text-emerald-200" : "border-transparent text-white/40"}`}>Pistas app <span className="opacity-55">{appVideos.length}</span></button>
            <button type="button" onClick={() => setLibraryTab("layers")} className={`rounded-t-xl border px-2 py-2 text-[11px] ${libraryTab === "layers" ? "border-purple-300/25 border-b-[#0b0912] bg-purple-300/8 text-purple-200" : "border-transparent text-white/40"}`}>Capas <span className="opacity-55">{layerVideos.length}</span></button>
          </div>

          {libraryTab === "layers" && (
            <div className="flex flex-wrap gap-1 border-b border-white/8 p-2">
              {([
                ["all", "Todos"],
                ["clip", "Clips IA"],
                ["presenter", "Presentador"],
                ["upload", "Subidos"],
              ] as Array<[LayerFilter, string]>).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setLayerFilter(id)} className={`rounded-md px-2 py-1 text-[9px] ${layerFilter === id ? "bg-purple-300/12 text-purple-100" : "text-white/35 hover:bg-white/5"}`}>{label}</button>
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 modern-scrollbar">
            {visibleLibrary.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/12 px-4 py-10 text-center text-[11px] text-white/30">
                No hay recursos en esta categoría.
              </div>
            )}
            {visibleLibrary.map((asset) => {
              const meta = assetMeta(asset);
              return (
                <article
                  key={asset.id}
                  draggable
                  onDragStart={(event) => dragLibraryAsset(event, asset)}
                  className="group overflow-hidden rounded-xl border border-white/10 bg-black/30 transition hover:border-white/20"
                >
                  <button type="button" onClick={() => { setPlaying(false); setPreviewAssetId(asset.id); setPreviewMode("asset"); }} className="relative block aspect-[16/8] w-full overflow-hidden bg-black text-left">
                    <video aria-hidden="true" muted playsInline preload="metadata" src={`/api/projects/${projectId}/media/${asset.id}/file#t=0.1`} className="pointer-events-none h-full w-full object-cover opacity-60 transition group-hover:scale-[1.03] group-hover:opacity-80" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
                    <span className={`absolute left-2 top-2 rounded-md border px-1.5 py-0.5 text-[8px] ${meta.badge}`}>{meta.icon} {meta.label}</span>
                    <span className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[8px]">{asset.duration?.toFixed(1) ?? "?"}s</span>
                    <span className="absolute inset-0 flex items-center justify-center text-white/70 opacity-0 transition group-hover:opacity-100">▶</span>
                  </button>
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium" title={asset.name}>{asset.name}</span>
                    <span title="Arrastra a la timeline" className="cursor-grab text-sm text-white/30 group-hover:text-white/60">⠿</span>
                  </div>
                  <div className="grid grid-cols-2 gap-px border-t border-white/8 bg-white/8">
                    <button type="button" onClick={() => addAssetAt(asset)} className="bg-[#0b0c12] px-2 py-1.5 text-[9px] text-white/45 hover:text-cyan-100">＋ Principal</button>
                    <button type="button" disabled={contentDuration <= 0} onClick={() => addOverlayAt(asset)} className="bg-[#0b0c12] px-2 py-1.5 text-[9px] text-white/45 hover:text-purple-100 disabled:opacity-25">＋ Capa</button>
                  </div>
                </article>
              );
            })}
          </div>
          <button type="button" onClick={onManageMedia} className="m-3 mt-0 rounded-xl border border-white/10 px-3 py-2.5 text-[10px] text-white/50 hover:bg-white/5 hover:text-white/75">Gestionar mediateca</button>
        </aside>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto_minmax(235px,.72fr)]">
          <header className="flex flex-wrap items-end gap-3 border-b border-white/10 bg-white/[0.015] px-4 py-3">
            <label className="min-w-40 text-[9px] uppercase tracking-wider text-white/30">
              Proyecto
              <select aria-label="Proyecto" value={projectId} onChange={(event) => void changeProject(event.target.value)} className="input mt-1 h-9 py-1 text-xs">
                {projects.length === 0 && <option value={projectId}>{projectName}</option>}
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label className="min-w-48 flex-1 text-[9px] uppercase tracking-wider text-white/30">
              Nombre del borrador
              <input value={name} onChange={(event) => setName(event.target.value)} className="input mt-1 h-9 py-1 text-xs font-semibold" />
            </label>
            <label className="min-w-48 flex-1 text-[9px] uppercase tracking-wider text-white/30">
              Pieza destino
              <select aria-label="Pieza destino" value={pieceId} onChange={(event) => setPieceId(event.target.value)} className="input mt-1 h-9 py-1 text-xs">
                <option value="">Solo proyecto</option>
                {pieces.map((piece) => <option key={piece.id} value={piece.id}>{piece.titulo || "Sin título"} · {piece.origin}</option>)}
              </select>
            </label>
            <span className={`mb-0.5 rounded-lg border px-2.5 py-2 text-[9px] ${saveTone}`}>{saveLabel}</span>
            <button type="button" onClick={() => setVersionsOpen(true)} className="mb-0.5 rounded-xl border border-amber-300/20 bg-amber-300/8 px-3 py-2 text-[10px] font-semibold text-amber-100">◆ Versiones {mixes.length}</button>
            <button type="button" onClick={() => void renderMix()} disabled={renderDisabled} className="mb-0.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-2 text-[11px] font-bold shadow-lg shadow-purple-900/20 disabled:opacity-30">{busy ? "Generando…" : "Generar versión"}</button>
          </header>

          <div className="grid min-h-0 gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/35">
              <header className="flex items-center justify-between border-b border-white/8 px-3 py-2">
                <div><h3 className="text-xs font-semibold">Visor</h3><p className="text-[9px] text-white/30">El montaje responde a la timeline en tiempo real.</p></div>
                <div className="flex items-center gap-2">
                  {previewMode !== "live" && <button type="button" onClick={() => setPreviewMode("live")} className="rounded-md border border-white/10 px-2 py-1 text-[9px] text-white/50">Volver al montaje</button>}
                  <span className={`rounded-md border px-2 py-1 text-[8px] ${previewMode === "live" ? "border-cyan-300/20 bg-cyan-300/8 text-cyan-100" : previewMode === "mix" ? "border-amber-300/20 bg-amber-300/8 text-amber-100" : "border-white/10 text-white/45"}`}>
                    {previewMode === "live" ? "● Montaje vivo" : previewMode === "mix" ? "◆ Versión renderizada" : "▶ Recurso aislado"}
                  </span>
                </div>
              </header>
              <div className="flex min-h-0 flex-1 items-center justify-center p-3">
                {previewMode === "live" ? (
                  <div className="relative h-full max-h-[520px] min-h-[260px] aspect-[9/16] overflow-hidden rounded-2xl border border-white/10 bg-[#080a13] shadow-[0_0_45px_rgba(34,211,238,.06)]">
                    {inBrandOutro ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(124,58,237,.22),transparent_55%)] p-8">
                        {/* Preview local autenticado; evita transformar el recurso en Next Image. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/projects/${projectId}/logo`} alt="Logo del proyecto" className="max-h-28 max-w-[72%] object-contain drop-shadow-2xl" />
                        <span className="mt-5 text-[10px] uppercase tracking-[.3em] text-white/45">Cierre de marca</span>
                      </div>
                    ) : activeBase?.asset ? (
                      <SyncedVideo
                        key={`base-${activeBase.segment.id}`}
                        src={`/api/projects/${projectId}/media/${activeBase.asset.id}/file`}
                        sourceTime={activeBase.segment.sourceStart + clamp(playheadTime - activeBase.start, 0, Math.max(0, segmentDuration(activeBase.segment) - 0.04))}
                        playing={playing}
                        muted={Boolean(selectedVoice)}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-xs text-white/25">Arrastra un vídeo a Principal para empezar.</div>
                    )}
                    {!inBrandOutro && activeOverlays.map((overlay) => {
                      const overlayAsset = byId.get(overlay.assetId);
                      if (!overlayAsset) return null;
                      const sourceTime = overlay.sourceStart + clamp(playheadTime - overlay.timelineStart, 0, Math.max(0, overlayDuration(overlay) - 0.04));
                      return (
                        <SyncedVideo
                          key={`layer-${overlay.id}`}
                          src={`/api/projects/${projectId}/media/${overlayAsset.id}/file`}
                          sourceTime={sourceTime}
                          playing={playing}
                          muted
                          className={overlay.mode === "cover" ? "absolute inset-0 z-10 h-full w-full object-cover" : "absolute z-10 rounded-lg border border-white/35 bg-black object-cover shadow-2xl"}
                          style={overlay.mode === "pip" ? pipPreviewStyle(overlay) : undefined}
                        />
                      );
                    })}
                    {liveSubtitle && <div className="absolute inset-x-[7%] bottom-[8%] z-30 text-center text-[clamp(10px,1.1vw,15px)] font-bold leading-tight text-white [text-shadow:0_2px_4px_#000,0_0_2px_#000]"><span className="rounded-md bg-black/70 box-decoration-clone px-2 py-1">{liveSubtitle}</span></div>}
                    <div className="absolute left-2 top-2 z-30 rounded-md bg-black/70 px-2 py-1 font-mono text-[9px] text-white/75">{formatTimecode(playheadTime)}</div>
                    {!inBrandOutro && selectedVoice && <SyncedAudio src={`/api/projects/${projectId}/media/${selectedVoice.id}/file`} sourceTime={playheadTime} playing={playing} volume={1} />}
                    {!inBrandOutro && selectedMusic && <SyncedAudio src={`/api/projects/${projectId}/media/${selectedMusic.id}/file`} sourceTime={playheadTime} playing={playing} volume={musicVolume} loop />}
                    <button type="button" aria-label={playing ? "Pausar montaje" : "Reproducir montaje"} onClick={() => { setPreviewMode("live"); setPlaying((current) => !current); }} className="absolute left-1/2 top-1/2 z-40 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/55 text-lg shadow-xl backdrop-blur hover:bg-black/75">{playing ? "Ⅱ" : "▶"}</button>
                  </div>
                ) : monitorSource ? (
                  <video key={monitorSource} controls preload="metadata" src={monitorSource} className="h-full max-h-[520px] aspect-[9/16] rounded-xl bg-black object-contain" />
                ) : (
                  <div className="text-xs text-white/30">No hay recurso seleccionado.</div>
                )}
              </div>
            </section>

            <aside className="min-h-0 overflow-y-auto rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.025] p-3 modern-scrollbar">
              <Inspector
                selectedSegment={selectedSegment}
                selectedAsset={selectedAsset}
                selectedOverlay={selectedOverlay}
                selectedOverlayAsset={selectedOverlayAsset}
                updateSegment={updateSegment}
                updateOverlay={updateOverlay}
                moveSegment={moveSegment}
                moveOverlay={moveOverlay}
                removeSegment={(id) => { setSegments((current) => current.filter((segment) => segment.id !== id)); setSelectedSegmentId(""); }}
                removeOverlay={(id) => { setOverlays((current) => current.filter((overlay) => overlay.id !== id)); setSelectedOverlayId(""); }}
                coversProtectedMoment={coversProtectedMoment}
              />

              <div className="mt-3 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between"><h3 className="text-xs font-semibold">Audio y subtítulos</h3><span className="rounded-md border border-emerald-300/20 bg-emerald-300/8 px-1.5 py-0.5 text-[8px] text-emerald-200">CC activo</span></div>
                <label className="mt-3 block text-[9px] text-white/40">Locución
                  <select aria-label="Locución" className="input mt-1 h-9 py-1 text-[10px]" value={voiceId} onChange={(event) => selectVoice(event.target.value)}>
                    <option value="">Audio original</option>
                    {voices.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.duration?.toFixed(1) ?? "?"}s</option>)}
                  </select>
                </label>
                {selectedVoice && <audio key={selectedVoice.id} controls preload="metadata" className="mt-2 h-8 w-full" src={`/api/projects/${projectId}/media/${selectedVoice.id}/file`} />}
                <label className="mt-3 block text-[9px] text-white/40">Música
                  <select aria-label="Música" className="input mt-1 h-9 py-1 text-[10px]" value={musicId} onChange={(event) => setMusicId(event.target.value)}>
                    <option value="">Sin música</option>
                    {music.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                  </select>
                </label>
                {selectedMusic && <label className="mt-2 block text-[9px] text-white/40">Volumen · {Math.round(musicVolume * 100)}%<input type="range" min="0.02" max="0.5" step="0.01" value={musicVolume} onChange={(event) => setMusicVolume(Number(event.target.value))} className="mt-1 w-full accent-purple-400" /></label>}
                <label className="mt-3 block text-[9px] text-white/40">Subtítulos obligatorios
                  <textarea value={subtitleText} onChange={(event) => setSubtitleText(event.target.value)} className="input mt-1 min-h-20 resize-y text-[10px]" placeholder="Texto exacto de la locución…" />
                </label>
              </div>

              <div className="mt-3 border-t border-white/10 pt-3">
                <h3 className="text-xs font-semibold">Ajustes del montaje</h3>
                <label className={`mt-2 flex items-center justify-between gap-3 rounded-xl border p-2.5 ${hasLogo ? "border-white/10 bg-black/20" : "border-white/5 opacity-45"}`}>
                  <span><span className="block text-[10px] font-medium">Cierre de marca</span><span className="block text-[8px] text-white/35">{hasLogo ? "Añade 3 segundos al final" : "Configura un logo en el proyecto"}</span></span>
                  <input type="checkbox" checked={includeBrandOutro && hasLogo} disabled={!hasLogo} onChange={(event) => setIncludeBrandOutro(event.target.checked)} className="h-4 w-4 accent-cyan-400" />
                </label>
              </div>
            </aside>
          </div>

          <div className="mx-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2">
            <span className="mr-1 text-[10px] font-semibold text-white/65">Plan visual</span>
            <button type="button" onClick={prepareSequential} className="rounded-lg border border-white/10 px-3 py-1.5 text-[9px] text-white/55 hover:bg-white/5">Preparar secuencial</button>
            <button type="button" onClick={prepareLayered} className="rounded-lg border border-cyan-300/20 bg-cyan-300/8 px-3 py-1.5 text-[9px] text-cyan-100">Preparar en capas</button>
            {!durationOk && <button type="button" onClick={harmonize} className="rounded-lg border border-amber-300/20 bg-amber-300/8 px-3 py-1.5 text-[9px] text-amber-100">Ajustar a locución</button>}
            <div className="ml-auto flex flex-wrap gap-1.5">
              <DurationChip label="Vídeo" value={`${visualDuration.toFixed(1)}s`} />
              <DurationChip label="Locución" value={voiceDuration === null ? "—" : `${voiceDuration.toFixed(1)}s`} />
              <DurationChip label="Diferencia" value={voiceDuration === null ? "—" : `${durationDelta >= 0 ? "+" : ""}${durationDelta.toFixed(1)}s`} tone={durationOk ? "ok" : "warn"} />
              {outroEnabled && <DurationChip label="Marca" value="+3.0s" tone="brand" />}
            </div>
            {message && <div className="basis-full truncate border-t border-white/8 pt-2 text-[9px] text-white/45" title={message}>{message}</div>}
          </div>

          <TimelineEditor
            projectId={projectId}
            segments={segments}
            overlays={overlays}
            baseTimeline={baseTimeline}
            byId={byId}
            timelineDuration={timelineDuration}
            contentDuration={contentDuration}
            timelineCanvasWidth={timelineCanvasWidth}
            timelineZoom={timelineZoom}
            rulerTicks={rulerTicks}
            playheadTime={playheadTime}
            playing={playing}
            selectedSegmentId={selectedSegmentId}
            selectedOverlayId={selectedOverlayId}
            selectedVoice={selectedVoice}
            selectedMusic={selectedMusic}
            subtitleText={subtitleText}
            outroEnabled={outroEnabled}
            timelineScrollRef={timelineScrollRef}
            setTimelineZoom={setTimelineZoom}
            setPlaying={setPlaying}
            setPlayheadTime={setPlayheadTime}
            setPreviewMode={setPreviewMode}
            setSelectedSegmentId={setSelectedSegmentId}
            setSelectedOverlayId={setSelectedOverlayId}
            beginOverlayGesture={beginOverlayGesture}
            seekFromPointer={seekFromPointer}
            handleTimelineKey={handleTimelineKey}
            dragSegment={(event, segment) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData(DRAG_SEGMENT, segment.id); }}
            dropOnPrincipal={dropOnPrincipal}
            dropOnLayer={dropOnLayer}
          />
        </div>
      </div>

      {versionsOpen && (
        <VersionsModal
          mixes={mixes}
          activeDraftId={draftId}
          onClose={() => setVersionsOpen(false)}
          onNew={() => void createNewDraft()}
          onOpenDraft={(mix) => void openDraft(mix)}
          onView={(mix) => { setPlaying(false); setPreviewMixId(mix.id); setPreviewMode("mix"); setVersionsOpen(false); }}
          onUseFinal={(mix) => void markAsFinal(mix)}
          onDelete={(mix) => void removeMix(mix)}
        />
      )}
      {appDialog.dialog}
    </section>
  );
}

function Inspector({
  selectedSegment,
  selectedAsset,
  selectedOverlay,
  selectedOverlayAsset,
  updateSegment,
  updateOverlay,
  moveSegment,
  moveOverlay,
  removeSegment,
  removeOverlay,
  coversProtectedMoment,
}: {
  selectedSegment: MixSegment | null;
  selectedAsset: StudioAsset | null;
  selectedOverlay: MixOverlay | null;
  selectedOverlayAsset: StudioAsset | null;
  updateSegment: (id: string, patch: Partial<MixSegment>) => void;
  updateOverlay: (id: string, patch: Partial<MixOverlay>) => void;
  moveSegment: (id: string, direction: -1 | 1) => void;
  moveOverlay: (id: string, direction: -1 | 1) => void;
  removeSegment: (id: string) => void;
  removeOverlay: (id: string) => void;
  coversProtectedMoment: boolean;
}) {
  if (selectedSegment && selectedAsset) {
    return (
      <div>
        <div className="flex items-start gap-2"><AssetBadge asset={selectedAsset} /><div className="min-w-0"><h3 className="truncate text-xs font-semibold">{selectedSegment.label}</h3><p className="text-[8px] text-white/35">Principal · {segmentDuration(selectedSegment).toFixed(2)}s</p></div></div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField label="Entrada" value={selectedSegment.sourceStart} max={selectedAsset.duration ?? undefined} disabled={selectedSegment.locked} onChange={(value) => updateSegment(selectedSegment.id, { sourceStart: value })} />
          <NumberField label="Salida" value={selectedSegment.sourceEnd} max={selectedAsset.duration ?? undefined} disabled={selectedSegment.locked} onChange={(value) => updateSegment(selectedSegment.id, { sourceEnd: value })} />
        </div>
        <button type="button" onClick={() => updateSegment(selectedSegment.id, { locked: !selectedSegment.locked })} className={`mt-2 w-full rounded-lg border px-2 py-2 text-[9px] ${selectedSegment.locked ? "border-emerald-300/25 bg-emerald-300/8 text-emerald-100" : "border-white/10 text-white/50"}`}>{selectedSegment.locked ? "🔒 Momento protegido" : "🔓 Proteger momento"}</button>
        <div className="mt-2 grid grid-cols-3 gap-1">
          <button type="button" onClick={() => moveSegment(selectedSegment.id, -1)} className="rounded-lg border border-white/10 py-1.5 text-[9px]">← Antes</button>
          <button type="button" onClick={() => moveSegment(selectedSegment.id, 1)} className="rounded-lg border border-white/10 py-1.5 text-[9px]">Después →</button>
          <button type="button" disabled={selectedSegment.locked} onClick={() => removeSegment(selectedSegment.id)} className="rounded-lg border border-red-300/15 py-1.5 text-[9px] text-red-200 disabled:opacity-25">Quitar</button>
        </div>
      </div>
    );
  }
  if (selectedOverlay && selectedOverlayAsset) {
    return (
      <div>
        <div className="flex items-start gap-2"><AssetBadge asset={selectedOverlayAsset} /><div className="min-w-0"><h3 className="truncate text-xs font-semibold">{selectedOverlay.label}</h3><p className="text-[8px] text-white/35">Capa · {overlayDuration(selectedOverlay).toFixed(2)}s · sin audio</p></div></div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <NumberField label="Empieza" value={selectedOverlay.timelineStart} onChange={(value) => updateOverlay(selectedOverlay.id, { timelineStart: value })} />
          <NumberField label="Entrada" value={selectedOverlay.sourceStart} max={selectedOverlayAsset.duration ?? undefined} onChange={(value) => updateOverlay(selectedOverlay.id, { sourceStart: value })} />
          <NumberField label="Salida" value={selectedOverlay.sourceEnd} max={selectedOverlayAsset.duration ?? undefined} onChange={(value) => updateOverlay(selectedOverlay.id, { sourceEnd: value })} />
        </div>
        <label className="mt-3 block text-[9px] text-white/40">Presentación<select value={selectedOverlay.mode} onChange={(event) => updateOverlay(selectedOverlay.id, { mode: event.target.value === "pip" ? "pip" : "cover" })} className="input mt-1 h-9 py-1 text-[10px]"><option value="pip">Picture-in-picture</option><option value="cover">Pantalla completa</option></select></label>
        {selectedOverlay.mode === "pip" && (
          <>
            <label className="mt-2 block text-[9px] text-white/40">Posición<select value={selectedOverlay.position} onChange={(event) => updateOverlay(selectedOverlay.id, { position: event.target.value as MixOverlay["position"] })} className="input mt-1 h-9 py-1 text-[10px]"><option value="top-right">Arriba derecha</option><option value="top-left">Arriba izquierda</option><option value="center">Centro</option><option value="bottom-right">Abajo derecha</option><option value="bottom-left">Abajo izquierda</option></select></label>
            <label className="mt-2 block text-[9px] text-white/40">Tamaño · {Math.round(selectedOverlay.size * 100)}%<input type="range" min="0.2" max="0.8" step="0.02" value={selectedOverlay.size} onChange={(event) => updateOverlay(selectedOverlay.id, { size: Number(event.target.value) })} className="mt-1 w-full accent-cyan-400" /></label>
          </>
        )}
        {coversProtectedMoment && <div className="mt-2 rounded-lg border border-amber-300/20 bg-amber-300/8 px-2 py-1.5 text-[8px] text-amber-100">La pantalla completa tapa un momento protegido.</div>}
        <div className="mt-2 grid grid-cols-3 gap-1">
          <button type="button" onClick={() => moveOverlay(selectedOverlay.id, -1)} className="rounded-lg border border-white/10 py-1.5 text-[9px]">↑ Capa</button>
          <button type="button" onClick={() => moveOverlay(selectedOverlay.id, 1)} className="rounded-lg border border-white/10 py-1.5 text-[9px]">↓ Capa</button>
          <button type="button" onClick={() => removeOverlay(selectedOverlay.id)} className="rounded-lg border border-red-300/15 py-1.5 text-[9px] text-red-200">Quitar</button>
        </div>
      </div>
    );
  }
  return <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-[10px] text-white/35">Selecciona un bloque de Principal o una capa para editar sus propiedades.</div>;
}

function NumberField({ label, value, max, disabled, onChange }: { label: string; value: number; max?: number; disabled?: boolean; onChange: (value: number) => void }) {
  return <label className="text-[8px] text-white/35">{label}<input type="number" min="0" max={max} step="0.1" value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="input mt-1 h-8 px-2 py-1 text-[9px]" /></label>;
}

function TimelineEditor({
  projectId,
  segments,
  overlays,
  baseTimeline,
  byId,
  timelineDuration,
  contentDuration,
  timelineCanvasWidth,
  timelineZoom,
  rulerTicks,
  playheadTime,
  playing,
  selectedSegmentId,
  selectedOverlayId,
  selectedVoice,
  selectedMusic,
  subtitleText,
  outroEnabled,
  timelineScrollRef,
  setTimelineZoom,
  setPlaying,
  setPlayheadTime,
  setPreviewMode,
  setSelectedSegmentId,
  setSelectedOverlayId,
  beginOverlayGesture,
  seekFromPointer,
  handleTimelineKey,
  dragSegment,
  dropOnPrincipal,
  dropOnLayer,
}: {
  projectId: string;
  segments: MixSegment[];
  overlays: MixOverlay[];
  baseTimeline: BaseTimelineItem[];
  byId: Map<string, StudioAsset>;
  timelineDuration: number;
  contentDuration: number;
  timelineCanvasWidth: number;
  timelineZoom: number;
  rulerTicks: number[];
  playheadTime: number;
  playing: boolean;
  selectedSegmentId: string;
  selectedOverlayId: string;
  selectedVoice: StudioAsset | null;
  selectedMusic: StudioAsset | null;
  subtitleText: string;
  outroEnabled: boolean;
  timelineScrollRef: React.RefObject<HTMLDivElement | null>;
  setTimelineZoom: (value: number) => void;
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setPlayheadTime: (value: number) => void;
  setPreviewMode: (value: PreviewMode) => void;
  setSelectedSegmentId: (value: string) => void;
  setSelectedOverlayId: (value: string) => void;
  beginOverlayGesture: (event: React.PointerEvent, overlay: MixOverlay, mode: OverlayGesture["mode"]) => void;
  seekFromPointer: (event: React.PointerEvent<HTMLElement>) => void;
  handleTimelineKey: (event: React.KeyboardEvent<HTMLElement>) => void;
  dragSegment: (event: React.DragEvent, segment: MixSegment) => void;
  dropOnPrincipal: (event: React.DragEvent<HTMLElement>) => void;
  dropOnLayer: (event: React.DragEvent<HTMLElement>, suggestedTime?: number) => void;
}) {
  const labelWidth = 140;
  const totalWidth = labelWidth + timelineCanvasWidth;
  return (
    <section className="m-3 mt-2 min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[#080a10]">
      <div className="flex h-12 items-center gap-2 border-b border-white/10 px-3">
        <button type="button" disabled={timelineDuration <= 0} onClick={() => { setPreviewMode("live"); setPlaying((current) => !current); }} className="h-8 min-w-20 rounded-lg bg-white px-3 text-[10px] font-bold text-black disabled:opacity-25">{playing ? "Ⅱ Pausa" : "▶ Play"}</button>
        <button type="button" disabled={timelineDuration <= 0} onClick={() => { setPlaying(false); setPlayheadTime(0); setPreviewMode("live"); }} className="h-8 rounded-lg border border-white/12 px-3 text-[10px] disabled:opacity-25">■ Stop</button>
        <span className="font-mono text-[10px] tabular-nums text-white/70">{formatTimecode(playheadTime)} <span className="text-white/25">/ {formatTimecode(timelineDuration)}</span></span>
        <span className="ml-auto text-[8px] text-white/30">Arrastra un vídeo a su pista</span>
        <label className="flex items-center gap-2 text-[8px] text-white/35">Zoom<input aria-label="Zoom de timeline" type="range" min="12" max="52" step="2" value={timelineZoom} onChange={(event) => setTimelineZoom(Number(event.target.value))} className="w-20 accent-cyan-400" /></label>
      </div>
      <div ref={timelineScrollRef} className="relative max-h-[calc(100%-3rem)] min-h-0 overflow-auto modern-scrollbar">
        <div className="relative" style={{ width: `${totalWidth}px` }}>
          <TimelineRow label="" labelWidth={labelWidth} canvasWidth={timelineCanvasWidth} height={28} className="sticky top-0 z-30 bg-[#080a10]">
            <div role="slider" aria-label="Cabezal de reproducción" aria-valuemin={0} aria-valuemax={timelineDuration} aria-valuenow={playheadTime} tabIndex={0} onKeyDown={handleTimelineKey} onPointerDown={seekFromPointer} className="relative h-full cursor-crosshair border-b border-white/8">
              {rulerTicks.map((tick) => <span key={tick} className="absolute inset-y-0 border-l border-white/10" style={{ left: `${tick * timelineZoom}px` }}><span className="absolute left-1 top-1 font-mono text-[7px] text-white/30">{formatTimecode(tick)}</span></span>)}
            </div>
          </TimelineRow>

          <TimelineRow label={<><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Principal</>} labelWidth={labelWidth} canvasWidth={timelineCanvasWidth} height={62}>
            <div onDragOver={(event) => event.preventDefault()} onDrop={dropOnPrincipal} onPointerDown={seekFromPointer} className="relative h-full bg-cyan-300/[0.025]">
              {segments.length === 0 && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] text-white/22">Suelta aquí la pista principal</span>}
              {baseTimeline.map((item, index) => {
                const asset = item.asset;
                const selected = item.segment.id === selectedSegmentId;
                const meta = asset ? assetMeta(asset) : ASSET_META.video;
                return (
                  <article
                    key={item.segment.id}
                    draggable
                    onDragStart={(event) => dragSegment(event, item.segment)}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => { setSelectedSegmentId(item.segment.id); setSelectedOverlayId(""); setPreviewMode("live"); setPlayheadTime(item.start); }}
                    style={{ left: `${item.start * timelineZoom}px`, width: `${Math.max(48, segmentDuration(item.segment) * timelineZoom)}px` }}
                    className={`group absolute inset-y-1.5 cursor-grab overflow-hidden rounded-lg border ${selected ? "z-10 border-cyan-200 shadow-[0_0_15px_rgba(34,211,238,.18)]" : item.segment.locked ? "border-emerald-300/30" : "border-white/15"}`}
                  >
                    {asset && <video aria-hidden="true" muted playsInline preload="metadata" src={`/api/projects/${projectId}/media/${asset.id}/file#t=${Math.max(0.05, item.segment.sourceStart)}`} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45" />}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />
                    <div className="relative flex h-full flex-col p-1.5"><span className={`w-fit rounded border px-1 py-0.5 text-[6px] ${meta.badge}`}>{meta.icon} {meta.label}</span><span className="mt-auto truncate text-[8px] font-semibold">{index + 1}. {item.segment.label} {item.segment.locked ? "🔒" : ""}</span></div>
                  </article>
                );
              })}
              {outroEnabled && (
                <div style={{ left: `${contentDuration * timelineZoom}px`, width: `${BRAND_OUTRO_SECONDS * timelineZoom}px` }} className="absolute inset-y-1.5 overflow-hidden rounded-lg border border-amber-300/25 bg-gradient-to-r from-amber-300/10 to-purple-400/10 px-2 py-1.5">
                  <span className="text-[7px] text-amber-100">◆ Marca · 3s</span><span className="mt-2 block truncate text-[7px] text-white/40">Cierre automático 🔒</span>
                </div>
              )}
            </div>
          </TimelineRow>

          {overlays.map((overlay, index) => {
            const asset = byId.get(overlay.assetId);
            const selected = overlay.id === selectedOverlayId;
            return (
              <TimelineRow key={overlay.id} label={<><span className="h-1.5 w-1.5 rounded-full bg-purple-300" /> Capa {index + 1}</>} labelWidth={labelWidth} canvasWidth={timelineCanvasWidth} height={48}>
                <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnLayer(event)} onPointerDown={seekFromPointer} className="relative h-full bg-purple-300/[0.018]">
                  <article
                    role="button"
                    tabIndex={0}
                    onPointerDown={(event) => beginOverlayGesture(event, overlay, "move")}
                    onClick={() => { setSelectedOverlayId(overlay.id); setSelectedSegmentId(""); setPreviewMode("live"); setPlayheadTime(overlay.timelineStart); }}
                    style={{ left: `${overlay.timelineStart * timelineZoom}px`, width: `${Math.max(48, overlayDuration(overlay) * timelineZoom)}px`, touchAction: "none" }}
                    className={`group absolute inset-y-1 cursor-grab select-none overflow-hidden rounded-lg border ${selected ? "z-10 border-purple-100 shadow-[0_0_14px_rgba(216,180,254,.2)]" : "border-purple-300/25"}`}
                  >
                    {asset && <video aria-hidden="true" muted playsInline preload="metadata" src={`/api/projects/${projectId}/media/${asset.id}/file#t=${Math.max(0.05, overlay.sourceStart)}`} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" />}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-950/95 via-black/65 to-black/30" />
                    <button type="button" aria-label={`Ajustar inicio de ${overlay.label}`} onPointerDown={(event) => beginOverlayGesture(event, overlay, "resize-start")} className="absolute inset-y-0 left-0 z-[2] w-2 cursor-ew-resize border-r border-white/20 bg-black/20 hover:bg-purple-200/30" />
                    <div className="relative z-[1] px-3 py-1.5"><span className="block truncate text-[8px] font-semibold">{assetMeta(asset ?? { kind: "video", origin: "" }).icon} {overlay.label}</span><span className="text-[7px] text-purple-100/60">{overlay.mode === "pip" ? "PIP" : "Completa"} · {overlayDuration(overlay).toFixed(1)}s</span></div>
                    <button type="button" aria-label={`Ajustar final de ${overlay.label}`} onPointerDown={(event) => beginOverlayGesture(event, overlay, "resize-end")} className="absolute inset-y-0 right-0 z-[2] w-2 cursor-ew-resize border-l border-white/20 bg-black/20 hover:bg-purple-200/30" />
                  </article>
                </div>
              </TimelineRow>
            );
          })}

          <TimelineRow label={<span className="text-white/30">＋ Nueva capa</span>} labelWidth={labelWidth} canvasWidth={timelineCanvasWidth} height={42}>
            <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnLayer(event)} className="relative h-full border-y border-dashed border-white/8 bg-white/[0.01]">
              <span className="pointer-events-none absolute left-8 top-1/2 -translate-y-1/2 rounded-lg border border-dashed border-purple-300/20 px-8 py-1.5 text-[8px] text-purple-100/45">Suelta aquí un vídeo para crear otra capa</span>
            </div>
          </TimelineRow>

          <TimelineRow label={<span className="text-white/38">♬ Locución</span>} labelWidth={labelWidth} canvasWidth={timelineCanvasWidth} height={30}>
            <div className="relative h-full bg-emerald-300/[0.015]">{selectedVoice && <div style={{ width: `${Math.min(contentDuration, selectedVoice.duration ?? contentDuration) * timelineZoom}px` }} className="absolute inset-y-1 left-0 rounded border border-emerald-300/15 bg-emerald-300/8 px-2 text-[7px] leading-5 text-emerald-100/65">{selectedVoice.name}</div>}</div>
          </TimelineRow>
          <TimelineRow label={<span className="text-white/38">♫ Música</span>} labelWidth={labelWidth} canvasWidth={timelineCanvasWidth} height={30}>
            <div className="relative h-full bg-purple-300/[0.012]">{selectedMusic && <div style={{ width: `${contentDuration * timelineZoom}px` }} className="absolute inset-y-1 left-0 rounded border border-purple-300/15 bg-purple-300/8 px-2 text-[7px] leading-5 text-purple-100/60">{selectedMusic.name}</div>}</div>
          </TimelineRow>
          <TimelineRow label={<span className="text-white/38">CC Subtítulos</span>} labelWidth={labelWidth} canvasWidth={timelineCanvasWidth} height={30}>
            <div className="relative h-full bg-white/[0.01]">{subtitleText && <div style={{ width: `${contentDuration * timelineZoom}px` }} className="absolute inset-y-1 left-0 overflow-hidden rounded border border-white/10 bg-white/5 px-2 text-[7px] leading-5 text-white/45">{subtitleText}</div>}</div>
          </TimelineRow>

          <div aria-hidden="true" className="pointer-events-none absolute bottom-0 top-0 z-40 w-px bg-red-400 shadow-[0_0_8px_rgba(248,113,113,.85)]" style={{ left: `${labelWidth + playheadTime * timelineZoom}px` }}><span className="absolute -left-1.5 top-0 h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-red-400" /></div>
        </div>
      </div>
    </section>
  );
}

function TimelineRow({
  label,
  labelWidth,
  canvasWidth,
  height,
  className = "",
  children,
}: {
  label: React.ReactNode;
  labelWidth: number;
  canvasWidth: number;
  height: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex border-b border-white/[0.055] ${className}`} style={{ height: `${height}px` }}>
      <div className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-white/8 bg-[#0a0c13] px-3 text-[9px] font-medium text-white/55" style={{ width: `${labelWidth}px` }}>{label}</div>
      <div className="shrink-0" style={{ width: `${canvasWidth}px` }}>{children}</div>
    </div>
  );
}

function DurationChip({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "ok" | "warn" | "brand" }) {
  const color = tone === "ok" ? "border-emerald-300/15 bg-emerald-300/8 text-emerald-100"
    : tone === "warn" ? "border-amber-300/20 bg-amber-300/8 text-amber-100"
      : tone === "brand" ? "border-purple-300/20 bg-purple-300/8 text-purple-100"
        : "border-white/8 bg-white/5 text-white/65";
  return <span className={`rounded-lg border px-2 py-1 text-center text-[8px] ${color}`}><span className="block uppercase opacity-45">{label}</span><b>{value}</b></span>;
}

function VersionsModal({
  mixes,
  activeDraftId,
  onClose,
  onNew,
  onOpenDraft,
  onView,
  onUseFinal,
  onDelete,
}: {
  mixes: MixDto[];
  activeDraftId: string;
  onClose: () => void;
  onNew: () => void;
  onOpenDraft: (mix: MixDto) => void;
  onView: (mix: MixDto) => void;
  onUseFinal: (mix: MixDto) => void;
  onDelete: (mix: MixDto) => void;
}) {
  const drafts = mixes.filter((mix) => mix.status === "draft");
  const versions = mixes.filter((mix) => mix.status !== "draft");
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="mix-versions-title" className="glass-strong flex max-h-[84dvh] w-full max-w-3xl flex-col overflow-hidden border border-white/12 shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 p-5"><div><h2 id="mix-versions-title" className="text-lg font-bold">Versiones y borradores</h2><p className="text-xs text-white/40">Los resultados son consultables; solo los borradores se editan.</p></div><button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-xs">Cerrar</button></header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 modern-scrollbar">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-100/70">Borradores · {drafts.length}</h3><button type="button" onClick={onNew} className="rounded-lg bg-cyan-400/10 px-3 py-2 text-[10px] text-cyan-100">＋ Nuevo borrador</button></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {drafts.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-white/12 p-8 text-center text-xs text-white/30">No hay borradores guardados.</div>}
            {drafts.map((mix) => <article key={mix.id} className={`rounded-xl border p-3 ${mix.id === activeDraftId ? "border-cyan-300/30 bg-cyan-300/6" : "border-white/10 bg-black/20"}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-medium">{mix.name}</div><div className="mt-1 text-[9px] text-white/35">Borrador · {new Date(mix.updatedAt).toLocaleString("es-ES")}</div></div>{mix.id === activeDraftId && <span className="rounded-md bg-cyan-300/10 px-2 py-1 text-[8px] text-cyan-100">Abierto</span>}</div><div className="mt-3 flex gap-2"><button type="button" onClick={() => onOpenDraft(mix)} className="rounded-lg border border-white/10 px-3 py-2 text-[10px]">{mix.id === activeDraftId ? "Continuar" : "Abrir"}</button><button type="button" onClick={() => onDelete(mix)} className="ml-auto rounded-lg border border-red-300/15 px-3 py-2 text-[10px] text-red-200">Eliminar</button></div></article>)}
          </div>

          <h3 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-amber-100/70">Versiones renderizadas · {versions.length}</h3>
          <div className="space-y-2">
            {versions.length === 0 && <div className="rounded-xl border border-dashed border-white/12 p-8 text-center text-xs text-white/30">Todavía no has generado ninguna versión.</div>}
            {versions.map((mix) => <article key={mix.id} className={`rounded-xl border p-3 ${mix.isFinal ? "border-emerald-300/25 bg-emerald-300/5" : "border-white/10 bg-black/20"}`}><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/25 to-amber-300/15">◆</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-medium">{mix.name}</span>{mix.isFinal && <span className="rounded-md bg-emerald-300/10 px-2 py-0.5 text-[8px] text-emerald-100">Final actual</span>}</div><div className={`mt-1 text-[9px] ${mix.status === "ready" ? "text-emerald-300" : mix.status === "error" ? "text-red-300" : "text-amber-200"}`}>{mix.status === "ready" ? "Lista" : mix.status === "error" ? `Error · ${mix.error ?? ""}` : "Renderizando…"}</div></div></div><div className="mt-3 flex flex-wrap gap-2">{mix.status === "ready" && <button type="button" onClick={() => onView(mix)} className="rounded-lg border border-white/10 px-3 py-2 text-[10px]">▶ Ver resultado</button>}{mix.status === "ready" && mix.pieceId && !mix.isFinal && <button type="button" onClick={() => onUseFinal(mix)} className="rounded-lg bg-purple-600 px-3 py-2 text-[10px] font-semibold">Usar como final</button>}{!mix.isFinal && <button type="button" onClick={() => onDelete(mix)} className="ml-auto rounded-lg border border-red-300/15 px-3 py-2 text-[10px] text-red-200">Eliminar</button>}</div></article>)}
          </div>
        </div>
      </section>
    </div>
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

function SyncedAudio({ src, sourceTime, playing, volume, loop = false }: { src: string; sourceTime: number; playing: boolean; volume: number; loop?: boolean }) {
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
  return <span className={`shrink-0 rounded-lg border px-2 py-1 text-[8px] font-semibold ${meta.badge}`}>{meta.icon} {meta.label}</span>;
}
