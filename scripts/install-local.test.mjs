import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import * as portModule from "../src/core/installation/adapters/port.mjs";
import { createProcessAdapter } from "../src/core/installation/adapters/process.mjs";
import {
  createPreparationReceipt,
  REQUIRED_CHECK_MANIFEST,
} from "../src/core/installation/receipt.mjs";
import * as installLocal from "./install-local.mjs";

test("debe_importar_sin_ejecutar_y_usar_check_por_defecto_en_main", async () => {
  const operations = [];
  const output = [];
  const exitCodes = [];

  const result = await installLocal.main({
    argv: ["node", "scripts/install-local.mjs"],
    output: { write: (line) => output.push(line) },
    setExitCode: (code) => exitCodes.push(code),
    createRuntime: () => ({
      execute(operation) {
        operations.push(operation);
        return { receipt: readyReceipt() };
      },
    }),
  });

  assert.equal(installLocal.parseOperation(["node", "script"]), "check");
  assert.deepEqual(operations, ["check"]);
  assert.equal(output[0], "Comprobando paso de diagnóstico: plataforma.");
  assert.equal(result.receipt.overallStatus, "ready");
  assert.deepEqual(exitCodes, [0]);
});

test("debe_aceptar_yes_solo_para_la_preparacion_no_interactiva", async () => {
  const inputs = [];
  const output = [];
  const exitCodes = [];
  let promptCalls = 0;
  const result = await installLocal.main({
    argv: ["node", "script", "prepare", "--yes"],
    output: { write: (line) => output.push(line) },
    setExitCode: (code) => exitCodes.push(code),
    prompt: async () => {
      promptCalls += 1;
      return false;
    },
    createRuntime: () => ({
      execute(_operation, input) {
        inputs.push(input);
        if (inputs.length === 1) {
          return {
            receipt: blockedDataReceipt(),
            consentRequests: [
              {
                effect: "project-preparation",
                scope: "project",
                rejectionOutcome: "blocked",
              },
            ],
          };
        }
        return { receipt: preparedReceipt(), consentRequests: [] };
      },
    }),
  });

  assert.equal(promptCalls, 0);
  assert.equal(result.receipt.overallStatus, "blocked");
  assert.equal(result.completed, true);
  assert.deepEqual(exitCodes, [0]);
  assert.equal(
    output.at(-1),
    "Preparación completada. Ejecuta start para comprobar el proceso local.",
  );
  assert.deepEqual(inputs[1].confirmations, [
    { effect: "project-preparation", approved: true },
  ]);
  assert.throws(
    () => installLocal.parseCliOptions(["node", "script", "reset", "--yes"]),
    { code: "INVALID_INSTALLATION_OPERATION" },
  );
  assert.throws(
    () => installLocal.parseCliOptions(["node", "script", "prepare", "--force"]),
    { code: "INVALID_INSTALLATION_OPERATION" },
  );
});

test("debe_sanear_path_y_conservar_solo_directorios_absolutos", () => {
  const pathApi = path.win32;
  const directories = new Set([
    pathApi.normalize("C:\\Node"),
    pathApi.normalize("C:\\Windows\\System32"),
  ]);
  const result = installLocal.sanitizeExecutablePath(
    [
      "C:\\Node",
      "C:\\Users\\runner\\ActionsMcpHost.exe",
      ".\\relative",
      '"C:\\Windows\\System32"',
      "C:\\Node",
    ].join(pathApi.delimiter),
    {
      pathApi,
      isDirectory: (candidate) => directories.has(pathApi.normalize(candidate)),
    },
  );

  assert.equal(
    result,
    ["C:\\Node", "C:\\Windows\\System32"].join(pathApi.delimiter),
  );
});

test("debe_fijar_exit_code_no_cero_para_bloqueo_y_error", async () => {
  const exitCodes = [];
  const blocked = await installLocal.main({
    argv: ["node", "script", "check"],
    output: { write() {} },
    setExitCode: (code) => exitCodes.push(code),
    createRuntime: () => ({
      execute: () => ({ receipt: blockedDataReceipt() }),
    }),
  });
  const failed = await installLocal.main({
    argv: ["node", "script", "check"],
    output: { write() {} },
    setExitCode: (code) => exitCodes.push(code),
    createRuntime: () => ({
      execute() {
        throw new Error("RUTA_PRIVADA SALIDA_CRUDA");
      },
    }),
  });

  assert.equal(blocked.receipt.overallStatus, "blocked");
  assert.equal(failed.technicalFailure, true);
  assert.deepEqual(exitCodes, [1, 1]);
});

test("debe_mostrar_ayuda_exacta_para_operacion_invalida", async () => {
  const output = [];
  const exitCodes = [];

  const result = await installLocal.main({
    argv: ["node", "script", "destroy"],
    output: { write: (line) => output.push(line) },
    setExitCode: (code) => exitCodes.push(code),
    createRuntime() {
      assert.fail("Una operación inválida no crea el runtime.");
    },
  });

  assert.deepEqual(exitCodes, [1]);
  assert.equal(result.technicalFailure, true);
  assert.match(
    output.join("\n"),
    /Siguiente paso: Operación válida: check\|prepare\|reset\|start\./u,
  );
  assert.doesNotMatch(output.join("\n"), /configuración/u);
});

test("debe_mostrar_loading_antes_y_durante_cada_operacion", async () => {
  for (const operation of ["check", "prepare", "reset", "start"]) {
    const events = [];
    await installLocal.main({
      argv: ["node", "script", operation],
      output: { write: (line) => events.push(`output:${line}`) },
      setExitCode() {},
      createRuntime: () => ({
        execute() {
          events.push(`execute:${operation}`);
          return { receipt: readyReceipt() };
        },
      }),
    });

    assert.equal(
      events[0],
      "output:Comprobando paso de diagnóstico: plataforma.",
    );
    if (operation !== "check") {
      assert.equal(
        events[1],
        `output:${installLocal.renderConsoleState({
          kind: "loading",
          operation,
        })[0]}`,
      );
      assert.ok(events.indexOf(`execute:${operation}`) > 1);
    }
  }
});

test("debe_invocar_procesos_sin_shell", () => {
  const invocations = [];
  const projectRoot = "C:\\SyntheticProject";
  const nodeExecutable = "C:\\SyntheticNode\\node.exe";
  const npmCliPath = "C:\\SyntheticNode\\node_modules\\npm\\bin\\npm-cli.js";
  const adapter = createProcessAdapter({
    projectRoot,
    nodeExecutable,
    npmCliPath,
    pathApi: path.win32,
    spawn(executable, argv, options) {
      invocations.push({ executable, argv, options });
      return { status: 0 };
    },
  });
  const descriptor = {
    executable: nodeExecutable,
    argv: [npmCliPath, "--version"],
    shell: false,
    cwd: projectRoot,
  };

  assert.equal(adapter.classify(descriptor).allowed, true);
  adapter.invoke(descriptor);
  for (const executable of ["npm", "npm.cmd", "cmd.exe", "powershell.exe"]) {
    assert.equal(
      adapter.classify({
        executable,
        argv: ["--version"],
        shell: false,
        cwd: projectRoot,
      }).allowed,
      false,
    );
  }
  assert.deepEqual(invocations, [
    {
      executable: nodeExecutable,
      argv: [npmCliPath, "--version"],
      options: { shell: false, cwd: projectRoot },
    },
  ]);
});

