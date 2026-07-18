import fs from "node:fs";
import path from "node:path";

const WORDS_PER_CUE = 7;
const MAX_LINE_CHARS = 24;

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
  const safe = value.replace(/[{}]/g, "").replace(/\\/g, "\\\\");
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

/**
 * Genera ASS vertical con zona segura inferior. Devuelve false si no hay texto
 * o duración; el llamador decide si una pieza sin locución necesita subtítulos.
 */
export function writeAssSubtitles(dir: string, text: string, duration: number): boolean {
  const cues = cueGroups(text);
  if (cues.length === 0 || duration <= 0) return false;

  const weights = cues.map((cue) => Math.max(1, cue.length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = 0;
  const events = cues.map((cue, index) => {
    const remaining = duration - cursor;
    const cueDuration = index === cues.length - 1 ? remaining : (weights[index] / totalWeight) * duration;
    const start = cursor;
    cursor = Math.min(duration, cursor + cueDuration);
    return `Dialogue: 0,${assTime(start)},${assTime(cursor)},Default,,0,0,0,,${wrapCue(cue)}`;
  });

  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,58,&H00FFFFFF,&H000000FF,&HCC000000,&H78000000,-1,0,0,0,100,100,0,0,3,3,0,2,100,100,230,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}
`;
  fs.writeFileSync(path.join(dir, "subs.ass"), ass, "utf8");
  return true;
}
