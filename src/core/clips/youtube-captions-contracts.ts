import type { ClipSelection, TranscriptCue } from "./contracts.js";

export function parseYouTubeJson3(input: unknown): TranscriptCue[] {
  const root = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const events = Array.isArray(root.events) ? root.events : [];
  return events
    .flatMap((entry, index): TranscriptCue[] => {
      if (!entry || typeof entry !== "object") return [];
      const event = entry as Record<string, unknown>;
      const startMs = Number(event.tStartMs);
      const next = events[index + 1];
      const nextStartMs = next && typeof next === "object"
        ? Number((next as Record<string, unknown>).tStartMs)
        : Number.NaN;
      const durationMs = Number(event.dDurationMs);
      const endMs = Number.isFinite(durationMs) && durationMs > 0
        ? startMs + durationMs
        : Number.isFinite(nextStartMs)
          ? nextStartMs
          : startMs + 3_000;
      const segments = Array.isArray(event.segs) ? event.segs : [];
      const text = segments
        .map((segment) => segment && typeof segment === "object"
          ? String((segment as Record<string, unknown>).utf8 ?? "")
          : "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs - startMs < 80 || !text) {
        return [];
      }
      return [{ start: startMs / 1000, end: endMs / 1000, text }];
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

export function applyYouTubeCaptions(
  selection: ClipSelection,
  captions: TranscriptCue[],
): ClipSelection {
  if (captions.length === 0) return selection;
  const transcript = selection.transcript.filter((cue) => Boolean(cue.momentId));
  const moments = selection.moments.map((moment) => {
    if (moment.subtitleSource === "synced_json" || moment.subtitleSource === "gemini") {
      return moment;
    }
    const matching = captions.flatMap((cue): TranscriptCue[] => {
      const start = Math.max(moment.start, cue.start);
      const end = Math.min(moment.end, cue.end);
      if (end - start < 0.08) return [];
      return [{ start, end, text: cue.text, momentId: moment.id }];
    });
    if (matching.length === 0) return moment;
    transcript.push(...matching);
    const alignedTranscript = matching.map((cue) => cue.text).join(" ");
    return {
      ...moment,
      subtitleSource: "youtube_cc" as const,
      alignedTranscript,
      evidence: alignedTranscript.slice(0, 500),
    };
  });
  return {
    ...selection,
    transcript: transcript.sort((a, b) => a.start - b.start || a.end - b.end),
    moments,
  };
}
