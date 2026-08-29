import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { resolveE2EGateStatus } from "./e2e-gate.mjs";
import {
  acquireE2ERunnerLock,
  buildE2EEnvironment,
  cleanupE2EResources,
  createE2ESourceSnapshot,
  prepareE2ERun,
  resolveE2ERunLayout,
} from "./e2e-runtime.mjs";

const startedAt = Date.now();
const cwd = process.cwd();
const runId = `run-${Date.now().toString(36)}-${process.pid}`;
const layout = resolveE2ERunLayout(cwd, runId);
const { dataDir, sourceRoot } = layout;
const databasePath = path.join(dataDir, "e2e.db");
const resultDir = path.join(cwd, "test-results");
const appPort = await findFreePort();
let fixturePort = await findFreePort();
while (fixturePort === appPort) fixturePort = await findFreePort();
const runnerLock = acquireE2ERunnerLock(layout.runtimeParent, { pid: process.pid, runId });

const env = buildE2EEnvironment({
  ...process.env,
  RRSS_E2E_PARENT_SECRET_SENTINEL: "must-not-reach-child",
}, {
  RRSS_E2E_MODE: "mock",
  RRSS_E2E_RUN_ID: runId,
  RRSS_DATA_DIR: dataDir,
  DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`,
  RRSS_E2E_APP_PORT: String(appPort),
  RRSS_E2E_FIXTURE_PORT: String(fixturePort),
  RRSS_E2E_FIXTURE_URL: `http://127.0.0.1:${fixturePort}`,
  RRSS_NEXT_DIST_DIR: ".next-e2e",
  RRSS_E2E_NEXT_DEV: "false",
});

let status = 1;
let server;
let mockRuntime;
let cleanupPromise;
const cleanupResources = () => {
  cleanupPromise ??= cleanupE2EResources(layout, runnerLock, server);
  return cleanupPromise;
};
const cleanAfterSignal = (exitCode) => {
  void cleanupResources().then(
    () => process.exit(exitCode),
    () => process.exit(exitCode),
  );
};
const onSigint = () => cleanAfterSignal(130);
const onSigterm = () => cleanAfterSignal(143);
process.once("SIGINT", onSigint);
process.once("SIGTERM", onSigterm);
try {
  prepareE2ERun(layout);
  createE2ESourceSnapshot(layout);
  const database = spawnSync(process.execPath, [
    path.join(cwd, "node_modules/prisma/build/index.js"), "db", "push", "--skip-generate",
    "--schema", path.join(sourceRoot, "prisma/schema.prisma"),
  ], {
    cwd: sourceRoot,
    env: { ...env, RUST_LOG: "info" },
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
  if (database.status !== 0) throw new Error("No se pudo preparar la SQLite temporal E2E.");

  const build = spawnSync(process.execPath, [
    path.join(cwd, "node_modules/next/dist/bin/next"), "build", sourceRoot,
  ], {
    cwd,
    env,
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
  if (build.status !== 0) throw new Error("No se pudo crear el build aislado para E2E.");

  server = spawn(process.execPath, [path.join(sourceRoot, "e2e/app-server.mjs")], {
    cwd,
    env,
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
  await waitForReady(`http://127.0.0.1:${appPort}/api/e2e/status`, runId, server);
  await warmRoutes(appPort, [
    "/api/e2e/status",
    "/",
    "/ajustes",
    "/api/connectors",
    "/proyecto/nuevo",
    "/proyecto/e2e-warmup",
    "/api/projects/e2e-warmup",
    "/api/dossier/e2e-warmup",
    "/api/navigation/e2e-warmup",
    "/api/competencia/e2e-warmup",
    "/api/leads/e2e-warmup",
    "/api/virales/e2e-warmup",
    "/api/content/e2e-warmup",
    "/api/projects/e2e-warmup/competencia/run",
    "/api/projects/e2e-warmup/leads/run",
    "/api/projects/e2e-warmup/virales/run",
    "/api/projects/e2e-warmup/content/run",
    "/api/projects/e2e-warmup/content/demo/run",
    "/api/projects/e2e-warmup/login",
    "/api/providers/heygen/options?kind=avatar",
    "/api/clips",
    "/clips",
    "/api/e2e/scenario",
    "/api/e2e/egress-probe",
  ]);

  const playwright = spawnSync(process.execPath, ["node_modules/playwright/cli.js", "test", ...process.argv.slice(2)], {
    cwd,
    env,
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
  status = playwright.status ?? 1;
} finally {
  try {
    mockRuntime = await readRuntimeReport(appPort, runId);
  } catch {
    status = 1;
  }
  status = resolveE2EGateStatus(status, mockRuntime);
  fs.mkdirSync(resultDir, { recursive: true });
  fs.writeFileSync(path.join(resultDir, "e2e-summary.json"), JSON.stringify({
    profile: "mock",
    runId,
    status: status === 0 ? "passed" : "failed",
    externalRequestsPerformed: mockRuntime?.performedExternalRequests ?? null,
    mockRuntime: mockRuntime ?? { error: "E2E_EVIDENCE_UNAVAILABLE" },
    durationMs: Date.now() - startedAt,
  }, null, 2));
  try {
    await cleanupResources();
  } finally {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
  }
}

process.exitCode = status;

async function waitForReady(url, expectedRunId, child) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("El servidor E2E terminó antes de estar listo.");
    try {
      const response = await fetch(url);
      const body = response.ok ? await response.json() : null;
      if (body?.runId === expectedRunId && body.parentSecretPresent === false) return;
    } catch {
      // El arranque y la compilación inicial todavía están en curso.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timeout esperando el servidor E2E local.");
}

async function findFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!port) throw new Error("No se pudo reservar un puerto local para E2E.");
  return port;
}

async function readRuntimeReport(port, expectedRunId) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/e2e/status`, {
        signal: AbortSignal.timeout(5_000),
      });
      const report = await response.json();
      if (response.ok && report.runId === expectedRunId && report.mockRuntime) {
        return report.mockRuntime;
      }
      lastError = new Error("El informe E2E no corresponde a la ejecución actual.");
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError ?? new Error("No se pudo recoger el informe E2E.");
}

async function warmRoutes(port, routes) {
  for (const route of routes) {
    try {
      await fetch(`http://127.0.0.1:${port}${route}`, {
        signal: AbortSignal.timeout(180_000),
      });
    } catch {
      // Una ruta dinámica inexistente puede responder error; el objetivo es compilarla localmente.
    }
  }
}
