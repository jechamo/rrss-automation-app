import test from "node:test";
import assert from "node:assert/strict";
import {
  clipDownloadFormatSelector,
  isClipDownloadCandidate,
} from "./ytdlp-contracts.js";

test("el selector de clips prioriza 720p dentro de un presupuesto y degrada a 480p", () => {
  const selector = clipDownloadFormatSelector(2_048);

  assert.match(selector, /height<=720/);
  assert.match(selector, /filesize<=1848M/);
  assert.match(selector, /height<=480/);
  assert.ok(selector.endsWith("/b"));
});

test("reconoce salidas finales de yt-dlp y excluye fragmentos parciales", () => {
  assert.equal(isClipDownloadCandidate("source.mp4"), true);
  assert.equal(isClipDownloadCandidate("source.f298.mp4"), true);
  assert.equal(isClipDownloadCandidate("source.webm"), true);
  assert.equal(isClipDownloadCandidate("source.f299.mp4.part"), false);
  assert.equal(isClipDownloadCandidate("manifest.json"), false);
});
