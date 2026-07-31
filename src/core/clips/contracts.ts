export type ClipSourceType = "upload" | "youtube";
export type ClipSelectionMode = "ai" | "json";
export type ClipJsonTimingMode = "direct" | "gemini";
export type ClipSubtitleMode = "youtube_cc" | "local_whisper" | "gemini";
export type ClipJobStatus = "pending" | "processing" | "ready" | "error";
export type ClipStage = "source" | "understanding" | "selection" | "rendering" | "results";
export type ClipRisk = "low" | "medium" | "high";

export interface TranscriptCue {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  momentId?: string;
}

export interface ClipMoment {
  id: string;
  title: string;
  start: number;
  end: number;
  duration: number;
  viralScore: number;
  controversyScore: number;
  confidence: number;
  hook: string;
  evidence: string;
  whyViral: string;
  whyControversial: string;
  context: string;
  risk: ClipRisk;
  riskReason: string;
  importedRankViral?: number;
  importedRankControversial?: number;
  sourceTranscript?: string;
  sourceCues?: TranscriptCue[];
  subtitleSource?: "synced_json" | "youtube_cc" | "local_whisper" | "gemini";
  alignedTranscript?: string;
  alignmentScore?: number;
  outputName?: string;
  thumbnailName?: string;
  renderError?: string;
}

export interface ClipSelection {
  source?: ClipSelectionMode;
  jsonTiming?: ClipJsonTimingMode;
  summary: string;
  language: string;
  transcript: TranscriptCue[];
  moments: ClipMoment[];
  topViral: string[];
  topControversial: string[];
  rejectedCount: number;
}

export interface ImportedClipEntry {
  ranking: number;
  start: number;
  end: number;
  hook: string;
  transcript: string;
  justification: string;
  subtitles?: TranscriptCue[];
}

export interface ImportedClipPlan {
  viral: ImportedClipEntry[];
  controversial: ImportedClipEntry[];
}

export interface ClipJob {
  id: string;
  title: string;
  sourceType: ClipSourceType;
  sourceUrl?: string;
  sourceName: string;
  sourceFile?: string;
  selectionMode?: ClipSelectionMode;
  jsonTiming?: ClipJsonTimingMode;
  importedPlan?: ImportedClipPlan;
  status: ClipJobStatus;
  stage: ClipStage;
  progress: number;
  duration?: number;
  selection?: ClipSelection;
  logs: string[];
  error?: string;
  outputsDeletedAt?: string;
  regeneratedFromId?: string;
  activeOperation?: {
    kind: "full" | "moment";
    label: string;
    momentId?: string;
  };
  createdAt: string;
  updatedAt: string;
}

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
}

function text(value: unknown, max = 1200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function score(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(Math.max(0, Math.min(100, parsed))) : 0;
}

export function parseTimestamp(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.max(0, value) : 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Math.max(0, Number(raw));
  const parts = raw.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part)) || parts.length > 3) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export function parseImportedClipPlan(input: unknown): ImportedClipPlan {
  const raw = obj(input);
  const viral = parseImportedEntries(raw.top_10_virales, "virales");
  const controversial = parseImportedEntries(raw.top_10_polemicos, "polémicos");
  if (viral.length === 0 && controversial.length === 0) {
    throw new Error("El JSON debe incluir al menos un clip en top_10_virales o top_10_polemicos.");
  }
  return { viral, controversial };
}

