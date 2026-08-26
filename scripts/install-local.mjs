#!/usr/bin/env node

import path from "node:path";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { classifyOptionalCapabilities } from "../src/core/installation/capabilities.mjs";
import { executeWithConsent } from "../src/core/installation/consent.mjs";
import { sanitizeDiagnostic } from "../src/core/installation/diagnostics.mjs";
import { createFilesystemAdapter } from "../src/core/installation/adapters/filesystem.mjs";
import { createPersistenceAdapter } from "../src/core/installation/adapters/persistence.mjs";
import {
  createPortAdapter,
  parseWindowsNetstat,
} from "../src/core/installation/adapters/port.mjs";
import {
  assertWindowsSystemExecutable,
  createProcessAdapter,
} from "../src/core/installation/adapters/process.mjs";
import {
  resolveProjectPath,
  resolveProjectWritePath,
} from "../src/core/installation/paths.mjs";
import { runPrecheck } from "../src/core/installation/precheck.mjs";
import {
  createPreparationReceipt,
  REQUIRED_CHECK_MANIFEST,
} from "../src/core/installation/receipt.mjs";

const SUPPORTED_OPERATIONS = new Set(["check", "prepare", "reset", "start"]);

export function resolveNpmCliPath({
  nodeExecutable = process.execPath,
  npmExecPath = process.env.npm_execpath,
  exists = existsSync,
  candidates,
} = {}) {
  const nodeDirectory = path.dirname(nodeExecutable);
  const approvedCandidates = [
    npmExecPath,
    path.join(nodeDirectory, "node_modules", "npm", "bin", "npm-cli.js"),
    process.env.APPDATA
      ? path.join(process.env.APPDATA, "npm", "node_modules", "npm", "bin", "npm-cli.js")
      : undefined,
    process.env.ProgramFiles
      ? path.join(process.env.ProgramFiles, "nodejs", "node_modules", "npm", "bin", "npm-cli.js")
      : undefined,
    ...(candidates ?? []),
  ];
  const npmCliPath = approvedCandidates.find(
    (candidate) =>
      typeof candidate === "string" &&
      path.isAbsolute(candidate) &&
      path.basename(candidate).toLowerCase() === "npm-cli.js" &&
      exists(candidate),
  );
  if (!npmCliPath) {
    const error = new Error("No se encontró la instalación local de npm.");
    error.code = "NPM_CLI_NOT_FOUND";
    throw error;
  }
  return path.resolve(npmCliPath);
}

export function parseOperation(argv = process.argv) {
  const operation = argv[2] ?? "check";
  if (!SUPPORTED_OPERATIONS.has(operation)) {
    const error = new Error("Operación de instalación no válida.");
    error.code = "INVALID_INSTALLATION_OPERATION";
    throw error;
  }
  return operation;
}

export function parseCliOptions(argv = process.argv) {
  const operation = parseOperation(argv);
  const flags = argv.slice(3);
  const unsupportedFlag = flags.find((flag) => flag !== "--yes");
  if (unsupportedFlag || (flags.includes("--yes") && operation !== "prepare")) {
    const error = new Error("Opción de instalación no válida.");
    error.code = "INVALID_INSTALLATION_OPERATION";
    throw error;
  }
  return {
    operation,
    assumePreparationConsent: flags.includes("--yes"),
  };
}

