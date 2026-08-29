import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { TranscriptCue } from "./contracts.js";
import { getDataDir } from "../runtime/e2e-profile.js";

const execFileAsync = promisify(execFile);
const LOCAL_ROOT = path.join(getDataDir(), "tools", "whisper-cpp");
const BINARY = path.join(LOCAL_ROOT, "bin", "Release", "whisper-cli.exe");
const MODEL = path.join(LOCAL_ROOT, "models", "ggml-small.bin");

export interface LocalTranscription {
  language: string;
  languageProbability: number;
  cues: TranscriptCue[];
}

export function hasLocalWhisper(): boolean {
  return fs.existsSync(BINARY)
    && fs.existsSync(MODEL)
    && fs.statSync(MODEL).size > 400 * 1024 * 1024;
}

export function localWhisperToolStatus() {
  const found = hasLocalWhisper();
  return {
    name: "whisper",
    label: "Whisper local",
    found,
    path: found ? BINARY : "",
    version: found ? "whisper.cpp v1.9.1 · modelo small multilingüe" : "",
    source: found ? "project" : "missing",
    installHint: "Instalación local requerida en data/tools/whisper-cpp.",
  };
}

export async function transcribeLocalAudio(
  audioPath: string,
  language?: string,
): Promise<LocalTranscription> {
  if (!hasLocalWhisper()) {
    throw new Error(
      "Whisper local no está preparado. Reinstala el motor local desde RRSS Studio.",
    );
  }
  const outputBase = path.join(
    path.dirname(audioPath),
    `whisper-${process.pid}-${crypto.randomUUID().slice(0, 8)}`,
  );
  const selectedLanguage = language && /^[a-z]{2}$/i.test(language.trim())
    ? language.trim().toLowerCase()
    : "auto";
  try {
    await execFileAsync(
      BINARY,
      [
        "-m", MODEL,
        "-f", audioPath,
        "-l", selectedLanguage,
        "-ng",
        "-ojf",
        "-of", outputBase,
        "-ml", "42",
        "-sow",
        "-np",
        "-t", String(Math.max(2, Math.min(8, os.cpus().length - 1))),
      ],
      {
        cwd: path.dirname(BINARY),
        timeout: 20 * 60_000,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        encoding: "utf8",
      },
    );
    const outputPath = `${outputBase}.json`;
    if (!fs.existsSync(outputPath)) {
      throw new Error("Whisper local no generó su transcripción JSON.");
    }
    return parseLocalTranscription(fs.readFileSync(outputPath, "utf8"));
  } catch (error) {
    const detail = error && typeof error === "object" && "stderr" in error
      ? String((error as { stderr?: unknown }).stderr ?? "").trim()
      : "";
    const message = error instanceof Error ? error.message : "";
    throw new Error(
      detail
        ? `Whisper local no pudo transcribir el corte: ${detail.split(/\r?\n/).at(-1)}`
        : message || "Whisper local no pudo transcribir el corte.",
    );
  } finally {
    fs.rmSync(`${outputBase}.json`, { force: true });
  }
}

export function parseLocalTranscription(raw: string): LocalTranscription {
  const parsed = JSON.parse(raw) as {
    result?: { language?: unknown };
    transcription?: unknown;
  };
  const cues = (Array.isArray(parsed.transcription) ? parsed.transcription : [])
    .flatMap((entry): TranscriptCue[] => {
      if (!entry || typeof entry !== "object") return [];
      const cue = entry as Record<string, unknown>;
      const offsets = cue.offsets && typeof cue.offsets === "object"
        ? cue.offsets as Record<string, unknown>
        : {};
      const start = Number(offsets.from) / 1000;
      const end = Number(offsets.to) / 1000;
      const text = typeof cue.text === "string" ? cue.text.trim() : "";
      if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.08 || !text) return [];
      return [{ start: Math.max(0, start), end, text }];
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (cues.length === 0) {
    throw new Error("Whisper local no detectó voz suficiente en este corte.");
  }
  return {
    language: typeof parsed.result?.language === "string" ? parsed.result.language : "",
    languageProbability: 0,
    cues,
  };
}