test("debe_mostrar_salida_de_preparacion_solo_cuando_se_solicita", () => {
  const invocations = [];
  const projectRoot = "C:\\SyntheticProject";
  const nodeExecutable = "C:\\SyntheticNode\\node.exe";
  const npmCliPath = "C:\\SyntheticNode\\node_modules\\npm\\bin\\npm-cli.js";
  const adapter = createProcessAdapter({
    projectRoot,
    nodeExecutable,
    npmCliPath,
    pathApi: path.win32,
    inheritOutput: true,
    spawn(executable, argv, options) {
      invocations.push({ executable, argv, options });
      return { status: 0 };
    },
  });

  adapter.invoke({
    executable: nodeExecutable,
    argv: [npmCliPath, "run", "build"],
    shell: false,
    cwd: projectRoot,
  });

  assert.deepEqual(invocations[0].options, {
    shell: false,
    cwd: projectRoot,
    stdio: "inherit",
  });
});

test("debe_clasificar_instalacion_global_como_efecto_externo", () => {
  const projectRoot = "C:\\SyntheticProject";
  const nodeExecutable = "C:\\SyntheticNode\\node.exe";
  const npmCliPath = "C:\\SyntheticNode\\npm-cli.js";
  const adapter = createProcessAdapter({
    projectRoot,
    nodeExecutable,
    npmCliPath,
    pathApi: path.win32,
    spawn() {
      assert.fail("Una instalación global no debe ejecutarse.");
    },
  });

  const descriptors = [
    {
      executable: "npm.cmd",
      argv: ["install", "--global", "synthetic-package"],
      shell: false,
      cwd: projectRoot,
    },
    {
      executable: nodeExecutable,
      argv: [npmCliPath, "install", "-g", "synthetic-package"],
      shell: false,
      cwd: projectRoot,
    },
  ];
  for (const descriptor of descriptors) {
    assert.deepEqual(adapter.classify(descriptor), {
      effect: "outside-project",
      allowed: false,
    });
    assert.throws(
      () => adapter.invoke(descriptor),
      (error) =>
        error?.code === "OUTSIDE_PROJECT_EFFECT_FORBIDDEN" &&
        error?.effect === "outside-project",
    );
  }
});

test("debe_rechazar_npm_cli_fuera_de_la_ruta_aprobada", () => {
  const projectRoot = "C:\\SyntheticProject";
  const nodeExecutable = "C:\\SyntheticNode\\node.exe";
  const npmCliPath = "C:\\SyntheticNode\\npm-cli.js";
  const adapter = createProcessAdapter({
    projectRoot,
    nodeExecutable,
    npmCliPath,
    pathApi: path.win32,
    spawn() {
      assert.fail("No debe invocar una ruta no aprobada.");
    },
  });

  assert.equal(
    adapter.classify({
      executable: nodeExecutable,
      argv: ["C:\\Other\\npm-cli.js", "install"],
      shell: false,
      cwd: projectRoot,
    }).allowed,
    false,
  );
  assert.equal(
    adapter.classify({
      executable: nodeExecutable,
      argv: [npmCliPath, "run", "unknown-script"],
      shell: false,
      cwd: projectRoot,
    }).allowed,
    false,
  );
});

