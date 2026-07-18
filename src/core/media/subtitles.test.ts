import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { writeAssSubtitles } from "./subtitles.js";
import { systemToolPath } from "./bintools.js";

test("ASS fija 1080x1920, zona segura inferior y frases cortas", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rrss-subs-"));
  try {
    assert.equal(writeAssSubtitles(dir, "Esta es una frase de prueba para comprobar subtítulos siempre visibles abajo.", 4), true);
    const ass = fs.readFileSync(path.join(dir, "subs.ass"), "utf8");
    assert.match(ass, /PlayResX: 1080/);
    assert.match(ass, /PlayResY: 1920/);
    assert.match(ass, /,2,100,100,230,1/);
    assert.match(ass, /Dialogue: 0,/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("el FFmpeg detectado puede quemar los subtítulos ASS", (t) => {
  const ffmpeg = systemToolPath("ffmpeg");
  if (!ffmpeg) return t.skip("FFmpeg opcional no instalado");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rrss-libass-"));
  try {
    writeAssSubtitles(dir, "Subtítulo de control visible abajo.", 1);
    execFileSync(ffmpeg, [
      "-y", "-f", "lavfi", "-i", "color=c=black:s=540x960:d=1",
      "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "input.mp4",
    ], { cwd: dir, stdio: "ignore" });
    execFileSync(ffmpeg, [
      "-y", "-i", "input.mp4", "-vf", "ass=subs.ass", "-c:v", "libx264", "-c:a", "copy", "output.mp4",
    ], { cwd: dir, stdio: "ignore" });
    assert.ok(fs.statSync(path.join(dir, "output.mp4")).size > 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
