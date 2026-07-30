import fs from "node:fs";
import path from "node:path";

const WORDS_PER_CUE = 7;
const MAX_LINE_CHARS = 24;
const CUE_GAP_SECONDS = 0.12;

export interface TimedSubtitleCue {
  start: number;
  end: number;
  text: string;
}

function assTime(seconds: number): string {
  const centiseconds = Math.max(0, Math.round(seconds * 100));
  const cs = centiseconds % 100;
  const totalSeconds = Math.floor(centiseconds / 100);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function cueGroups(text: string): string[] {
  const words = text.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const groups: string[] = [];
  for (let index = 0; index < words.length; index += WORDS_PER_CUE) {
    groups.push(words.slice(index, index + WORDS_PER_CUE).join(" "));
  }
  return groups;
}

function wrapCue(value: string): string {
  const safe = value.replace(/[{}]/g, "").replace(/\\/g, "\\\\").replace(/\r?\n/g, " ");
  if (safe.length <= MAX_LINE_CHARS) return safe;
  const words = safe.split(" ");
  let first = "";
  let second = "";
  for (const word of words) {
    if (!second && `${first} ${word}`.trim().length <= MAX_LINE_CHARS) {
      first = `${first} ${word}`.trim();
    } else {
      second = `${second} ${word}`.trim();
    }
  }
  return second ? `${first}\\N${second}` : first;
}

function assDocument(events: string[]): string {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,56,&H00FFFFFF,&H000000FF,&HCC000000,&H78000000,-1,0,0,0,100,100,0.5,0,3,3,0,2,100,100,230,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}
`;
}

function dialogue(start: number, end: number, text: string): string {
  return `Dialogue: 0,${assTime(start)},${assTime(end)},Default,,0,0,0,,${wrapCue(text)}`;
}

/**
 * Genera ASS vertical con zona segura inferior. Devuelve false si no hay texto
 * o duración; el llamador decide si una pieza sin locución necesita subtítulos.
 */
export function writeAssSubtitles(dir: string, text: string, duration: number): boolean {
  const cues = cueGroups(text);
  if (cues.length === 0 || duration <= 0) return false;

  const weights = cues.map((cue) => Math.max(1, cue.length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const gap = Math.min(CUE_GAP_SECONDS, duration / Math.max(16, cues.length * 8));
  const spokenDuration = Math.max(duration * 0.72, duration - gap * Math.max(0, cues.length - 1));
  let cursor = 0;
  const events = cues.map((cue, index) => {
    const cueDuration = (weights[index] / totalWeight) * spokenDuration;
    const start = cursor;
    const end = Math.min(duration, start + cueDuration);
    cursor = Math.min(duration, end + gap);
    return dialogue(start, end, cue);
  });

  fs.writeFileSync(path.join(dir, "subs.ass"), assDocument(events), "utf8");
  return true;
}

/** Genera ASS a partir de una transcripción temporal, siempre sin cues simultáneos. */
export function writeTimedAssSubtitles(
  dir: string,
  timedCues: TimedSubtitleCue[],
  duration: number,
  fileName = "subs.ass",
): boolean {
  if (duration <= 0) return false;
  const expanded = timedCues
    .flatMap((cue) => {
      const start = Math.max(0, Math.min(duration, Number(cue.start)));
      const end = Math.max(start, Math.min(duration, Number(cue.end)));
      const groups = cueGroups(cue.text);
      if (groups.length === 0 || end - start < 0.2) return [];
      const slot = (end - start) / groups.length;
      return groups.map((text, index) => ({
        start: start + slot * index,
        end: start + slot * (index + 1),
        text,
      }));
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (expanded.length === 0) return false;

  const events: string[] = [];
  let previousEnd = -CUE_GAP_SECONDS;
  expanded.forEach((cue, index) => {
    const nextStart = expanded[index + 1]?.start ?? duration;
    const start = Math.max(cue.start, previousEnd + CUE_GAP_SECONDS);
    const end = Math.min(cue.end, nextStart - CUE_GAP_SECONDS, duration);
    if (end - start < 0.18) return;
    events.push(dialogue(start, end, cue.text));
    previousEnd = end;
  });
  if (events.length === 0) return false;
  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "-");
  fs.writeFileSync(path.join(dir, safeName), assDocument(events), "utf8");
  return true;
}
