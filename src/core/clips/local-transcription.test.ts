import assert from "node:assert/strict";
import test from "node:test";
import { parseLocalTranscription } from "./local-transcription.js";

test("interpreta el JSON completo de whisper.cpp en segundos", () => {
  const parsed = parseLocalTranscription(JSON.stringify({
    result: { language: "es" },
    transcription: [
      {
        offsets: { from: 120, to: 2_850 },
        text: " Primera frase sincronizada. ",
      },
      {
        offsets: { from: 2_970, to: 5_400 },
        text: "Segunda frase.",
      },
      {
        offsets: { from: 5_500, to: 5_500 },
        text: "Cue inválido",
      },
    ],
  }));

  assert.equal(parsed.language, "es");
  assert.deepEqual(parsed.cues, [
    { start: 0.12, end: 2.85, text: "Primera frase sincronizada." },
    { start: 2.97, end: 5.4, text: "Segunda frase." },
  ]);
});

test("rechaza una transcripción local sin voz utilizable", () => {
  assert.throws(
    () => parseLocalTranscription(JSON.stringify({ result: { language: "es" }, transcription: [] })),
    /no detectó voz suficiente/,
  );
});