export function createLocalInstallationRuntime({
  projectRoot = fileURLToPath(new URL("..", import.meta.url)),
  platform = { name: process.platform, release: os.release() },
  system = {},
} = {}) {
  const nodeExecutable = path.resolve(system.nodeExecutable ?? process.execPath);
  const localSystem = {
    exists: system.exists ?? existsSync,
    readText: system.readText ?? ((filePath) => readFileSync(filePath, "utf8")),
    stat: system.stat ?? ((filePath) => statSync(filePath, { bigint: true })),
    realpath: system.realpath ?? realpathSync.native,
    makeDirectory:
      system.makeDirectory ??
      ((directoryPath) => mkdirSync(directoryPath, { recursive: true })),
    copy: system.copy ?? copyFileSync,
    move: system.move ?? renameSync,
    writeText:
      system.writeText ??
      ((filePath, content) => writeFileSync(filePath, content, "utf8")),
    spawnSync: system.spawnSync ?? spawnSync,
    spawn: system.spawn ?? spawn,
    inspectPort:
      system.inspectPort ??
      ((port) =>
        probeWindowsPort({
          port,
          spawnProcess: system.spawnSync ?? spawnSync,
          systemRoot: system.systemRoot ?? process.env.SystemRoot ?? "C:\\Windows",
          canonicalize:
            system.canonicalizeSystemExecutable ??
            system.realpath ??
            realpathSync.native,
          netstatExecutable:
            system.netstatExecutable ??
            path.join(
              process.env.SystemRoot ?? "C:\\Windows",
              "System32",
              "netstat.exe",
            ),
        })),
    inspectHealth:
      system.inspectHealth ??
      (() => inspectReadyEndpoint()),
    detectBrowser:
      system.detectBrowser ??
      (() => detectPlaywrightChromium({ projectRoot, exists: localSystem.exists })),
    optionalCapabilities: system.optionalCapabilities,
    pathEnvironment: system.pathEnvironment ?? process.env.PATH ?? "",
    appVersion: system.appVersion,
    now: system.now ?? Date.now,
    sleep:
      system.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds))),
    startTimeoutMs: system.startTimeoutMs ?? 15_000,
    startPollIntervalMs: system.startPollIntervalMs ?? 250,
    portReleaseTimeoutMs: system.portReleaseTimeoutMs ?? 5_000,
    portReleasePollIntervalMs: system.portReleasePollIntervalMs ?? 100,
  };
  const filesystem = createFilesystemAdapter({
    exists: localSystem.exists,
    resolveProjectPath,
  });
  const persistence = createPersistenceAdapter({ filesystem });
  const port = createPortAdapter({ inspect: localSystem.inspectPort });
  let processRuntime;
  function getProcessRuntime() {
    if (processRuntime) {
      return processRuntime;
    }
    const npmCliPath = resolveNpmCliPath({
      nodeExecutable,
      npmExecPath:
        system.npmCliPath ??
        system.npmExecPath ??
        process.env.npm_execpath,
      exists: localSystem.exists,
      candidates: system.npmCliCandidates,
    });
    processRuntime = {
      npmCliPath,
      processes: createProcessAdapter({
        projectRoot,
        nodeExecutable,
        npmCliPath,
        taskkillExecutable:
          system.taskkillExecutable ??
          path.join(
            process.env.SystemRoot ?? "C:\\Windows",
            "System32",
            "taskkill.exe",
          ),
        systemRoot: system.systemRoot ?? process.env.SystemRoot ?? "C:\\Windows",
        canonicalize:
          system.canonicalizeSystemExecutable ?? localSystem.realpath,
        spawn: localSystem.spawnSync,
      }),
      devProcesses: createProcessAdapter({
        projectRoot,
        nodeExecutable,
        npmCliPath,
        spawn: localSystem.spawn,
      }),
    };
    return processRuntime;
  }

  async function check(expectedPid) {
    const marker = inspectManagedMarker({
      projectRoot,
      system: localSystem,
    });
    const portObservation = await port.inspectAsync(3000);
    let npmResult = { status: 1 };
    try {
      const { npmCliPath, processes } = getProcessRuntime();
      npmResult = processes.invoke({
        executable: nodeExecutable,
        argv: [npmCliPath, "--version"],
        shell: false,
        cwd: projectRoot,
      });
    } catch (error) {
      if (error?.code !== "NPM_CLI_NOT_FOUND") {
        throw error;
      }
    }
    const persistenceObservation = persistence.inspect({
      projectRoot,
      databasePath: path.join("prisma", "dev.db"),
      sidecarPaths: [
        path.join("prisma", "dev.db-wal"),
        path.join("prisma", "dev.db-shm"),
      ],
      preparationStatus: marker.valid ? "prepared" : "pending",
      managed: marker.valid,
    });
    const required = [
      requiredCheck(
        "windows-11",
        "platform",
        isWindows11(platform),
      ),
      requiredCheck(
        "node-npm-runtime",
        "runtime",
        nodeMajor(process.versions.node) >= 20 && npmResult?.status === 0,
      ),
      requiredCheck(
        "project-dependencies",
        "dependencies",
        filesystem.observePresence({
          projectRoot,
          candidatePath: "node_modules",
        }).present,
      ),
      requiredCheck(
        "configuration-template",
        "configuration",
        filesystem.observePresence({
          projectRoot,
          candidatePath: ".env.example",
        }).present &&
          localSystem.exists(path.join(projectRoot, ".env")),
      ),
      persistenceObservation.check,
      requiredCheck(
        "local-port-process",
        "process",
        portObservation.status === "available" ||
          (portObservation.status === "occupied" &&
            Number.isInteger(expectedPid) &&
            portObservation.pid === expectedPid),
      ),
    ];
    const optionalCapabilities =
      localSystem.optionalCapabilities ??
      defaultOptionalCapabilities({
        exists: localSystem.exists,
        pathEnvironment: localSystem.pathEnvironment,
        browserAvailable: await localSystem.detectBrowser(),
      });
    const receipt = runPrecheck({
      required,
      optional: classifyOptionalCapabilities(optionalCapabilities),
    });
    return { receipt, observations: { marker, port: portObservation } };
  }

  function performProjectPreparation(backupPaths = []) {
    const { processes } = getProcessRuntime();
    if (backupPaths.length > 0) {
      const backupDirectory = path.join(
        "data",
        "installation",
        "backups",
        String(localSystem.now()),
      );
      const safeBackupDirectory = resolveProjectWritePath(
        projectRoot,
        backupDirectory,
      );
      localSystem.makeDirectory(safeBackupDirectory);
      for (const sourcePath of backupPaths) {
        const safeSource = resolveProjectPath(
          projectRoot,
          path.relative(projectRoot, sourcePath),
        );
        localSystem.move(
          safeSource,
          resolveProjectWritePath(
            projectRoot,
            path.join(backupDirectory, path.basename(sourcePath)),
          ),
        );
      }
    }
    resolveProjectWritePath(projectRoot, "node_modules");
    invokeRequiredProcess(
      processes,
      localSystem.exists(path.join(projectRoot, "package-lock.json"))
        ? ["ci"]
        : ["install"],
      "dependencies",
      projectRoot,
      "dependency-install",
    );
    if (!localSystem.exists(path.join(projectRoot, ".env"))) {
      localSystem.copy(
        resolveProjectPath(projectRoot, ".env.example"),
        resolveProjectWritePath(projectRoot, ".env"),
      );
    }
    invokeRequiredProcess(
      processes,
      ["run", "db:generate"],
      "data",
      projectRoot,
      "database-client",
    );
    resolveProjectWritePath(projectRoot, path.join("prisma", "dev.db"));
    invokeRequiredProcess(
      processes,
      ["run", "db:push"],
      "data",
      projectRoot,
      "database-initialization",
    );
    invokeRequiredProcess(
      processes,
      ["run", "build"],
      "dependencies",
      projectRoot,
      "application-build",
    );
    const markerDirectory = resolveProjectWritePath(
      projectRoot,
      path.join(
      "data",
      "installation",
      ),
    );
    localSystem.makeDirectory(markerDirectory);
    localSystem.writeText(
      resolveProjectWritePath(
        projectRoot,
        path.join("data", "installation", "managed-v1.json"),
      ),
      `${JSON.stringify(createManagedMarker({
        projectRoot,
        system: localSystem,
      }))}\n`,
    );
  }

  async function prepare(input) {
    const initial = await check();
    const markerValid = initial.observations.marker.valid;
    const unknownPersistence =
      !markerValid &&
      [
        path.join(projectRoot, "prisma", "dev.db"),
        path.join(projectRoot, "prisma", "dev.db-wal"),
        path.join(projectRoot, "prisma", "dev.db-shm"),
      ].some(localSystem.exists);
    if (
      unknownPersistence ||
      !preparationPrerequisitesReady(initial.receipt)
    ) {
      return initial;
    }
    const request = createConsentRequest(
      "project-preparation",
      "preparación dentro del proyecto",
    );
    const consent = executeWithConsent({
      request,
      confirmation: confirmationFor(input ?? {}, request.effect),
      effect: performProjectPreparation,
    });
    if (!consent.executed) {
      return {
        receipt: blockedByRejectedConsent(
          initial.receipt,
          "project-preparation",
        ),
        consentRequests: [request],
        technicalFailure: false,
      };
    }
    return {
      ...(await check()),
      consentRequests: [request],
      technicalFailure: false,
    };
  }

  async function reset(input) {
    const initial = await check();
    const dataBlocked = initial.receipt.required.some(
      (check) =>
        check.id === "local-persistence" && check.status === "blocked",
    );
    const dataPaths = [
      path.join(projectRoot, "prisma", "dev.db"),
      path.join(projectRoot, "prisma", "dev.db-wal"),
      path.join(projectRoot, "prisma", "dev.db-shm"),
    ];
    const presentData = dataPaths.filter(localSystem.exists);
    if (
      !dataBlocked ||
      presentData.length === 0 ||
      !preparationPrerequisitesReady(initial.receipt)
    ) {
      return initial;
    }
    const request = createConsentRequest(
      "data-reset",
      "datos locales protegidos",
    );
    let consent;
    try {
      consent = executeWithConsent({
        request,
        confirmation: confirmationFor(input ?? {}, request.effect),
        effect: () => performProjectPreparation(presentData),
      });
    } catch {
      throw new InstallationStepFailure({
        category: "data",
        receipt: initial.receipt,
        recovery: "backup-preserved",
      });
    }
    if (!consent.executed) {
      return {
        receipt: initial.receipt,
        consentRequests: [request],
        technicalFailure: false,
      };
    }
    return {
      ...(await check()),
      consentRequests: [request],
      technicalFailure: false,
    };
  }

  async function start(input) {
    const { npmCliPath, processes, devProcesses } = getProcessRuntime();
    const initial = await check();
    if (!startPrerequisitesReady(initial.receipt)) {
      return initial;
    }
    const request = createConsentRequest(
      "process",
      "inicio del proceso local",
    );
    const consentRequests = [request];
    const suppliedConfirmation = confirmationFor(
      input ?? {},
      request.effect,
    );
    if (suppliedConfirmation?.approved !== true) {
      return {
        ...initial,
        receipt: blockedByRejectedConsent(initial.receipt, "process"),
        consentRequests,
        ...(initial.observations.port.status === "occupied"
          ? {
              processConfirmation: {
                port: initial.observations.port.port,
                pid: initial.observations.port.pid,
              },
            }
          : {}),
        technicalFailure: false,
      };
    }
    if (initial.observations.port.status === "occupied") {
      const currentObservation = await port.inspectAsync(3000);
      const stillSameProcess =
        currentObservation.status === "occupied" &&
        currentObservation.pid === initial.observations.port.pid;
      if (!stillSameProcess) {
        return {
          receipt: withBlockedPort(initial.receipt),
          consentRequests,
          technicalFailure: false,
        };
      }
      const consent = executeWithConsent({
        request,
        confirmation: suppliedConfirmation,
        effect() {
          processes.terminateDetected({
            observation: currentObservation,
            confirmation: {
              confirmed:
                suppliedConfirmation.effect === "process" &&
                suppliedConfirmation.approved === true,
              port: suppliedConfirmation.port,
              pid: suppliedConfirmation.pid,
            },
          });
        },
      });
      if (!consent.executed) {
        return {
          ...initial,
          consentRequests,
          technicalFailure: false,
        };
      }
      const released = await waitForAvailablePort({
        port,
        localSystem,
      });
      if (released.status !== "available") {
        return {
          ...initial,
          consentRequests,
          technicalFailure: true,
        };
      }
    }
    const child = devProcesses.invoke({
      executable: nodeExecutable,
      argv: [npmCliPath, "run", "start"],
      shell: false,
      cwd: projectRoot,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    await waitForSpawn(child);
    if (!Number.isInteger(child?.pid) || child.pid <= 0) {
      return {
        receipt: withBlockedPort(initial.receipt),
        consentRequests,
        technicalFailure: true,
      };
    }
    child.unref();
    const startObservation = await waitForReadyApplication({
      child,
      port,
      localSystem,
    });
    const verified = await check(startObservation.pid);
    const portTransitionVerified =
      startObservation.status === "occupied" &&
      verified.observations.port.status === "occupied";
    return {
      ...verified,
      receipt: portTransitionVerified
        ? verified.receipt
        : withBlockedPort(verified.receipt),
      consentRequests,
      technicalFailure: !portTransitionVerified,
    };
  }

  return Object.freeze({
    async execute(operation, input = {}) {
      if (!isWindows11(platform)) {
        return {
          receipt: platformBlockedReceipt(),
          consentRequests: [],
          technicalFailure: false,
        };
      }
      if (operation === "check") {
        return check();
      }
      if (operation === "prepare") {
        try {
          return await prepare(input);
        } catch (error) {
          return {
            receipt: technicalFailureReceipt(error, (await check()).receipt),
            consentRequests: [],
            technicalFailure: true,
          };
        }
      }
      if (operation === "reset") {
        try {
          return await reset(input);
        } catch (error) {
          return {
            receipt: technicalFailureReceipt(error, (await check()).receipt),
            consentRequests: [],
            technicalFailure: true,
          };
        }
      }
      if (operation === "start") {
        try {
          return await start(input);
        } catch (error) {
          return {
            receipt: technicalFailureReceipt(error, (await check()).receipt),
            consentRequests: [],
            technicalFailure: true,
          };
        }
      }
      return {
        receipt: (await check()).receipt,
        consentRequests: [],
        technicalFailure: false,
      };
    },
  });
}

export async function main({
  argv = process.argv,
  createRuntime = createLocalInstallationRuntime,
  prompt = async () => false,
  output = isDirectExecution()
    ? { write: (line) => process.stdout.write(`${line}\n`) }
    : { write() {} },
  setExitCode = (code) => {
    process.exitCode = code;
  },
} = {}) {
  try {
    const { operation, assumePreparationConsent } = parseCliOptions(argv);
    const effectivePrompt = (request) =>
      assumePreparationConsent && request?.effect === "project-preparation"
        ? true
        : prompt(request);
    const runtime = createRuntime({ prompt: effectivePrompt, output });
    const result = await runInstallationAssistant({
      operation,
      runtime,
      prompt: effectivePrompt,
      output,
    });
    setExitCode(result.completed ? 0 : 1);
    return result;
  } catch (error) {
    const receipt = technicalFailureReceipt(error);
    renderReceipt(receipt, output);
    setExitCode(1);
    return {
      receipt,
      consentRequests: [],
      technicalFailure: true,
    };
  }
}

export function isDirectExecution(
  moduleUrl = import.meta.url,
  executablePath = process.argv[1],
) {
  if (typeof executablePath !== "string" || executablePath === "") {
    return false;
  }
  return pathToFileURL(path.resolve(executablePath)).href === moduleUrl;
}

function inspectManagedMarker({ projectRoot, system }) {
  const markerPath = resolveProjectPath(
    projectRoot,
    path.join(
    "data",
    "installation",
    "managed-v1.json",
    ),
  );
  if (!system.exists(markerPath)) {
    return { valid: false };
  }
  try {
    const parsed = JSON.parse(system.readText(markerPath));
    const expected = createManagedMarker({ projectRoot, system });
    return {
      valid:
        parsed?.version === expected.version &&
        parsed?.schemaSha256 === expected.schemaSha256 &&
        parsed?.appVersion === expected.appVersion &&
        parsed?.databaseFileId === expected.databaseFileId &&
        Object.keys(parsed).length === 4,
    };
  } catch {
    return { valid: false };
  }
}

function createManagedMarker({ projectRoot, system }) {
  const schema = system.readText(
    resolveProjectPath(projectRoot, path.join("prisma", "schema.prisma")),
  );
  const databaseStats = system.stat(
    resolveProjectPath(projectRoot, path.join("prisma", "dev.db")),
  );
  return {
    version: 1,
    schemaSha256: createHash("sha256").update(schema).digest("hex"),
    appVersion:
      system.appVersion ??
      readProjectAppVersion(projectRoot, system.readText),
    databaseFileId: stableFileIdentity(databaseStats),
  };
}

function stableFileIdentity(stats) {
  const inode = stats?.ino;
  if (
    (typeof inode === "bigint" && inode > 0n) ||
    (typeof inode === "number" && Number.isSafeInteger(inode) && inode > 0)
  ) {
    return `ino:${String(inode)}`;
  }
  return `birth:${String(stats?.dev ?? "unknown")}:${String(stats?.birthtimeMs ?? "unknown")}`;
}

function readProjectAppVersion(projectRoot, readText) {
  const manifest = JSON.parse(
    readText(resolveProjectPath(projectRoot, "package.json")),
  );
  if (typeof manifest?.version !== "string" || manifest.version === "") {
    throw new InstallationStepFailure({ category: "configuration" });
  }
  return manifest.version;
}

async function promptForConsent(request) {
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await terminal.question(
      `${consentMessage(request)} ¿Continuar? [y/N] `,
    );
    return /^(?:y|yes|s|sí)$/iu.test(answer.trim());
  } finally {
    terminal.close();
  }
}

