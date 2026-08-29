import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
  acquireE2ERunnerLock,
  buildE2EEnvironment,
  cleanE2ERun,
  cleanupE2EResources,
  createE2ESourceSnapshot,
  prepareE2ERun,
  releaseE2ERunnerLock,
  resolveE2ERunLayout,
} from "../../../scripts/e2e-runtime.mjs";

let syntheticRoot;

afterEach(() => {
  if (syntheticRoot) fs.rmSync(syntheticRoot, { recursive: true, force: true });
  syntheticRoot = undefined;
});

describe("integridad entre una instalación normal sintética y dos runs E2E", () => {
  it("recupera un lock huérfano pero rechaza un proceso vivo", () => {
    syntheticRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rrss e2e lock "));
    const runtimeParent = path.join(syntheticRoot, ".e2e-runtime");
    fs.mkdirSync(runtimeParent, { recursive: true });
    fs.writeFileSync(path.join(runtimeParent, "runner.lock"), JSON.stringify({
      pid: 999_999,
      runId: "run-stale-lock",
    }));

    const recovered = acquireE2ERunnerLock(runtimeParent, {
      pid: 123,
      runId: "run-new-lock",
    }, () => false);
    expect(() => acquireE2ERunnerLock(runtimeParent, {
      pid: 456,
      runId: "run-other-lock",
    }, () => true)).toThrow(/E2E_CONCURRENT_RUN/u);
    releaseE2ERunnerLock(recovered);
    expect(fs.existsSync(path.join(runtimeParent, "runner.lock"))).toBe(false);
  });

  it("espera al hijo vivo y libera el lock incluso si la limpieza falla", async () => {
    syntheticRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rrss e2e signal "));
    const layout = resolveE2ERunLayout(syntheticRoot, "run-signal-cleanup");
    prepareE2ERun(layout);
    const lock = acquireE2ERunnerLock(layout.runtimeParent, {
      pid: process.pid,
      runId: "run-signal-cleanup",
    });
    const child = new EventEmitter();
    child.exitCode = null;
    child.signalCode = null;
    child.signals = [];
    child.kill = (signal) => {
      child.signals.push(signal);
      if (signal === "SIGKILL") {
        child.signalCode = "SIGKILL";
        queueMicrotask(() => child.emit("exit", null, "SIGKILL"));
      }
      return true;
    };
    let released = false;

    await expect(cleanupE2EResources(layout, lock, child, {
      timeoutMs: 5,
      clean: () => { throw new Error("limpieza simulada fallida"); },
      release: (ownedLock) => {
        releaseE2ERunnerLock(ownedLock);
        released = true;
      },
    })).rejects.toThrow(/limpieza simulada fallida/u);
    expect(child.signals).toEqual(["SIGTERM", "SIGKILL"]);
    expect(released).toBe(true);
    expect(fs.existsSync(path.join(layout.runtimeParent, "runner.lock"))).toBe(false);
  });

  it("elimina secretos heredados y copia una fuente sin archivos de entorno", () => {
    syntheticRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rrss e2e source "));
    fs.mkdirSync(path.join(syntheticRoot, "src"), { recursive: true });
    fs.writeFileSync(path.join(syntheticRoot, "src", "fixture.ts"), "export const ok = true;");
    fs.writeFileSync(path.join(syntheticRoot, ".env"), "REAL_PROVIDER_KEY=no-debe-copiarse");
    const layout = resolveE2ERunLayout(syntheticRoot, "run-isolation-source");
    prepareE2ERun(layout);
    createE2ESourceSnapshot(layout);

    expect(fs.readFileSync(path.join(layout.sourceRoot, "src", "fixture.ts"), "utf8"))
      .toContain("ok = true");
    expect(fs.existsSync(path.join(layout.sourceRoot, ".env"))).toBe(false);
    expect(buildE2EEnvironment({
      PATH: "C:/Windows/System32",
      REAL_PROVIDER_KEY: "no-debe-heredarse",
    }, { RRSS_E2E_MODE: "mock" })).toEqual({
      PATH: "C:/Windows/System32",
      RRSS_E2E_MODE: "mock",
    });
  });

  it("conserva hashes y conteos y solo limpia cada run validado", () => {
    syntheticRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rrss e2e isolation "));
    const normalData = path.join(syntheticRoot, "data");
    fs.mkdirSync(path.join(normalData, "sessions"), { recursive: true });
    fs.mkdirSync(path.join(normalData, "media"), { recursive: true });
    fs.writeFileSync(path.join(normalData, ".vaultkey"), "clave-ficticia-no-real");
    fs.writeFileSync(path.join(normalData, "vault.enc"), "vault-ficticio-no-real");
    fs.writeFileSync(path.join(normalData, "sessions", "fixture.json"), "{\"session\":\"fake\"}");
    fs.writeFileSync(path.join(normalData, "media", "fixture.mp4"), "media-ficticio");
    const normalDb = new DatabaseSync(path.join(normalData, "dev.db"));
    normalDb.exec("CREATE TABLE Project (id TEXT PRIMARY KEY); CREATE TABLE ContentPiece (id TEXT PRIMARY KEY);");
    normalDb.exec("INSERT INTO Project VALUES ('project-fixture'); INSERT INTO ContentPiece VALUES ('piece-fixture');");
    normalDb.close();
    const before = snapshotNormal(normalData);

    for (const suffix of ["a", "b"]) {
      const layout = resolveE2ERunLayout(syntheticRoot, `run-isolation-${suffix}`);
      prepareE2ERun(layout);
      const isolatedDb = new DatabaseSync(path.join(layout.dataDir, "e2e.db"));
      isolatedDb.exec("CREATE TABLE Project (id TEXT PRIMARY KEY); INSERT INTO Project VALUES ('temporary');");
      isolatedDb.close();
      fs.writeFileSync(path.join(layout.dataDir, "vault.enc"), `run-${suffix}`);
      cleanE2ERun(layout);
      expect(fs.existsSync(layout.runRoot)).toBe(false);
      expect(snapshotNormal(normalData)).toEqual(before);
    }
  });
});

function snapshotNormal(dataDir) {
  const db = new DatabaseSync(path.join(dataDir, "dev.db"), { readOnly: true });
  const counts = {
    projects: Number(db.prepare("SELECT COUNT(*) AS total FROM Project").get().total),
    pieces: Number(db.prepare("SELECT COUNT(*) AS total FROM ContentPiece").get().total),
  };
  db.close();
  const files = walk(dataDir).map((file) => ({
    path: path.relative(dataDir, file).replaceAll("\\", "/"),
    sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
  }));
  return { counts, files };
}

function walk(root) {
  return fs.readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const target = path.join(root, entry.name);
      return entry.isDirectory() ? walk(target) : [target];
    })
    .sort();
}