export function selectionFromImportedPlan(
  plan: ImportedClipPlan,
  duration: number,
): ClipSelection {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("La duración del vídeo no es válida.");
  const moments: ClipMoment[] = [];
  const topViral: string[] = [];
  const topControversial: string[] = [];

  const add = (entry: ImportedClipEntry, category: "viral" | "controversial") => {
    validateImportedTime(entry, duration, category);
    let moment = moments.find((candidate) =>
      Math.abs(candidate.start - entry.start) <= 0.25
      && Math.abs(candidate.end - entry.end) <= 0.25
    );
    if (!moment) {
      const id = `json-${Math.round(entry.start * 100)}-${Math.round(entry.end * 100)}`;
      moment = {
        id,
        title: entry.hook.slice(0, 160),
        start: round2(entry.start),
        end: round2(entry.end),
        duration: round2(entry.end - entry.start),
        viralScore: 0,
        controversyScore: 0,
        confidence: 0,
        hook: entry.hook,
        evidence: entry.transcript.slice(0, 500),
        whyViral: "",
        whyControversial: "",
        context: "Corte y ranking aportados mediante JSON editorial.",
        risk: "low",
        riskReason: "",
        sourceTranscript: entry.transcript,
        sourceCues: entry.subtitles,
      };
      moments.push(moment);
    } else if ((moment.sourceTranscript?.length ?? 0) < entry.transcript.length) {
      moment.sourceTranscript = entry.transcript;
      moment.evidence = entry.transcript.slice(0, 500);
    }
    if (moment.sourceCues?.length && entry.subtitles?.length && !sameCues(moment.sourceCues, entry.subtitles)) {
      throw new Error(
        `El intervalo ${formatTimestamp(entry.start)}–${formatTimestamp(entry.end)} aparece en ambos rankings `
        + "con subtítulos_sincronizados diferentes. Usa los mismos cues para evitar un montaje ambiguo.",
      );
    }
    if (!moment.sourceCues?.length && entry.subtitles?.length) moment.sourceCues = entry.subtitles;

    if (category === "viral") {
      moment.importedRankViral = entry.ranking;
      moment.whyViral = entry.justification;
      topViral.push(moment.id);
    } else {
      moment.importedRankControversial = entry.ranking;
      moment.whyControversial = entry.justification;
      topControversial.push(moment.id);
    }
  };

  plan.viral.forEach((entry) => add(entry, "viral"));
  plan.controversial.forEach((entry) => add(entry, "controversial"));
  moments.sort((a, b) => a.start - b.start || a.end - b.end);
  return {
    source: "json",
    summary: "Selección editorial importada. Los cortes y rankings no serán recalculados por IA.",
    language: "es",
    transcript: [],
    moments,
    topViral,
    topControversial,
    rejectedCount: 0,
  };
}

export function applyImportedAlignment(
  selection: ClipSelection,
  input: unknown,
): ClipSelection {
  const raw = obj(input);
  const alignments = Array.isArray(raw.alignments)
    ? raw.alignments
    : Array.isArray(raw.alineaciones)
      ? raw.alineaciones
      : [];
  const transcript: TranscriptCue[] = [];
  const moments = selection.moments.map((moment) => {
    const match = alignments
      .map(obj)
      .find((alignment) => text(alignment.id, 100) === moment.id);
    if (!match) throw new Error(`Gemini no devolvió la alineación de «${moment.title}».`);
    const alignmentScore = score(match.match ?? match.coincidencia ?? match.matchScore);
    const cues = (Array.isArray(match.cues) ? match.cues : [])
      .flatMap((entry): TranscriptCue[] => {
        const cue = obj(entry);
        const start = parseTimestamp(cue.start ?? cue.desde);
        const end = parseTimestamp(cue.end ?? cue.hasta);
        const cueText = text(cue.text ?? cue.texto, 1000);
        if (
          !cueText
          || start < moment.start - 0.35
          || end > moment.end + 0.35
          || end - start < 0.08
        ) return [];
        return [{
          start: Math.max(moment.start, round2(start)),
          end: Math.min(moment.end, round2(end)),
          text: cueText,
          speaker: text(cue.speaker ?? cue.hablante, 80) || undefined,
          momentId: moment.id,
        }];
      })
      .sort((a, b) => a.start - b.start || a.end - b.end);
    if (cues.length === 0) {
      throw new Error(`No se obtuvieron frases temporizadas para «${moment.title}».`);
    }
    const alignedTranscript = text(
      match.correctedTranscript ?? match.transcripcion_corregida,
      12_000,
    ) || cues.map((cue) => cue.text).join(" ");
    const coverage = tokenCoverage(moment.sourceTranscript ?? "", alignedTranscript);
    if (alignmentScore < 60 || coverage < 0.45) {
      throw new Error(
        `El texto de «${moment.title}» no coincide suficientemente con el audio `
        + `(sincronía ${alignmentScore}%, coincidencia textual ${Math.round(coverage * 100)}%). `
        + "Corrige sus tiempos o su transcripción en el JSON.",
      );
    }
    transcript.push(...cues);
    return {
      ...moment,
      alignmentScore: Math.min(alignmentScore, Math.round(coverage * 100)),
      subtitleSource: "gemini" as const,
      alignedTranscript,
      evidence: alignedTranscript.slice(0, 500),
    };
  });
  return {
    ...selection,
    jsonTiming: "gemini",
    transcript: transcript.sort((a, b) => a.start - b.start || a.end - b.end),
    moments,
  };
}