function consentMessage(request) {
  const base = CONSENT_COPY.get(request.effect) ?? "Confirma la acción local.";
  if (
    request.effect === "process" &&
    Number.isInteger(request.port) &&
    Number.isInteger(request.pid)
  ) {
    return `${base} Se detendrá el proceso que escucha en el puerto ${request.port} (PID ${request.pid}).`;
  }
  return base;
}

export function probeWindowsPort({
  port,
  spawnProcess,
  netstatExecutable,
  systemRoot = "C:\\Windows",
  canonicalize = path.resolve,
}) {
  assertWindowsSystemExecutable({
    candidate: netstatExecutable,
    executableName: "netstat.exe",
    systemRoot,
    canonicalize,
  });
  const result = spawnProcess(
    netstatExecutable,
    ["-ano", "-p", "tcp"],
    { shell: false, encoding: "utf8", windowsHide: true },
  );
  if (result?.status !== 0 || result?.error) {
    throw new InstallationStepFailure({ category: "process" });
  }
  return parseWindowsNetstat(result.stdout, port);
}

function nodeMajor(version) {
  const major = Number.parseInt(String(version).split(".")[0], 10);
  return Number.isInteger(major) ? major : 0;
}

function defaultOptionalCapabilities({ exists, pathEnvironment, browserAvailable }) {
  const audiovisualAvailable =
    executablePresentOnPath("ffmpeg.exe", pathEnvironment, exists) &&
    executablePresentOnPath("ffprobe.exe", pathEnvironment, exists);
  return [
    {
      id: "ai-authenticated",
      available: false,
      unavailableMode: "skipped",
    },
    {
      id: "external-providers",
      available: false,
      unavailableMode: "skipped",
    },
    {
      id: "audiovisual-tools",
      available: audiovisualAvailable,
      unavailableMode: "degraded",
    },
    {
      id: "browser-navigation",
      available: browserAvailable,
      unavailableMode: "degraded",
    },
  ];
}