test("debe_resolver_npm_cli_real_desde_candidatos_temporales", () => {
  const sandbox = mkdtempSync(path.join(tmpdir(), "rrss-npm-cli-"));
  try {
    const nodeExecutable = path.join(sandbox, "node", "node.exe");
    const npmCliPath = path.join(
      sandbox,
      "node",
      "node_modules",
      "npm",
      "bin",
      "npm-cli.js",
    );
    mkdirSync(path.dirname(npmCliPath), { recursive: true });
    writeFileSync(nodeExecutable, "NODE");
    writeFileSync(npmCliPath, "NPM CLI");

    assert.equal(
      installLocal.resolveNpmCliPath({
        nodeExecutable,
        npmExecPath: npmCliPath,
        exists: existsSync,
        candidates: [],
      }),
      npmCliPath,
    );
    assert.throws(
      () =>
        installLocal.resolveNpmCliPath({
          nodeExecutable: path.join(sandbox, "other", "node.exe"),
          npmExecPath: path.join(sandbox, "npm.cmd"),
          exists: (candidate) => candidate.endsWith("npm.cmd"),
          candidates: [],
        }),
      (error) => error?.code === "NPM_CLI_NOT_FOUND",
    );
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("debe_extraer_pid_listener_del_netstat_de_windows", () => {
  const output = [
    "  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4312",
    "  TCP    [::]:3000              [::]:0                 LISTENING       4312",
    "  TCP    127.0.0.1:4000         0.0.0.0:0              LISTENING       9999",
  ].join("\r\n");

  assert.deepEqual(portModule.parseWindowsNetstat(output, 3000), {
    occupied: true,
    pid: 4312,
  });
  assert.equal(portModule.parseWindowsNetstat(output, 5000), null);
});

test("debe_invocar_netstat_absoluto_en_modo_read_only", () => {
  const calls = [];
  const netstatExecutable = "C:\\Windows\\System32\\netstat.exe";
  const observation = installLocal.probeWindowsPort({
    port: 3000,
    netstatExecutable,
    canonicalize: path.win32.resolve,
    spawnProcess(executable, argv, options) {
      calls.push({ executable, argv, options });
      return {
        status: 0,
        stdout:
          "TCP 127.0.0.1:3000 0.0.0.0:0 LISTENING 4312",
      };
    },
  });

  assert.deepEqual(observation, { occupied: true, pid: 4312 });
  assert.deepEqual(calls, [
    {
      executable: netstatExecutable,
      argv: ["-ano", "-p", "tcp"],
      options: { shell: false, encoding: "utf8", windowsHide: true },
    },
  ]);
});

test("debe_validar_netstat_y_taskkill_como_rutas_canonicas_del_sistema", () => {
  const projectRoot = "C:\\SyntheticProject";
  const nodeExecutable = "C:\\SyntheticNode\\node.exe";
  const npmCliPath = "C:\\SyntheticNode\\npm-cli.js";
  const systemRoot = "C:\\Windows";
  const canonicalize = (candidate) => path.win32.normalize(candidate);
  let processCalls = 0;
  const adapter = createProcessAdapter({
    projectRoot,
    nodeExecutable,
    npmCliPath,
    systemRoot,
    taskkillExecutable: "C:\\Temp\\taskkill.exe",
    canonicalize,
    spawn() {
      processCalls += 1;
      return { status: 0 };
    },
  });

  assert.throws(
    () =>
      installLocal.probeWindowsPort({
        port: 3000,
        netstatExecutable: "C:\\Temp\\netstat.exe",
        systemRoot,
        canonicalize,
        spawnProcess() {
          processCalls += 1;
          return { status: 0, stdout: "" };
        },
      }),
    (error) => error?.code === "UNSAFE_SYSTEM_EXECUTABLE",
  );
  assert.throws(
    () =>
      adapter.terminateDetected({
        observation: {
          detected: true,
          status: "occupied",
          port: 3000,
          pid: 4312,
        },
        confirmation: { confirmed: true, port: 3000, pid: 4312 },
      }),
    (error) => error?.code === "UNSAFE_SYSTEM_EXECUTABLE",
  );
  assert.equal(processCalls, 0);
});

test("debe_bloquear_fuera_de_windows_11", async () => {
  let spawns = 0;
  let ports = 0;
  const harness = createHarness({
    platform: { name: "linux", release: "6.0.0" },
    spawnSync() {
      spawns += 1;
      return { status: 0 };
    },
    inspectPort() {
      ports += 1;
      return null;
    },
  });
  try {
    const result = await runMain(harness, "check");
    assert.equal(result.receipt.overallStatus, "blocked");
    assert.equal(spawns, 0);
    assert.equal(ports, 0);
  } finally {
    harness.cleanup();
  }
});

test("debe_resolver_npm_lazy_despues_de_validar_plataforma", async () => {
  let npmPathChecks = 0;
  const runtime = installLocal.createLocalInstallationRuntime({
    projectRoot: "C:\\SyntheticProject",
    platform: { name: "linux", release: "6.0.0" },
    system: {
      nodeExecutable: "C:\\SyntheticNode\\node.exe",
      npmExecPath: "C:\\SyntheticNode\\npm-cli.js",
      appVersion: "0.1.0",
      exists(candidate) {
        if (path.basename(candidate).toLowerCase() === "npm-cli.js") {
          npmPathChecks += 1;
        }
        return false;
      },
    },
  });

  const result = await runtime.execute("check");

  assert.equal(result.receipt.overallStatus, "blocked");
  assert.equal(npmPathChecks, 0);
});

test("debe_clasificar_npm_cli_ausente_como_runtime_y_conservar_manifiesto", async () => {
  let approvedNpmCli;
  const harness = createHarness({
    exists(candidate) {
      if (path.basename(candidate).toLowerCase() === "npm-cli.js") {
        return candidate === approvedNpmCli && existsSync(candidate);
      }
      return existsSync(candidate);
    },
  });
  approvedNpmCli = harness.npmCliPath;
  rmSync(harness.npmCliPath);
  try {
    const output = [];
    const result = await runMain(harness, "check", {
      output: { write: (line) => output.push(line) },
    });

    assert.deepEqual(
      result.receipt.required.map(({ id }) => id),
      REQUIRED_CHECK_MANIFEST.map(({ id }) => id),
    );
    assert.equal(
      result.receipt.required.find(({ id }) => id === "node-npm-runtime")
        ?.status,
      "blocked",
    );
    assert.match(output.join("\n"), /runtime: bloqueada/u);
    assert.doesNotMatch(
      output.join("\n"),
      /NPM_CLI_NOT_FOUND|npm-cli\.js|Synthetic/u,
    );
  } finally {
    harness.cleanup();
  }
});

test("debe_omitir_datos_sensibles_en_la_salida", async () => {
  const fixtureSensitiveValue = "FIXTURE_LOCAL_VALUE_DO_NOT_LOG";
  const harness = createHarness({
    prepared: true,
    ports: [{ pid: 4312 }],
    envContent: `DATABASE_URL=file:./dev.db ${fixtureSensitiveValue}`,
  });
  try {
    const output = [];
    const result = await runMain(harness, "check", {
      output: { write: (line) => output.push(line) },
    });
    const serialized = JSON.stringify(result);

    assert.deepEqual(
      result.receipt.required.map((check) => check.id),
      REQUIRED_CHECK_MANIFEST.map((check) => check.id),
    );
    assert.equal(Object.hasOwn(result, "observations"), false);
    assert.doesNotMatch(serialized, /4312|Synthetic|npm-cli\.js|node\.exe/u);
    assert.doesNotMatch(output.join("\n"), /4312|Synthetic|npm-cli\.js|node\.exe/u);
    assert.doesNotMatch(serialized, /DATABASE_URL|FIXTURE_LOCAL_VALUE_DO_NOT_LOG/u);
    assert.doesNotMatch(
      output.join("\n"),
      /DATABASE_URL|FIXTURE_LOCAL_VALUE_DO_NOT_LOG/u,
    );
    assert.doesNotMatch(
      serialized,
      new RegExp(escapeRegExp(harness.projectRoot), "u"),
    );
    assert.doesNotMatch(
      output.join("\n"),
      new RegExp(escapeRegExp(harness.projectRoot), "u"),
    );
  } finally {
    harness.cleanup();
  }
});

test("debe_exponer_opcionales_reales_con_efectos_distintos", async () => {
  const harness = createHarness();
  try {
    const output = [];
    const result = await runMain(harness, "check", {
      output: { write: (line) => output.push(line) },
    });
    const effects = new Map(
      result.receipt.optional.map((check) => [check.id, check.nextStep]),
    );

    assert.deepEqual([...effects.keys()], [
      "ai-authenticated",
      "external-providers",
      "audiovisual-tools",
      "browser-navigation",
    ]);
    assert.deepEqual(
      result.receipt.optional.map((check) => check.status),
      ["skipped", "skipped", "optional-degraded", "optional-degraded"],
    );
    assert.equal(new Set(effects.values()).size, 4);
    assert.match(output.join("\n"), /IA autenticada/u);
    assert.match(output.join("\n"), /proveedores externos/u);
    assert.match(output.join("\n"), /herramientas audiovisuales/u);
    assert.match(output.join("\n"), /navegación automatizada/u);
  } finally {
    harness.cleanup();
  }
});

test("debe_medir_opcionales_desde_metadatos_sin_ejecutar_binarios", async () => {
  let processCalls = 0;
  const harness = createHarness({
    prepared: true,
    optionalTools: true,
    spawnSync() {
      processCalls += 1;
      return { status: 0, stdout: "10.9.0" };
    },
  });
  try {
    const result = await runMain(harness, "check");
    const optionalStatus = new Map(
      result.receipt.optional.map((check) => [check.id, check.status]),
    );

    assert.equal(optionalStatus.get("ai-authenticated"), "skipped");
    assert.equal(optionalStatus.get("external-providers"), "skipped");
    assert.equal(optionalStatus.get("audiovisual-tools"), "ok");
    assert.equal(optionalStatus.get("browser-navigation"), "ok");
    assert.equal(processCalls, 1);
  } finally {
    harness.cleanup();
  }
});

test("debe_degradar_navegacion_si_el_paquete_existe_pero_chromium_no", async () => {
  const harness = createHarness({ optionalTools: true, browserAvailable: false });
  try {
    const output = [];
    const result = await runMain(harness, "check", {
      output: { write: (line) => output.push(line) },
    });
    assert.equal(
      result.receipt.optional.find(({ id }) => id === "browser-navigation")?.status,
      "optional-degraded",
    );
    assert.match(output.join("\n"), /npx playwright install chromium/u);
  } finally {
    harness.cleanup();
  }
});

test("debe_rechazar_un_ready_que_no_identifique_rrss_studio", async () => {
  const incomplete = await installLocal.inspectReadyEndpoint(async () => ({
    ok: true,
    json: async () => ({ status: "ready" }),
  }));
  const complete = await installLocal.inspectReadyEndpoint(async () => ({
    ok: true,
    json: async () => ({
      service: "rrss-studio",
      schemaVersion: 1,
      status: "ready",
      checks: { application: "ok", database: "ok", vault: "empty" },
    }),
  }));

  assert.equal(incomplete, false);
  assert.equal(complete, true);
});

test("debe_aceptar_db_solo_con_marcador_vinculado", async () => {
  const compatible = createHarness({ prepared: true });
  const incompatible = createHarness({
    prepared: true,
    markerOverride: { schemaSha256: "0".repeat(64) },
  });
  try {
    assert.equal(
      (await runMain(compatible, "check")).receipt.required.find(
        (check) => check.id === "local-persistence",
      )?.status,
      "ok",
    );
    assert.equal(
      (await runMain(incompatible, "check")).receipt.required.find(
        (check) => check.id === "local-persistence",
      )?.status,
      "blocked",
    );
  } finally {
    compatible.cleanup();
    incompatible.cleanup();
  }
});

test("debe_requerir_persistencia_antes_de_ready", async () => {
  const harness = createHarness();
  try {
    const result = await runMain(harness, "check");

    assert.equal(result.receipt.overallStatus, "blocked");
    assert.equal(
      result.receipt.required.find(
        (check) => check.id === "local-persistence",
      )?.status,
      "blocked",
    );
  } finally {
    harness.cleanup();
  }
});

test("debe_invalidar_marcador_al_sustituir_la_db_gestionada", async () => {
  const harness = createHarness({ prepared: true });
  const databasePath = path.join(harness.projectRoot, "prisma", "dev.db");
  try {
    assert.equal((await runMain(harness, "check")).receipt.overallStatus, "ready");

    renameSync(databasePath, `${databasePath}.replaced`);
    writeFileSync(databasePath, "DB_SUSTITUTA");

    const replaced = await runMain(harness, "check");
    assert.equal(replaced.receipt.overallStatus, "blocked");
    assert.equal(
      replaced.receipt.required.find(
        (check) => check.id === "local-persistence",
      )?.status,
      "blocked",
    );
  } finally {
    harness.cleanup();
  }
});

test("debe_preparar_con_env_manual_sin_leerlo_ni_sobrescribirlo", async () => {
  const originalEnv = "CONFIGURACION_MANUAL_NO_LEER";
  const commands = [];
  const processEnvironments = [];
  const harness = createHarness({
    envContent: originalEnv,
    spawnSync(_executable, argv, processOptions) {
      const command = npmCommand(argv);
      commands.push(command);
      processEnvironments.push({ command, env: processOptions?.env });
      if (command === "ci") {
        mkdirSync(path.join(harness.projectRoot, "node_modules"));
      }
      if (command === "run db:push") {
        writeFileSync(path.join(harness.projectRoot, "prisma", "dev.db"), "DB");
      }
      return { status: 0 };
    },
  });
  try {
    const result = await runMain(harness, "prepare", {
      prompt: async () => true,
    });

    assert.equal(
      result.receipt.overallStatus,
      "ready",
      JSON.stringify(result),
    );
    assert.equal(
      readFileSync(path.join(harness.projectRoot, ".env"), "utf8"),
      originalEnv,
    );
    assert.equal(harness.reads.includes(".env"), false);
    assert.ok(commands.indexOf("run db:push") < commands.indexOf("run build"));
    assert.equal(commands.includes("run build"), true);
    assert.equal(
      processEnvironments.every(({ env }) => {
        const value = env?.PATH;
        return (
        typeof value === "string" &&
        value.split(path.delimiter).includes(path.join(harness.projectRoot, "node-bin")) &&
        !value.includes("WindowsApps")
        );
      }),
      true,
    );
    const buildEnvironment = processEnvironments.find(
      ({ command }) => command === "run build",
    )?.env;
    assert.equal(buildEnvironment?.HOME, harness.projectRoot);
    assert.equal(buildEnvironment?.USERPROFILE, harness.projectRoot);
    assert.equal(buildEnvironment?.LOCALAPPDATA, harness.projectRoot);
    assert.notEqual(
      processEnvironments.find(({ command }) => command === "ci")?.env?.HOME,
      harness.projectRoot,
    );
  } finally {
    harness.cleanup();
  }
});

test("debe_bloquear_prepare_si_el_build_falla_y_no_escribir_marcador", async () => {
  const output = [];
  const harness = createHarness({
    spawnSync(_executable, argv) {
      const command = npmCommand(argv);
      if (command === "ci") mkdirSync(path.join(harness.projectRoot, "node_modules"));
      if (command === "run db:push") {
        writeFileSync(path.join(harness.projectRoot, "prisma", "dev.db"), "DB");
      }
      return { status: command === "run build" ? 1 : 0 };
    },
  });
  try {
    const result = await runMain(harness, "prepare", {
      prompt: async () => true,
      output: { write: (line) => output.push(line) },
    });
    assert.equal(result.receipt.overallStatus, "blocked");
    assert.equal(result.technicalFailure, true);
    assert.match(output.join("\n"), /Falló el build obligatorio/u);
    assert.doesNotMatch(output.join("\n"), /node_modules|package\.json/u);
    assert.equal(
      existsSync(path.join(harness.projectRoot, "data", "installation", "managed-v1.json")),
      false,
    );
  } finally {
    harness.cleanup();
  }
});

test("debe_preparar_aunque_otra_instancia_ocupe_el_puerto", async () => {
  const commands = [];
  const harness = createHarness({
    ports: [{ pid: 4312 }],
    spawnSync(_executable, argv) {
      const command = npmCommand(argv);
      commands.push(command);
      if (command === "ci") mkdirSync(path.join(harness.projectRoot, "node_modules"));
      if (command === "run db:push") {
        writeFileSync(path.join(harness.projectRoot, "prisma", "dev.db"), "DB");
      }
      return { status: 0 };
    },
  });
  try {
    const result = await runMain(harness, "prepare", { prompt: async () => true });

    assert.equal(result.receipt.overallStatus, "blocked");
    assert.equal(commands.includes("ci"), true);
    assert.equal(commands.includes("run db:push"), true);
    assert.equal(commands.includes("run build"), true);
    assert.equal(
      existsSync(path.join(harness.projectRoot, "data", "installation", "managed-v1.json")),
      true,
    );
  } finally {
    harness.cleanup();
  }
});

test("debe_preservar_datos_detectados", async () => {
  let prompts = 0;
  const harness = createHarness({ databaseContent: "DB_DESCONOCIDA" });
  try {
    const result = await runMain(harness, "prepare", {
      prompt: async () => {
        prompts += 1;
        return true;
      },
    });

    assert.equal(result.receipt.overallStatus, "blocked");
    assert.equal(prompts, 0);
    assert.equal(
      readFileSync(path.join(harness.projectRoot, "prisma", "dev.db"), "utf8"),
      "DB_DESCONOCIDA",
    );
  } finally {
    harness.cleanup();
  }
});

test("debe_exigir_confirmacion_separada_para_reset", async () => {
  const healthy = createHarness({ prepared: true });
  const blocked = createHarness({ databaseContent: "DB_DESCONOCIDA" });
  const requests = [];
  try {
    await runMain(healthy, "reset", {
      prompt: async (request) => {
        requests.push(request);
        return false;
      },
    });
    await runMain(blocked, "reset", {
      prompt: async (request) => {
        requests.push(request);
        return false;
      },
    });

    assert.deepEqual(
      requests.map((request) => request.effect),
      ["data-reset"],
    );
  } finally {
    healthy.cleanup();
    blocked.cleanup();
  }
});

test("debe_conservar_estado_al_rechazar_confirmacion", async () => {
  const originalData = "DB_LOCAL_PRESERVADA";
  const harness = createHarness({ databaseContent: originalData });
  try {
    const result = await runMain(harness, "reset", {
      prompt: async () => false,
    });

    assert.equal(result.receipt.overallStatus, "blocked");
    assert.equal(result.technicalFailure, false);
    assert.equal(
      readFileSync(path.join(harness.projectRoot, "prisma", "dev.db"), "utf8"),
      originalData,
    );
  } finally {
    harness.cleanup();
  }
});

test("debe_hacer_backup_retirar_db_prisma_y_marcador_en_orden", async () => {
  const events = [];
  const harness = createHarness({
    databaseContent: "DB_ORIGINAL",
    spawnSync(_executable, argv) {
      const command = npmCommand(argv);
      if (command === "ci") {
        mkdirSync(path.join(harness.projectRoot, "node_modules"));
      }
      if (command === "run db:push") {
        events.push("prisma");
        writeFileSync(path.join(harness.projectRoot, "prisma", "dev.db"), "DB_NUEVA");
      }
      return { status: 0 };
    },
    copy(source, destination) {
      events.push(path.basename(source).startsWith("dev.db") ? "backup" : "env");
      writeFileSync(destination, readFileSync(source));
    },
    move(source, destination) {
      events.push("retirada");
      renameSync(source, destination);
    },
    writeText(filePath, content) {
      events.push("marcador");
      writeFileSync(filePath, content);
    },
  });
  try {
    const result = await runMain(harness, "reset", {
      prompt: async () => true,
    });
    const marker = JSON.parse(
      readFileSync(
        path.join(
          harness.projectRoot,
          "data",
          "installation",
          "managed-v1.json",
        ),
        "utf8",
      ),
    );

    assert.equal(result.receipt.overallStatus, "ready", JSON.stringify(result));
    assert.ok(events.indexOf("backup") < events.indexOf("retirada"));
    assert.ok(events.indexOf("retirada") < events.indexOf("prisma"));
    assert.ok(events.indexOf("prisma") < events.indexOf("marcador"));
    assert.deepEqual(
      marker,
      managedMarker(
        harness.schema,
        path.join(harness.projectRoot, "prisma", "dev.db"),
      ),
    );
    assert.equal(
      readFileSync(path.join(harness.projectRoot, "prisma", "dev.db"), "utf8"),
      "DB_NUEVA",
    );
  } finally {
    harness.cleanup();
  }
});

test("debe_mover_cada_dato_una_sola_vez_al_resguardo", async () => {
  const dataCopies = [];
  const dataMoves = [];
  const harness = createHarness({
    databaseContent: "DB_ORIGINAL",
    copy(source, destination) {
      dataCopies.push({ source, destination });
      writeFileSync(destination, readFileSync(source));
    },
    move(source, destination) {
      dataMoves.push({ source, destination });
      renameSync(source, destination);
    },
    spawnSync(_executable, argv) {
      if (npmCommand(argv) === "ci") {
        mkdirSync(path.join(harness.projectRoot, "node_modules"));
      }
      if (npmCommand(argv) === "run db:push") {
        writeFileSync(path.join(harness.projectRoot, "prisma", "dev.db"), "DB_NUEVA");
      }
      return { status: 0 };
    },
  });
  try {
    const result = await runMain(harness, "reset", {
      prompt: async () => true,
    });

    assert.equal(result.receipt.overallStatus, "ready");
    assert.equal(dataCopies.length, 0);
    assert.equal(dataMoves.length, 1);
    assert.equal(
      readFileSync(dataMoves[0].destination, "utf8"),
      "DB_ORIGINAL",
    );
  } finally {
    harness.cleanup();
  }
});

test("debe_preservar_backup_y_bloquear_si_prisma_falla", async () => {
  const harness = createHarness({
    databaseContent: "DB_ORIGINAL",
    spawnSync(_executable, argv) {
      if (npmCommand(argv) === "run db:push") {
        return { status: 1 };
      }
      return { status: 0 };
    },
  });
  try {
    const result = await runMain(harness, "reset", {
      prompt: async () => true,
    });
    const backupRoot = path.join(
      harness.projectRoot,
      "data",
      "installation",
      "backups",
    );

    assert.equal(result.receipt.overallStatus, "blocked");
    assert.equal(existsSync(backupRoot), true);
    assert.equal(
      existsSync(
        path.join(
          harness.projectRoot,
          "data",
          "installation",
          "managed-v1.json",
        ),
      ),
      false,
    );
  } finally {
    harness.cleanup();
  }
});

test("debe_indicar_restauracion_manual_si_reset_falla_tras_resguardo", async () => {
  const output = [];
  const harness = createHarness({
    databaseContent: "DB_ORIGINAL",
    spawnSync(_executable, argv) {
      return { status: npmCommand(argv) === "run db:push" ? 1 : 0 };
    },
  });
  try {
    const result = await runMain(harness, "reset", {
      prompt: async () => true,
      output: { write: (line) => output.push(line) },
    });
    const rendered = output.join("\n");

    assert.equal(result.receipt.overallStatus, "blocked");
    assert.match(
      rendered,
      /Siguiente paso: El resguardo se conservó\. Restaura los datos manualmente o reintenta la preparación\./u,
    );
    assert.doesNotMatch(rendered, /solicita un reset separado/u);
    assert.doesNotMatch(rendered, new RegExp(escapeRegExp(harness.projectRoot), "u"));
  } finally {
    harness.cleanup();
  }
});

test("debe_esperar_hasta_puerto_ocupado_sin_exigir_pid_del_hijo", async () => {
  const child = new EventEmitter();
  child.pid = 777;
  child.exitCode = null;
  child.unref = () => {};
  const harness = createHarness({
    prepared: true,
    ports: [null, null, { pid: 9001 }, { pid: 9001 }],
    spawn: () => child,
    sleep: async () => {},
  });
  try {
    const result = await runMain(harness, "start", {
      prompt: async () => true,
    });
    assert.equal(
      result.receipt.overallStatus,
      "ready",
      JSON.stringify(result),
    );
  } finally {
    harness.cleanup();
  }
});

test("debe_esperar_health_ready_y_no_solo_el_puerto", async () => {
  const child = new EventEmitter();
  child.pid = 777;
  child.exitCode = null;
  child.unref = () => {};
  let healthCalls = 0;
  const harness = createHarness({
    prepared: true,
    ports: [null, null, { pid: 9001 }, { pid: 9001 }, { pid: 9001 }],
    inspectHealth: async () => ++healthCalls >= 2,
    spawn: () => child,
    sleep: async () => {},
  });
  try {
    const result = await runMain(harness, "start", { prompt: async () => true });
    assert.equal(result.receipt.overallStatus, "ready", JSON.stringify(result));
    assert.equal(healthCalls, 2);
  } finally {
    harness.cleanup();
  }
});

test("debe_exigir_consentimiento_process_aunque_el_puerto_este_libre", async () => {
  let prompts = 0;
  let starts = 0;
  const harness = createHarness({
    prepared: true,
    spawn() {
      starts += 1;
      assert.fail("No debe iniciar sin consentimiento process.");
    },
  });
  try {
    const result = await runMain(harness, "start", {
      prompt: async (request) => {
        prompts += 1;
        assert.equal(request.effect, "process");
        return false;
      },
    });

    assert.equal(result.receipt.overallStatus, "blocked");
    assert.equal(result.technicalFailure, false);
    assert.equal(prompts, 1);
    assert.equal(starts, 0);
  } finally {
    harness.cleanup();
  }
});

test("debe_desacoplar_start_y_observar_error_antes_de_pid_y_unref", async () => {
  const events = [];
  const spawnCalls = [];
  const child = new EventEmitter();
  let childPid = 777;
  Object.defineProperty(child, "pid", {
    get() {
      events.push("pid");
      return childPid;
    },
  });
  child.exitCode = null;
  const originalOnce = child.once.bind(child);
  child.once = (event, listener) => {
    events.push(`listener:${event}`);
    const result = originalOnce(event, listener);
    if (event === "spawn") {
      queueMicrotask(() => {
        events.push("event:spawn");
        child.emit("spawn");
      });
    }
    return result;
  };
  child.unref = () => {
    events.push("unref");
    childPid = 777;
  };
  const harness = createHarness({
    prepared: true,
    ports: [null, null, { pid: 9001 }, { pid: 9001 }],
    spawn(executable, argv, options) {
      spawnCalls.push({ executable, argv, options });
      return child;
    },
    sleep: async () => {},
  });
  try {
    const result = await runMain(harness, "start", {
      prompt: async () => true,
    });

    assert.equal(result.receipt.overallStatus, "ready");
    assert.deepEqual(spawnCalls[0]?.argv.slice(1), ["run", "start"]);
    assert.deepEqual(spawnCalls[0]?.options, {
      shell: false,
      cwd: harness.projectRoot,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    assert.ok(events.indexOf("listener:error") < events.indexOf("pid"));
    assert.ok(events.indexOf("event:spawn") < events.indexOf("unref"));
  } finally {
    harness.cleanup();
  }
});

test("debe_fijar_next_a_loopback_en_desarrollo_y_produccion", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );

  assert.match(manifest.scripts.dev, /-H 127\.0\.0\.1/u);
  assert.match(manifest.scripts.start, /-H 127\.0\.0\.1/u);
});

test("debe_bloquear_start_por_timeout_sin_listener", async () => {
  const child = new EventEmitter();
  child.pid = 777;
  child.exitCode = null;
  child.unref = () => {};
  const harness = createHarness({
    prepared: true,
    ports: [null],
    spawn: () => child,
    sleep: async () => {},
    startTimeoutMs: 2,
    startPollIntervalMs: 1,
  });
  try {
    const result = await runMain(harness, "start", {
      prompt: async () => true,
    });
    assert.equal(result.receipt.overallStatus, "blocked");
    assert.equal(result.technicalFailure, true);
  } finally {
    harness.cleanup();
  }
});

test("debe_capturar_error_async_del_hijo_y_conservar_checks", async () => {
  const child = new EventEmitter();
  child.pid = 777;
  child.exitCode = null;
  child.unref = () => {};
  let emitted = false;
  const harness = createHarness({
    prepared: true,
    ports: [null],
    spawn: () => child,
    sleep: async () => {
      if (!emitted) {
        emitted = true;
        child.emit("error", new Error("RUTA_PRIVADA SALIDA_CRUDA"));
      }
    },
  });
  try {
    const output = [];
    const result = await runMain(harness, "start", {
      output: { write: (line) => output.push(line) },
      prompt: async () => true,
    });

    assert.equal(result.technicalFailure, true);
    assert.equal(
      result.receipt.required.some(
        (check) => check.id === "node-npm-runtime" && check.status === "ok",
      ),
      true,
    );
    assert.doesNotMatch(output.join("\n"), /RUTA_PRIVADA|SALIDA_CRUDA/u);
  } finally {
    harness.cleanup();
  }
});

test("debe_tratar_signal_exit_como_proceso_terminado", async () => {
  const child = new EventEmitter();
  child.pid = 777;
  child.exitCode = null;
  child.unref = () => {};
  let portInspections = 0;
  let signaled = false;
  const harness = createHarness({
    prepared: true,
    inspectPort() {
      portInspections += 1;
      return null;
    },
    spawn: () => child,
    sleep: async () => {
      if (!signaled) {
        signaled = true;
        child.emit("exit", null, "SIGTERM");
      }
    },
    startTimeoutMs: 5,
    startPollIntervalMs: 1,
  });
  try {
    const result = await runMain(harness, "start", {
      prompt: async () => true,
    });

    assert.equal(result.receipt.overallStatus, "blocked");
    assert.equal(result.technicalFailure, true);
    assert.ok(portInspections <= 4);
  } finally {
    harness.cleanup();
  }
});

test("debe_requerir_confirmacion_por_pid", async () => {
  const taskkills = [];
  const harness = createHarness({
    prepared: true,
    ports: [{ pid: 4312 }, { pid: 4312 }, { pid: 9999 }],
    spawnSync(executable, argv) {
      if (executable.toLowerCase().endsWith("taskkill.exe")) {
        taskkills.push(argv);
      }
      return { status: 0 };
    },
  });
  try {
    const result = await runMain(harness, "start", {
      prompt: async () => true,
    });

    assert.equal(result.receipt.overallStatus, "blocked");
    assert.deepEqual(taskkills, []);
  } finally {
    harness.cleanup();
  }
});

test("debe_mostrar_puerto_y_pid_antes_de_confirmar_un_taskkill", async () => {
  const prompts = [];
  const output = [];
  const harness = createHarness({
    prepared: true,
    ports: [{ pid: 4312 }, { pid: 9999 }],
  });
  try {
    await runMain(harness, "start", {
      prompt: async (request) => {
        prompts.push(request);
        return false;
      },
      output: { write: (line) => output.push(line) },
    });

    assert.equal(prompts[0]?.port, 3000);
    assert.equal(prompts[0]?.pid, 4312);
    assert.match(output.join("\n"), /puerto 3000 \(PID 4312\)/u);
  } finally {
    harness.cleanup();
  }
});

test("debe_esperar_tras_taskkill_hasta_que_el_puerto_quede_libre", async () => {
  const child = new EventEmitter();
  child.pid = 777;
  child.exitCode = null;
  child.unref = () => {};
  let sleeps = 0;
  const harness = createHarness({
    prepared: true,
    ports: [
      { pid: 4312 },
      { pid: 4312 },
      { pid: 4312 },
      { pid: 4312 },
      null,
      { pid: 9001 },
      { pid: 9001 },
    ],
    spawnSync: () => ({ status: 0 }),
    spawn: () => child,
    sleep: async () => {
      sleeps += 1;
    },
    portReleaseTimeoutMs: 10,
    portReleasePollIntervalMs: 1,
  });
  try {
    const result = await runMain(harness, "start", {
      prompt: async () => true,
    });

    assert.equal(result.receipt.overallStatus, "ready");
    assert.ok(sleeps >= 1);
  } finally {
    harness.cleanup();
  }
});

test("debe_renderizar_next_step_especifico_sin_resanearlo", async () => {
  const output = [];
  await installLocal.main({
    argv: ["node", "script", "check"],
    output: { write: (line) => output.push(line) },
    setExitCode() {},
    createRuntime: () => ({
      execute: () => ({ receipt: blockedDataReceipt() }),
    }),
  });

  assert.match(
    output.join("\n"),
    /Siguiente paso: Conserva los datos locales y solicita un reset separado\./u,
  );
});

test("debe_preservar_recuperaciones_estaticas_aprobadas_en_main", async () => {
  const approvedNextSteps = [
    "Prepara la persistencia local antes de iniciar la aplicación.",
    "Conserva los datos locales y solicita un reset separado. Alternativa segura: detén la preparación sin modificar los datos.",
    "Este asistente solo admite Windows 11.",
    "Confirma la preparación dentro del proyecto antes de continuar.",
    "Confirma el proceso o puerto concreto antes de continuar.",
    "El resguardo se conservó. Restaura los datos manualmente o reintenta la preparación.",
  ];
  const output = [];

  await installLocal.main({
    argv: ["node", "script", "check"],
    output: { write: (line) => output.push(line) },
    setExitCode() {},
    createRuntime: () => ({
      execute: () => ({
        receipt: createPreparationReceipt(
          approvedNextSteps.map((nextStep, index) => ({
            id: `approved-recovery-${index}`,
            classification: "required",
            status: "blocked",
            category:
              index === 2
                ? "platform"
                : index === 4
                  ? "process"
                  : index === 3
                    ? "dependencies"
                    : "data",
            nextStep,
          })),
          [],
        ),
      }),
    }),
  });

  const rendered = output.join("\n");
  for (const nextStep of approvedNextSteps) {
    assert.match(rendered, new RegExp(escapeRegExp(nextStep), "u"));
  }
});

test("debe_cubrir_seis_estados_lineales_con_una_conclusion", async () => {
  assert.equal(
    installLocal.renderConsoleState({ kind: "empty" })[0],
    "El asistente todavía no ha comprobado este equipo.",
  );
  assert.match(
    installLocal.renderConsoleState({ kind: "loading", operation: "check" })[0],
    /diagnóstico: plataforma/u,
  );
  assert.match(
    installLocal.renderConsoleState({ kind: "error", operation: "start", category: "process" })[0],
    /arranque: proceso/u,
  );
  assert.match(
    installLocal.renderConsoleState({ kind: "blocked" })[0],
    /Preparación bloqueada/u,
  );
  assert.match(
    installLocal.renderConsoleState({ kind: "partial" })[0],
    /Uso local básico preparado/u,
  );
  assert.match(
    installLocal.renderConsoleState({ kind: "success" })[0],
    /Uso local básico preparado/u,
  );
});

test("debe_terminar_en_una_sola_conclusion", async () => {
  for (const receipt of [readyReceipt(), blockedDataReceipt()]) {
    const output = [];
    await installLocal.main({
      argv: ["node", "script", "check"],
      output: { write: (line) => output.push(line) },
      setExitCode() {},
      createRuntime: () => ({
        execute: () => ({ receipt }),
      }),
    });

    const conclusions = output.filter(
      (line) =>
        line.startsWith("Uso local básico preparado") ||
        line === "Preparación bloqueada",
    );
    assert.equal(conclusions.length, 1);
  }
});

test("debe_repetir_estado_tras_interrupcion", async () => {
  let executions = 0;
  const runtime = {
    execute() {
      executions += 1;
      return {
        receipt:
          executions === 1
            ? createPreparationReceipt(
                completeRequiredChecks({
                  "node-npm-runtime": { status: "blocked" },
                }),
                [],
              )
            : readyReceipt(),
      };
    },
  };
  const firstOutput = [];
  const secondOutput = [];

  await installLocal.main({
    argv: ["node", "script", "check"],
    output: { write: (line) => firstOutput.push(line) },
    setExitCode() {},
    createRuntime: () => runtime,
  });
  await installLocal.main({
    argv: ["node", "script", "check"],
    output: { write: (line) => secondOutput.push(line) },
    setExitCode() {},
    createRuntime: () => runtime,
  });

  assert.match(firstOutput.join("\n"), /runtime: bloqueada/u);
  for (const category of [
    "plataforma",
    "runtime",
    "dependencias",
    "configuración",
    "persistencia",
    "proceso",
  ]) {
    assert.match(secondOutput.join("\n"), new RegExp(`${category}: comprobada`, "u"));
  }
  assert.doesNotMatch(secondOutput.join("\n"), /Preparación bloqueada/u);
  assert.equal(executions, 2);
});

function createHarness(options = {}) {
  const projectRoot = mkdtempSync(path.join(tmpdir(), "rrss-install-"));
  const platform = options.platform ?? {
    name: "win32",
    release: "10.0.26200",
  };
  const schema = "model A {}";
  const reads = [];
  mkdirSync(path.join(projectRoot, "prisma"));
  mkdirSync(path.join(projectRoot, "node-bin", "npm", "bin"), {
    recursive: true,
  });
  writeFileSync(path.join(projectRoot, ".env.example"), "PLANTILLA");
  writeFileSync(
    path.join(projectRoot, ".env"),
    options.envContent ?? "CONFIGURACION",
  );
  writeFileSync(path.join(projectRoot, "package-lock.json"), "{}");
  writeFileSync(path.join(projectRoot, "prisma", "schema.prisma"), schema);
  const nodeExecutable = path.join(projectRoot, "node-bin", "node.exe");
  const npmCliPath = path.join(
    projectRoot,
    "node-bin",
    "npm",
    "bin",
    "npm-cli.js",
  );
  writeFileSync(nodeExecutable, "NODE");
  writeFileSync(npmCliPath, "NPM CLI");
  if (options.prepared) {
    mkdirSync(path.join(projectRoot, "node_modules"));
    writeFileSync(path.join(projectRoot, "prisma", "dev.db"), "DB");
    mkdirSync(path.join(projectRoot, "data", "installation"), {
      recursive: true,
    });
    writeFileSync(
      path.join(projectRoot, "data", "installation", "managed-v1.json"),
      JSON.stringify({
        ...managedMarker(
          schema,
          path.join(projectRoot, "prisma", "dev.db"),
        ),
        ...options.markerOverride,
      }),
    );
  } else if (options.databaseContent) {
    writeFileSync(
      path.join(projectRoot, "prisma", "dev.db"),
      options.databaseContent,
    );
  }
  let toolsDirectory;
  if (options.optionalTools) {
    toolsDirectory = path.join(projectRoot, "synthetic-tools");
    mkdirSync(toolsDirectory);
    writeFileSync(path.join(toolsDirectory, "ffmpeg.exe"), "TOOL");
    writeFileSync(path.join(toolsDirectory, "ffprobe.exe"), "TOOL");
    mkdirSync(path.join(projectRoot, "node_modules", "playwright"), {
      recursive: true,
    });
  }
  let portIndex = 0;
  const ports = options.ports ?? [null];
  const system = {
    nodeExecutable,
    npmExecPath: npmCliPath,
    canonicalizeSystemExecutable: path.win32.resolve,
    appVersion: "0.1.0",
    exists: options.exists ?? existsSync,
    readText(filePath) {
      reads.push(path.relative(projectRoot, filePath));
      return readFileSync(filePath, "utf8");
    },
    makeDirectory(directoryPath) {
      mkdirSync(directoryPath, { recursive: true });
    },
    copy:
      options.copy ??
      ((source, destination) => {
        writeFileSync(destination, readFileSync(source));
      }),
    move: options.move ?? renameSync,
    writeText:
      options.writeText ??
      ((filePath, content) => writeFileSync(filePath, content)),
    spawnSync:
      options.spawnSync ??
      (() => ({ status: 0, stdout: "10.9.0" })),
    spawn:
      options.spawn &&
      ((...args) => {
        const child = options.spawn(...args);
        if (options.emitSpawn !== false && typeof child?.emit === "function") {
          queueMicrotask(() => child.emit("spawn"));
        }
        return child;
      }),
    inspectPort:
      options.inspectPort ??
      (() => ports[Math.min(portIndex++, ports.length - 1)]),
    inspectHealth: options.inspectHealth ?? (async () => true),
    detectBrowser: async () => options.browserAvailable ?? Boolean(options.optionalTools),
    sleep: options.sleep,
    startTimeoutMs: options.startTimeoutMs,
    startPollIntervalMs: options.startPollIntervalMs,
    portReleaseTimeoutMs: options.portReleaseTimeoutMs,
    portReleasePollIntervalMs: options.portReleasePollIntervalMs,
    now: () => 123456,
    pathEnvironment: toolsDirectory ?? "",
  };
  const runtime = installLocal.createLocalInstallationRuntime({
    projectRoot,
    platform,
    system,
  });
  return {
    projectRoot,
    platform,
    schema,
    npmCliPath,
    reads,
    runtime,
    cleanup: () => rmSync(projectRoot, { recursive: true, force: true }),
  };
}

function runMain(harness, operation, overrides = {}) {
  return installLocal.main({
    argv: ["node", "scripts/install-local.mjs", operation],
    output: overrides.output ?? { write() {} },
    prompt: overrides.prompt ?? (async () => false),
    setExitCode: overrides.setExitCode ?? (() => {}),
    createRuntime: () => harness.runtime,
  });
}

function managedMarker(schema, databasePath) {
  return {
    version: 1,
    schemaSha256: createHash("sha256").update(schema).digest("hex"),
    appVersion: "0.1.0",
    databaseFileId: `ino:${String(statSync(databasePath, { bigint: true }).ino)}`,
  };
}

function readyReceipt(optional = []) {
  return createPreparationReceipt(completeRequiredChecks(), optional);
}

function preparedReceipt(optional = []) {
  return createPreparationReceipt(
    completeRequiredChecks({
      "local-port-process": { status: "blocked" },
    }),
    optional,
  );
}

function blockedDataReceipt() {
  return createPreparationReceipt(
    completeRequiredChecks({
      "local-persistence": { status: "blocked" },
    }),
    [],
  );
}

function completeRequiredChecks(overrides = {}) {
  return REQUIRED_CHECK_MANIFEST.map(({ id, category }) => ({
    id,
    classification: "required",
    status: "ok",
    category,
    nextStep: "Comprobación obligatoria preparada.",
    ...overrides[id],
  }));
}

function npmCommand(argv) {
  return argv.slice(1).join(" ");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
