import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectClaudeSession,
  interpretClaudeSessionOutput,
  pickClaudeBinary,
} from "./claude-session.mjs";

test("debe_tratar_ausencia_de_binario_como_opcional", () => {
  const report = inspectClaudeSession({
    exists: () => false,
    env: {},
    home: "C:\\Users\\ejemplo",
    platform: "win32",
    projectRoot: "C:\\repo",
    runCommand() {
      throw new Error("no debe ejecutarse");
    },
  });

  assert.equal(report.status, "binary-missing");
  assert.equal(report.blocksBasicUse, false);
  assert.match(report.nextStep, /\/login|sesión|continuar/i);
  assert.equal(report.command, undefined);
  assert.doesNotMatch(JSON.stringify(report), /Users\\ejemplo|C:\\repo/);
});

test("debe_pedir_login_sin_autenticar_cuando_la_salida_lo_indica", () => {
  const report = interpretClaudeSessionOutput({
    code: 1,
    stdout: "",
    stderr: "Not logged in · run /login\nC:\\Users\\norkc\\.claude\\credentials.json",
  });

  assert.equal(report.status, "login-required");
  assert.equal(report.blocksBasicUse, false);
  assert.match(report.nextStep, /\/login/);
  assert.doesNotMatch(report.nextStep, /norkc|credentials\.json|Users\\/);
});

test("debe_confirmar_sesion_sin_exponer_rutas", () => {
  const report = interpretClaudeSessionOutput({
    code: 0,
    stdout: "Logged in as user@example.com\nBinary: C:\\Users\\norkc\\AppData\\Roaming\\Claude\\claude.exe",
    stderr: "",
  });

  assert.equal(report.status, "ok");
  assert.equal(report.blocksBasicUse, false);
  assert.doesNotMatch(JSON.stringify(report), /norkc|user@example\.com|AppData/);
});

test("debe_preferir_el_binario_gestionado_sin_devolver_la_ruta", () => {
  const picked = pickClaudeBinary({
    exists: (filePath) => String(filePath).includes("claude-code") && String(filePath).endsWith("claude.exe"),
    env: {},
    home: "C:\\Users\\ejemplo",
    platform: "win32",
    projectRoot: "C:\\repo",
    listDirectories: () => ["2.1.0"],
  });

  assert.equal(picked.found, true);
  assert.equal(picked.source, "managed");
  assert.equal(Object.hasOwn(picked, "command"), true);
  assert.equal(picked.publicPath, undefined);
});

test("debe_inspeccionar_sesion_con_auth_status_inyectado", () => {
  const calls = [];
  const report = inspectClaudeSession({
    exists: (filePath) => String(filePath).endsWith("claude.exe"),
    env: { CLAUDE_CLI_PATH: "C:\\override\\claude.exe" },
    home: "C:\\Users\\ejemplo",
    platform: "win32",
    projectRoot: "C:\\repo",
    runCommand(command, args) {
      calls.push({ hasCommand: typeof command === "string", args });
      if (args[0] === "--version") return { code: 0, stdout: "1.0.0", stderr: "" };
      return { code: 1, stdout: "", stderr: "Not logged in · run /login" };
    },
  });

  assert.equal(report.status, "login-required");
  assert.equal(report.source, "configured");
  assert.deepEqual(calls[1].args, ["auth", "status"]);
  assert.doesNotMatch(JSON.stringify(report), /Users\\ejemplo|claude\.exe/);
});

test("debe_rechazar_un_override_de_windows_que_requiera_shell", () => {
  const picked = pickClaudeBinary({
    exists: (candidate) => candidate === "C:\\override malicioso.cmd",
    env: { CLAUDE_CLI_PATH: "C:\\override malicioso.cmd" },
    home: "C:\\Users\\ejemplo",
    platform: "win32",
    projectRoot: "C:\\repo",
    listDirectories: () => [],
  });

  assert.equal(picked.found, false);
  assert.equal(picked.source, "missing");
});