export async function detectPlaywrightChromium({ projectRoot, exists = existsSync }) {
  if (!exists(path.join(projectRoot, "node_modules", "playwright"))) return false;
  try {
    const requireFromProject = createRequire(path.join(projectRoot, "package.json"));
    const playwright = requireFromProject("playwright");
    const executablePath = playwright?.chromium?.executablePath?.();
    return typeof executablePath === "string" && exists(executablePath);
  } catch {
    return false;
  }
}

export async function inspectReadyEndpoint(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") return false;
  try {
    const response = await fetchImpl("http://127.0.0.1:3000/api/health/ready", {
      cache: "no-store",
      signal: AbortSignal.timeout(1_500),
    });
    if (!response.ok) return false;
    const body = await response.json();
    return (
      body?.service === "rrss-studio" &&
      body?.schemaVersion === 1 &&
      body?.status === "ready" &&
      body?.checks?.application === "ok" &&
      body?.checks?.database === "ok" &&
      (body?.checks?.vault === "ok" || body?.checks?.vault === "empty")
    );
  } catch {
    return false;
  }
}

function executablePresentOnPath(executable, pathEnvironment, exists) {
  return String(pathEnvironment)
    .split(path.delimiter)
    .filter((directory) => path.isAbsolute(directory))
    .some((directory) => exists(path.join(directory, executable)));
}

