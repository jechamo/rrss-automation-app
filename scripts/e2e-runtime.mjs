import fs from "node:fs";
import path from "node:path";

const RUN_ID = /^run-[a-z0-9-]{6,63}$/u;
const SOURCE_ENTRIES = [
  "e2e",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "postcss.config.mjs",
  "prisma",
  "public",
  "src",
  "tsconfig.json",
  "vitest.config.ts",
];
const SAFE_ENVIRONMENT_KEYS = [
  "APPDATA",
  "CI",
  "COMSPEC",
  "GITHUB_ACTIONS",
  "HOME",
  "LOCALAPPDATA",
  "NUMBER_OF_PROCESSORS",
  "PATH",
  "PATHEXT",
  "PROCESSOR_ARCHITECTURE",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "TMPDIR",
  "USERPROFILE",
  "WINDIR",
];

export function resolveE2ERunLayout(cwd, runId) {
  const projectRoot = path.resolve(cwd);
  if (!RUN_ID.test(runId)) throw new Error("E2E_PROFILE_INVALID: run id no seguro.");
  const runtimeParent = path.join(projectRoot, ".e2e-runtime");
  const runRoot = path.join(runtimeParent, runId);
  const dataDir = path.join(runRoot, "data");
  const sourceRoot = path.join(runRoot, "source");
  const nextRoot = path.join(projectRoot, ".next-e2e");
  if (path.dirname(runRoot) !== runtimeParent || runRoot === path.join(projectRoot, "data")) {
    throw new Error("E2E_PROFILE_INVALID: destino temporal no seguro.");
  }
  return { projectRoot, runtimeParent, runRoot, dataDir, sourceRoot, nextRoot };
}

export function prepareE2ERun(layout) {
  assertLayout(layout);
  fs.rmSync(layout.runRoot, { recursive: true, force: true });
  fs.rmSync(layout.nextRoot, { recursive: true, force: true });
  fs.mkdirSync(layout.dataDir, { recursive: true });
}

export function createE2ESourceSnapshot(layout) {
  assertLayout(layout);
  fs.mkdirSync(layout.sourceRoot, { recursive: true });
  for (const entry of SOURCE_ENTRIES) {
    const source = path.join(layout.projectRoot, entry);
    if (!fs.existsSync(source)) continue;
    fs.cpSync(source, path.join(layout.sourceRoot, entry), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  }
}

export function buildE2EEnvironment(parentEnvironment, overrides) {
  const environment = {};
  for (const expectedKey of SAFE_ENVIRONMENT_KEYS) {
    const actualKey = Object.keys(parentEnvironment).find(
      (key) => key.toLocaleUpperCase("en-US") === expectedKey,
    );
    if (actualKey && parentEnvironment[actualKey] !== undefined) {
      environment[actualKey] = parentEnvironment[actualKey];
    }
  }
  return { ...environment, ...overrides };
}

export function acquireE2ERunnerLock(runtimeParent, owner, isProcessAlive = processIsAlive) {
  fs.mkdirSync(runtimeParent, { recursive: true });
  const lockPath = path.join(runtimeParent, "runner.lock");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = fs.openSync(lockPath, "wx");
      fs.writeFileSync(handle, JSON.stringify(owner));
      return { handle, lockPath, owner };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const current = readLockOwner(lockPath);
      if (current && isProcessAlive(current.pid)) {
        throw new Error("E2E_CONCURRENT_RUN: ya existe una validación E2E en curso.");
      }
      fs.rmSync(lockPath, { force: true });
    }
  }
  throw new Error("E2E_CONCURRENT_RUN: no se pudo adquirir el lock de validación.");
}

export function releaseE2ERunnerLock(lock) {
  try {
    fs.closeSync(lock.handle);
  } catch {
    // El descriptor puede haberse cerrado durante una señal previa.
  }
  const current = readLockOwner(lock.lockPath);
  if (current?.pid === lock.owner.pid && current.runId === lock.owner.runId) {
    fs.rmSync(lock.lockPath, { force: true });
  }
}

export async function stopChildProcess(child, timeoutMs = 3_000) {
  if (!child || childHasExited(child)) return;
  try {
    child.kill("SIGTERM");
  } catch {
    // Se comprueba exitCode y se escala de forma acotada.
  }
  await waitForExit(child, timeoutMs);
  if (childHasExited(child)) return;
  try {
    child.kill("SIGKILL");
  } catch {
    // La espera final confirma si el proceso liberó sus handles.
  }
  await waitForExit(child, timeoutMs);
  if (!childHasExited(child)) {
    throw new Error("E2E_SERVER_STUCK: el servidor no liberó sus recursos tras SIGKILL.");
  }
}

export async function cleanupE2EResources(
  layout,
  lock,
  child,
  options = {},
) {
  const timeoutMs = options.timeoutMs ?? 3_000;
  const clean = options.clean ?? cleanE2ERun;
  const release = options.release ?? releaseE2ERunnerLock;
  await stopChildProcess(child, timeoutMs);
  try {
    clean(layout);
  } finally {
    release(lock);
  }
}

export function cleanE2ERun(layout) {
  assertLayout(layout);
  fs.rmSync(layout.runRoot, { recursive: true, force: true });
  fs.rmSync(layout.nextRoot, { recursive: true, force: true });
}

function assertLayout(layout) {
  const expected = resolveE2ERunLayout(layout.projectRoot, path.basename(layout.runRoot));
  for (const key of ["runtimeParent", "runRoot", "dataDir", "sourceRoot", "nextRoot"]) {
    if (path.resolve(layout[key]) !== path.resolve(expected[key])) {
      throw new Error("E2E_PROFILE_INVALID: limpieza fuera del run aislado.");
    }
  }
}

function readLockOwner(lockPath) {
  try {
    const value = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    return Number.isSafeInteger(value?.pid) && typeof value?.runId === "string" ? value : null;
  } catch {
    return null;
  }
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function waitForExit(child, timeoutMs) {
  if (childHasExited(child)) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("exit", finish);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    child.once("exit", finish);
    if (childHasExited(child)) finish();
  });
}

function childHasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}