export function applyDirectImportedTranscript(selection: ClipSelection): ClipSelection {
  const transcript: TranscriptCue[] = [];
  const moments = selection.moments.map((moment) => {
    if (moment.sourceCues?.length) {
      transcript.push(...moment.sourceCues.map((cue) => ({
        ...cue,
        momentId: moment.id,
      })));
      const syncedText = moment.sourceCues.map((cue) => cue.text).join(" ");
      return {
        ...moment,
        subtitleSource: "synced_json" as const,
        alignedTranscript: syncedText,
        evidence: syncedText.slice(0, 500),
      };
    }
    if (!(moment.sourceTranscript ?? "").trim()) {
      throw new Error(`El JSON no contiene transcripción para «${moment.title}».`);
    }
    return {
      ...moment,
      subtitleSource: undefined,
      alignedTranscript: undefined,
      evidence: (moment.sourceTranscript ?? "").slice(0, 500),
    };
  });
  return {
    ...selection,
    jsonTiming: "direct",
    transcript: transcript.sort((a, b) => a.start - b.start || a.end - b.end),
    moments,
  };
}

function risk(value: unknown): ClipRisk {
  return value === "high" || value === "medium" ? value : "low";
}

function coerceTranscript(input: unknown, duration: number): TranscriptCue[] {
  return (Array.isArray(input) ? input : [])
    .flatMap((entry): TranscriptCue[] => {
      const value = obj(entry);
      const start = Math.min(duration, parseTimestamp(value.start ?? value.desde));
      const end = Math.min(duration, parseTimestamp(value.end ?? value.hasta));
      const cueText = text(value.text ?? value.texto, 1000);
      if (!cueText || end - start < 0.08) return [];
      return [{
        start,
        end,
        text: cueText,
        speaker: text(value.speaker ?? value.hablante, 80) || undefined,
      }];
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

function coerceMoment(input: unknown, index: number, duration: number): ClipMoment | null {
  const value = obj(input);
  let start = Math.min(duration, parseTimestamp(value.start ?? value.desde));
  let end = Math.min(duration, parseTimestamp(value.end ?? value.hasta));
  if (end <= start || duration <= 0) return null;

  const initialDuration = end - start;
  if (initialDuration < 10) return null;
  if (initialDuration < 15) {
    const missing = 15 - initialDuration;
    start = Math.max(0, start - missing / 2);
    end = Math.min(duration, end + missing / 2);
    if (end - start < 14) start = Math.max(0, end - 15);
  }
  if (end - start > 90) end = Math.min(duration, start + 90);

  const viralScore = score(value.viralScore ?? value.viral_score ?? value.viralidad);
  const controversyScore = score(
    value.controversyScore ?? value.controversy_score ?? value.controversia,
  );
  const confidence = score(value.confidence ?? value.confidenceScore ?? value.confianza);
  const evidence = text(value.evidence ?? value.evidencia ?? value.quote ?? value.cita, 500);
  const hook = text(value.hook ?? value.gancho, 300);
  const whyViral = text(value.whyViral ?? value.porQueViral ?? value.motivoViral, 900);
  const whyControversial = text(
    value.whyControversial ?? value.porQueControvertido ?? value.motivoControversia,
    900,
  );
  if (confidence < 55 || Math.max(viralScore, controversyScore) < 65) return null;
  if (!evidence || !hook || (!whyViral && !whyControversial)) return null;

  const rawId = text(value.id, 80).replace(/[^a-zA-Z0-9_-]/g, "");
  return {
    id: rawId || `moment-${index + 1}-${Math.round(start * 10)}`,
    title: text(value.title ?? value.titulo, 160) || `Momento ${index + 1}`,
    start: round2(start),
    end: round2(end),
    duration: round2(end - start),
    viralScore,
    controversyScore,
    confidence,
    hook,
    evidence,
    whyViral,
    whyControversial,
    context: text(value.context ?? value.contexto, 900),
    risk: risk(value.risk ?? value.riesgo),
    riskReason: text(value.riskReason ?? value.motivoRiesgo, 600),
  };
}

export function selectClipMoments(rawInput: unknown, duration: number): ClipSelection {
  const raw = obj(rawInput);
  const rawMoments = Array.isArray(raw.moments)
    ? raw.moments
    : Array.isArray(raw.momentos)
      ? raw.momentos
      : [];
  const eligible = rawMoments
    .map((moment, index) => coerceMoment(moment, index, duration))
    .filter((moment): moment is ClipMoment => Boolean(moment))
    .sort((a, b) => quality(b) - quality(a));

  const moments: ClipMoment[] = [];
  eligible.forEach((candidate) => {
    if (moments.some((selected) => overlapRatio(candidate, selected) >= 0.72)) return;
    moments.push(candidate);
  });
  const usedIds = new Set<string>();
  moments.forEach((moment) => {
    const base = moment.id;
    let unique = base;
    let suffix = 2;
    while (usedIds.has(unique)) unique = `${base}-${suffix++}`;
    moment.id = unique;
    usedIds.add(unique);
  });
  moments.sort((a, b) => a.start - b.start);

  const topViral = [...moments]
    .filter((moment) => moment.viralScore >= 65)
    .sort((a, b) => rankScore(b, "viral") - rankScore(a, "viral"))
    .slice(0, 10)
    .map((moment) => moment.id);
  const topControversial = [...moments]
    .filter((moment) => moment.controversyScore >= 65)
    .sort((a, b) => rankScore(b, "controversial") - rankScore(a, "controversial"))
    .slice(0, 10)
    .map((moment) => moment.id);

  return {
    source: "ai",
    summary: text(raw.summary ?? raw.resumen, 2000),
    language: text(raw.language ?? raw.idioma, 40) || "es",
    transcript: coerceTranscript(raw.transcript ?? raw.transcripcion, duration),
    moments,
    topViral,
    topControversial,
    rejectedCount: Math.max(0, rawMoments.length - moments.length),
  };
}

export function subtitleCuesForMoment(
  selection: ClipSelection,
  moment: ClipMoment,
): TranscriptCue[] {
  const cues = selection.transcript.flatMap((cue): TranscriptCue[] => {
    if (cue.momentId && cue.momentId !== moment.id) return [];
    const start = Math.max(moment.start, cue.start);
    const end = Math.min(moment.end, cue.end);
    if (end - start < 0.08) return [];
    return [{
      start: round2(start - moment.start),
      end: round2(end - moment.start),
      text: cue.text,
      speaker: cue.speaker,
    }];
  });
  return cues.length > 0
    ? cues
    : [{ start: 0, end: moment.duration, text: moment.evidence }];
}

function parseImportedEntries(input: unknown, label: string): ImportedClipEntry[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) throw new Error(`top_10_${label} debe ser una lista.`);
  if (input.length > 10) throw new Error(`top_10_${label} no puede contener más de 10 clips.`);
  const usedRanks = new Set<number>();
  const usedWindows = new Set<string>();
  const entries = input.map((entry, index): ImportedClipEntry => {
    const value = obj(entry);
    const ranking = Math.trunc(Number(value.ranking));
    const start = parseTimestamp(value.start_time);
    const end = parseTimestamp(value.end_time);
    const hook = text(value.hook_inicial, 500);
    const transcript = text(value.transcripcion_completa, 12_000);
    const justification = text(value.justificacion, 2_000);
    if (!Number.isInteger(ranking) || ranking < 1 || ranking > 10 || usedRanks.has(ranking)) {
      throw new Error(`Ranking inválido o repetido en top_10_${label}, posición ${index + 1}.`);
    }
    if (end <= start) {
      throw new Error(`Tiempos inválidos en top_10_${label}, ranking ${ranking}.`);
    }
    const windowKey = `${round2(start)}-${round2(end)}`;
    if (usedWindows.has(windowKey)) {
      throw new Error(`El mismo intervalo aparece repetido en top_10_${label}.`);
    }
    if (!hook || !transcript || !justification) {
      throw new Error(
        `Faltan hook_inicial, transcripcion_completa o justificacion en top_10_${label}, ranking ${ranking}.`,
      );
    }
    const subtitles = parseImportedSubtitles(
      value.subtitulos_sincronizados,
      start,
      end,
      label,
      ranking,
    );
    usedRanks.add(ranking);
    usedWindows.add(windowKey);
    return { ranking, start, end, hook, transcript, justification, subtitles };
  });
  return entries.sort((a, b) => a.ranking - b.ranking);
}

function parseImportedSubtitles(
  input: unknown,
  clipStart: number,
  clipEnd: number,
  label: string,
  ranking: number,
): TranscriptCue[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error(
      `subtitulos_sincronizados debe contener al menos un cue en top_10_${label}, ranking ${ranking}.`,
    );
  }
  if (input.length > 200) {
    throw new Error(
      `subtitulos_sincronizados supera el máximo de 200 cues en top_10_${label}, ranking ${ranking}.`,
    );
  }
  let previousEnd = clipStart;
  return input.map((entry, index): TranscriptCue => {
    const value = obj(entry);
    const start = parseTimestamp(value.start_time ?? value.start ?? value.desde);
    const end = parseTimestamp(value.end_time ?? value.end ?? value.hasta);
    const cueText = text(value.texto ?? value.text, 1_000);
    if (!cueText || end - start < 0.08) {
      throw new Error(
        `Cue ${index + 1} inválido en subtitulos_sincronizados de top_10_${label}, ranking ${ranking}.`,
      );
    }
    if (start < clipStart - 0.05 || end > clipEnd + 0.05) {
      throw new Error(
        `Cue ${index + 1} de top_10_${label}, ranking ${ranking}, queda fuera del corte `
        + `${formatTimestamp(clipStart)}–${formatTimestamp(clipEnd)}.`,
      );
    }
    if (start < previousEnd - 0.01) {
      throw new Error(
        `Los subtítulos se solapan o no están ordenados en top_10_${label}, ranking ${ranking}, cue ${index + 1}.`,
      );
    }
    previousEnd = end;
    return {
      start: round2(Math.max(clipStart, start)),
      end: round2(Math.min(clipEnd, end)),
      text: cueText,
    };
  });
}

function sameCues(a: TranscriptCue[], b: TranscriptCue[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((cue, index) =>
    Math.abs(cue.start - b[index].start) <= 0.01
    && Math.abs(cue.end - b[index].end) <= 0.01
    && cue.text === b[index].text
  );
}

function validateImportedTime(
  entry: ImportedClipEntry,
  duration: number,
  category: "viral" | "controversial",
): void {
  const label = category === "viral" ? "viral" : "polémico";
  if (entry.start >= duration || entry.end > duration + 0.05) {
    throw new Error(
      `El clip ${label} #${entry.ranking} termina fuera del vídeo `
      + `(${formatTimestamp(entry.end)} > ${formatTimestamp(duration)}).`,
    );
  }
  const clipDuration = entry.end - entry.start;
  if (clipDuration < 10 || clipDuration > 90) {
    throw new Error(
      `El clip ${label} #${entry.ranking} dura ${Math.round(clipDuration)} s; `
      + "para TikTok debe durar entre 10 y 90 segundos.",
    );
  }
  const wordsPerSecond = normalizedTokens(entry.transcript).length / clipDuration;
  if (wordsPerSecond > 5.5) {
    throw new Error(
      `La transcripción del clip ${label} #${entry.ranking} contiene demasiado texto `
      + `para ${Math.round(clipDuration)} s. Revisa sus tiempos o el contenido.`,
    );
  }
}

function tokenCoverage(expected: string, actual: string): number {
  const expectedTokens = normalizedTokens(expected);
  const actualTokens = new Set(normalizedTokens(actual));
  if (expectedTokens.length === 0 || actualTokens.size === 0) return 0;
  const matches = expectedTokens.filter((token) => actualTokens.has(token)).length;
  return matches / expectedTokens.length;
}

function normalizedTokens(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñü]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 1);
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.round(seconds % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function quality(moment: ClipMoment): number {
  return Math.max(moment.viralScore, moment.controversyScore) + moment.confidence * 0.18;
}

function rankScore(moment: ClipMoment, type: "viral" | "controversial"): number {
  const primary = type === "viral" ? moment.viralScore : moment.controversyScore;
  const secondary = type === "viral" ? moment.controversyScore : moment.viralScore;
  return primary + moment.confidence * 0.12 + secondary * 0.04;
}

function overlapRatio(a: ClipMoment, b: ClipMoment): number {
  const intersection = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  return intersection / Math.max(0.01, Math.min(a.duration, b.duration));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