function waitForSpawn(child) {
  return new Promise((resolve, reject) => {
    if (
      !child ||
      typeof child.once !== "function" ||
      typeof child.unref !== "function"
    ) {
      reject(new InstallationStepFailure({ category: "process" }));
      return;
    }
    child.once("error", () => {
      reject(new InstallationStepFailure({ category: "process" }));
    });
    child.once("spawn", resolve);
  });
}

async function waitForAvailablePort({ port, localSystem }) {
  const attempts = Math.max(
    1,
    Math.ceil(
      localSystem.portReleaseTimeoutMs /
        localSystem.portReleasePollIntervalMs,
    ),
  );
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const observation = await port.inspectAsync(3000);
    if (observation.status === "available") {
      return observation;
    }
    await localSystem.sleep(localSystem.portReleasePollIntervalMs);
  }
  return port.inspectAsync(3000);
}

async function waitForReadyApplication({ child, port, localSystem }) {
  let childFailure = null;
  let exited = false;
  if (typeof child.once === "function") {
    child.once("error", () => {
      childFailure = new InstallationStepFailure({ category: "process" });
    });
    child.once("exit", (code, signal) => {
      exited = code !== null || signal !== null;
    });
  }
  const attempts = Math.max(
    1,
    Math.ceil(
      localSystem.startTimeoutMs / localSystem.startPollIntervalMs,
    ),
  );
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (childFailure) {
      throw childFailure;
    }
    if (exited || (Number.isInteger(child.exitCode) && child.exitCode !== 0)) {
      throw new InstallationStepFailure({ category: "process" });
    }
    const observation = await port.inspectAsync(3000);
    if (observation.status === "occupied" && await localSystem.inspectHealth()) {
      return observation;
    }
    await localSystem.sleep(localSystem.startPollIntervalMs);
  }
  throw new InstallationStepFailure({ category: "process" });
}

