import assert from "node:assert/strict";
import test from "node:test";
import { applyYouTubeCaptions, parseYouTubeJson3 } from "./youtube-captions-contracts.js";
import type { ClipSelection } from "./contracts.js";

test("convierte CC JSON3 de YouTube a cues temporales", () => {
  const cues = parseYouTubeJson3({
    events: [
      { tStartMs: 1_000, dDurationMs: 1_800, segs: [{ utf8: "Hola " }, { utf8: "mundo" }] },
      { tStartMs: 3_000, dDurationMs: 2_000, segs: [{ utf8: "Segunda frase" }] },
      { tStartMs: 5_000, segs: [{ utf8: "\n" }] },
    ],
  });
  assert.deepEqual(cues, [
    { start: 1, end: 2.8, text: "Hola mundo" },
    { start: 3, end: 5, text: "Segunda frase" },
  ]);
});

test("aplica CC solo a cortes sin cues editoriales y los aísla por momentId", () => {
  const selection: ClipSelection = {
    source: "json",
    jsonTiming: "direct",
    summary: "",
    language: "es",
    rejectedCount: 0,
    topViral: ["a", "b"],
    topControversial: [],
    transcript: [{ start: 0, end: 2, text: "Editorial", momentId: "a" }],
    moments: [
      {
        id: "a", title: "A", start: 0, end: 10, duration: 10,
        viralScore: 0, controversyScore: 0, confidence: 0, hook: "", evidence: "",
        whyViral: "", whyControversial: "", context: "", risk: "low", riskReason: "",
        subtitleSource: "synced_json",
      },
      {
        id: "b", title: "B", start: 10, end: 20, duration: 10,
        viralScore: 0, controversyScore: 0, confidence: 0, hook: "", evidence: "",
        whyViral: "", whyControversial: "", context: "", risk: "low", riskReason: "",
      },
    ],
  };
  const next = applyYouTubeCaptions(selection, [
    { start: 1, end: 2, text: "No debe mezclarse" },
    { start: 11, end: 14, text: "CC correcto" },
  ]);
  assert.equal(next.moments[0].subtitleSource, "synced_json");
  assert.equal(next.moments[1].subtitleSource, "youtube_cc");
  assert.deepEqual(next.transcript.map((cue) => [cue.momentId, cue.text]), [
    ["a", "Editorial"],
    ["b", "CC correcto"],
  ]);
});