function requiredCheck(id, category, ready) {
  const manifestEntry = REQUIRED_CHECK_MANIFEST.find(
    (requirement) => requirement.id === id && requirement.category === category,
  );
  return {
    id: manifestEntry?.id ?? "unknown-check",
    classification: "required",
    status: manifestEntry && ready ? "ok" : "blocked",
    category: manifestEntry?.category ?? "configuration",
    nextStep: "Revisa este requisito local antes de continuar.",
  };
}

function preparationPrerequisitesReady(receipt) {
  const preparable = new Set([
    "project-dependencies",
    "configuration-template",
    "local-persistence",
    "local-port-process",
  ]);
  return receipt.required.every(
    (check) => preparable.has(check.id) || check.status === "ok",
  );
}

function startPrerequisitesReady(receipt) {
  return receipt.required.every(
    (check) =>
      check.id === "local-port-process" || check.status === "ok",
  );
}

function invokeRequiredProcess(processes, argv, category, projectRoot, step) {
  const { nodeExecutable, npmCliPath } = processes.paths;
  const result = processes.invoke({
    executable: nodeExecutable,
    argv: [npmCliPath, ...argv],
    shell: false,
    cwd: projectRoot,
  });
  if (result?.status !== 0 && result?.exitCode !== 0) {
    throw new InstallationStepFailure({ category, step });
  }
}

function withBlockedPort(receipt) {
  return createPreparationReceipt(
    receipt.required.map((check) =>
      check.id === "local-port-process"
        ? {
            ...check,
            status: "blocked",
            category: "process",
            nextStep: "Comprueba el arranque en el puerto local.",
          }
        : check,
    ),
    receipt.optional,
  );
}

const SAFE_LABEL_BY_CATEGORY = new Map([
  ["platform", "plataforma"],
  ["runtime", "runtime"],
  ["dependencies", "dependencias"],
  ["configuration", "configuración"],
  ["data", "persistencia"],
  ["process", "proceso"],
  ["cache", "caché"],
  ["capability", "capacidad"],
]);

const CONSENT_COPY = new Map([
  [
    "project-preparation",
    "La preparación afecta recursos dentro del proyecto. Sin confirmación explícita, no se ejecuta.",
  ],
  [
    "data-reset",
    "Reiniciar implica posible pérdida de datos locales; sin opción afirmativa predeterminada.",
  ],
  [
    "process",
    "El arranque puede afectar el proceso o puerto detectado. Sin confirmación explícita, no se ejecuta.",
  ],
]);

const SAFE_OPTIONAL_RENDERING = new Map([
  [
    "optional-blocked",
    {
      status: "opcional bloqueada",
      effect:
        "esta capacidad no estará disponible; el uso local básico puede continuar.",
    },
  ],
  [
    "optional-degraded",
    {
      status: "opcional degradada",
      effect:
        "puedes continuar con una limitación funcional; el uso local básico sigue disponible.",
    },
  ],
  [
    "skipped",
    {
      status: "opcional no comprobada",
      effect:
        "esta capacidad queda pendiente; el uso local básico puede continuar.",
    },
  ],
]);

const SAFE_OPTIONAL_LABEL_BY_ID = new Map([
  ["ai-authenticated", "IA autenticada"],
  ["external-providers", "proveedores externos"],
  ["audiovisual-tools", "herramientas audiovisuales"],
  ["browser-navigation", "navegación automatizada"],
]);

const SAFE_FAILURE_NEXT_STEP = new Map([
  ["dependency-install", "Falló la instalación bloqueada por package-lock."],
  ["database-client", "Falló la generación local del cliente de base de datos."],
  ["database-initialization", "Falló la creación de la base de datos local vacía."],
  ["application-build", "Falló el build obligatorio de la aplicación."],
]);

const SAFE_LOADING_BY_OPERATION = new Map([
  ["check", { step: "diagnóstico", category: "plataforma" }],
  ["prepare", { step: "preparación", category: "dependencias" }],
  ["reset", { step: "reinicio", category: "persistencia" }],
  ["start", { step: "arranque", category: "proceso" }],
]);

const SAFE_ERROR_STEP_BY_OPERATION = new Map([
  ["check", "comprobación"],
  ["prepare", "preparación"],
  ["reset", "reinicio"],
  ["start", "arranque"],
]);

export class InstallationStepFailure extends Error {
  /**
   * @param {{
   *   category?: string,
   *   receipt?: object,
   *   recovery?: "backup-preserved",
   *   step?: "dependency-install" | "database-client" | "database-initialization" | "application-build"
   * }} failure
   */
  constructor({ category, receipt, recovery, step } = {}) {
    super("Falló un paso de instalación.");
    this.name = "InstallationStepFailure";
    this.code = "INSTALLATION_STEP_FAILURE";
    this.category = SAFE_LABEL_BY_CATEGORY.has(category)
      ? category
      : "configuration";
    this.receipt = receipt;
    this.recovery = recovery;
    this.step = SAFE_FAILURE_NEXT_STEP.has(step) ? step : undefined;
  }
}

/**
 * Produce microcopy lineal y seguro para los seis estados de la consola.
 *
 * @param {{
 *   kind: "empty" | "loading" | "partial" | "error" | "blocked" | "success",
 *   operation?: "check" | "prepare" | "reset" | "start",
 *   category?: string
 * }} state
 * @returns {string[]}
 */
export function renderConsoleState(state) {
  if (state.kind === "empty") {
    return ["El asistente todavía no ha comprobado este equipo."];
  }

  if (state.kind === "loading") {
    const loading =
      SAFE_LOADING_BY_OPERATION.get(state.operation) ??
      SAFE_LOADING_BY_OPERATION.get("check");
    return [`Comprobando paso de ${loading.step}: ${loading.category}.`];
  }

  if (state.kind === "partial") {
    return [
      "Uso local básico preparado. Obligatorios comprobados; capacidades opcionales limitadas.",
    ];
  }

  if (state.kind === "error") {
    const step =
      SAFE_ERROR_STEP_BY_OPERATION.get(state.operation) ?? "comprobación";
    const category = SAFE_LABEL_BY_CATEGORY.get(state.category) ?? "configuración";
    return [
      `Falló el paso de ${step}: ${category}. La comprobación local conserva los resultados previos.`,
    ];
  }

  if (state.kind === "success") {
    return [
      "Uso local básico preparado. Persistencia y arranque comprobados.",
    ];
  }

  return ["Preparación bloqueada"];
}

/**
 * Ejecuta el recorrido de consola usando únicamente dependencias inyectadas.
 *
 * @param {{
 *   operation: "check" | "prepare" | "reset" | "start",
 *   platform: {name: string, release: string},
 *   input?: {
 *     resetRequested?: boolean,
 *     confirmations?: Array<{
 *       effect: "project-preparation" | "data-reset" | "process",
 *       approved: boolean
 *     }>
 *   },
 *   output: {write: (line: string) => void},
 *   adapters: {
 *     check: () => object,
 *     prepare?: () => void,
 *     reset?: () => void,
 *     start?: () => void
 *   }
 * }} dependencies
 */
export function runInstallationAssistant({
  operation,
  runtime,
  input = {},
  output,
  prompt = async () => false,
}) {
  return executeCanonicalInstallation({
    operation,
    runtime,
    input,
    output,
    prompt,
  });
}

export function installationOperationCompleted(
  operation,
  { receipt, technicalFailure = false } = {},
) {
  if (technicalFailure || !Array.isArray(receipt?.required)) {
    return false;
  }
  if (operation === "prepare") {
    return (
      receipt.required.length > 0 &&
      receipt.required.every(
        (check) => check.status === "ok" || check.id === "local-port-process",
      )
    );
  }
  return receipt.overallStatus === "ready";
}

async function executeCanonicalInstallation({
  operation,
  runtime,
  input,
  output,
  prompt,
}) {
  writeConsoleState(output, { kind: "loading", operation: "check" });
  if (operation !== "check") {
    writeConsoleState(output, { kind: "loading", operation });
  }
  try {
    let result = await runtime.execute(operation, input);
    const requests = Array.isArray(result?.consentRequests)
      ? result.consentRequests
      : [];
    if (requests.length > 0 && !Array.isArray(input.confirmations)) {
      const confirmations = [];
      for (const request of requests) {
        const promptRequest = {
          ...request,
          ...(request.effect === "process" && result.processConfirmation
            ? result.processConfirmation
            : {}),
        };
        output.write(consentMessage(promptRequest));
        confirmations.push({
          effect: request.effect,
          approved: (await prompt(promptRequest)) === true,
          ...(request.effect === "process" && result.processConfirmation
            ? result.processConfirmation
            : {}),
        });
      }
      result = await runtime.execute(operation, {
        ...input,
        confirmations,
      });
    }
    const receipt = normalizeReceipt(result?.receipt);
    const completed = installationOperationCompleted(operation, {
      receipt,
      technicalFailure: result?.technicalFailure === true,
    });
    renderReceipt(receipt, output, { operation, completed });
    return {
      receipt,
      consentRequests: requests,
      technicalFailure: result?.technicalFailure === true,
      completed,
    };
  } catch (error) {
    const receipt = technicalFailureReceipt(error);
    writeConsoleState(output, {
      kind: "error",
      operation,
      category: failureCategory(error),
    });
    renderReceipt(receipt, output);
    return {
      receipt,
      consentRequests: [],
      technicalFailure: true,
    };
  }
}

/**
 * @param {{name: string, release: string}} platform
 */
function isWindows11(platform) {
  if (platform?.name !== "win32") {
    return false;
  }
  const release = /^10\.0\.(\d+)(?:\.|$)/u.exec(platform.release);
  return release !== null && Number(release[1]) >= 22000;
}

function platformBlockedReceipt() {
  return createPreparationReceipt(
    [
      {
        id: "platform",
        classification: "required",
        status: "blocked",
        category: "platform",
        nextStep: "Este asistente solo admite Windows 11.",
      },
    ],
    [],
  );
}

/**
 * @param {object} input
 * @param {string} effect
 */
function confirmationFor(input, effect) {
  return Array.isArray(input.confirmations)
    ? input.confirmations.find(
        (confirmation) => confirmation?.effect === effect,
      )
    : undefined;
}

/**
 * @param {string} effect
 * @param {string} scope
 */
function createConsentRequest(effect, scope) {
  return {
    effect,
    scope,
    rejectionOutcome: "blocked",
  };
}

function failureCategory(error) {
  if (
    error?.code === "INVALID_INSTALLATION_OPERATION" ||
    error?.code === "NPM_CLI_NOT_FOUND"
  ) {
    return "runtime";
  }
  return error?.code === "INSTALLATION_STEP_FAILURE" &&
    SAFE_LABEL_BY_CATEGORY.has(error.category)
    ? error.category
    : "configuration";
}

function technicalFailureReceipt(error, previousReceipt) {
  const typedFailure = error?.code === "INSTALLATION_STEP_FAILURE";
  const category = failureCategory(error);
  const preservedReceipt = normalizeReceipt(
    typedFailure ? (error.receipt ?? previousReceipt) : previousReceipt,
  );
  const failureCheck = sanitizeDiagnostic({
    id: requiredIdForCategory(category),
    classification: "required",
    status: "blocked",
    category,
    nextStep:
      error?.recovery === "backup-preserved"
        ? "El resguardo se conservó. Restaura los datos manualmente o reintenta la preparación."
        : error?.code === "INVALID_INSTALLATION_OPERATION"
          ? "Operación válida: check|prepare|reset|start."
          : SAFE_FAILURE_NEXT_STEP.get(error?.step),
  });
  const replacementIndex = preservedReceipt.required.findIndex(
    (check) => check.id === failureCheck.id || check.category === category,
  );
  const required =
    replacementIndex === -1
      ? [...preservedReceipt.required, failureCheck]
      : preservedReceipt.required.map((check, index) =>
          index === replacementIndex ? failureCheck : check,
        );

  return createPreparationReceipt(
    required,
    preservedReceipt.optional,
  );
}

function requiredIdForCategory(category) {
  return (
    REQUIRED_CHECK_MANIFEST.find((check) => check.category === category)?.id ??
    `${category}-failure`
  );
}

function normalizeReceipt(receipt) {
  const required = Array.isArray(receipt?.required)
    ? receipt.required.map(sanitizeDiagnostic)
    : [];
  const optional = Array.isArray(receipt?.optional)
    ? receipt.optional.map((check) =>
        sanitizeDiagnostic({ ...check, classification: "optional" }),
      )
    : [];
  return createPreparationReceipt(required, optional);
}

/**
 * @param {{required: object[], optional: object[]}} receipt
 * @param {"project-preparation" | "process"} effect
 */
function blockedByRejectedConsent(receipt, effect) {
  const processConsent = effect === "process";
  return createPreparationReceipt(
    [
      ...receipt.required,
      {
        id: `${effect}-consent`,
        classification: "required",
        status: "blocked",
        category: processConsent ? "process" : "dependencies",
        nextStep: processConsent
          ? "Confirma el proceso o puerto concreto antes de continuar."
          : "Confirma la preparación dentro del proyecto antes de continuar.",
      },
    ],
    receipt.optional,
  );
}

/**
 * @param {{required: object[], optional: object[], overallStatus: string}} receipt
 * @param {{write: (line: string) => void}} output
 */
function renderReceipt(receipt, output, { operation, completed } = {}) {
  for (const check of receipt.required) {
    const label = SAFE_LABEL_BY_CATEGORY.get(check.category) ?? "requisito";
    output.write(
      `${label}: ${check.status === "ok" ? "comprobada" : "bloqueada"}`,
    );
    if (check.status !== "ok") {
      output.write(`Siguiente paso: ${check.nextStep}`);
    }
  }
  for (const check of receipt.optional) {
    const label =
      SAFE_OPTIONAL_LABEL_BY_ID.get(check.id) ??
      SAFE_LABEL_BY_CATEGORY.get(check.category) ??
      "capacidad";
    if (check.status === "ok") {
      output.write(`${label}: comprobada`);
      continue;
    }
    const rendering =
      SAFE_OPTIONAL_RENDERING.get(check.status) ??
      SAFE_OPTIONAL_RENDERING.get("optional-blocked");
    output.write(`${label}: ${rendering.status}`);
    output.write(
      `Efecto: ${SAFE_OPTIONAL_LABEL_BY_ID.has(check.id) ? check.nextStep : rendering.effect}`,
    );
  }
  const hasLimitedOptionals = receipt.optional.some(
    (check) => check.status !== "ok",
  );
  if (operation === "prepare" && completed) {
    output.write(
      "Preparación completada. Ejecuta start para comprobar el proceso local.",
    );
    return;
  }
  writeConsoleState(output, {
    kind:
      receipt.overallStatus !== "ready"
        ? "blocked"
        : hasLimitedOptionals
          ? "partial"
          : "success",
  });
}

function writeConsoleState(output, state) {
  for (const line of renderConsoleState(state)) {
    output.write(line);
  }
}

if (isDirectExecution()) {
  await main({ prompt: promptForConsent });
}
