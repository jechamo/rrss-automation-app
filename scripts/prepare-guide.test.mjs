import assert from "node:assert/strict";
import test from "node:test";
import { runPrepareGuide } from "./prepare-guide.mjs";

test("debe_recorrer_pasos_y_no_iniciar_login", async () => {
  const lines = [];
  const operations = [];
  const result = await runPrepareGuide({
    write: (line) => lines.push(line),
    prompt: async () => true,
    runAssistant: async (operation) => {
      operations.push(operation);
      return { exitCode: operation === "check" ? 1 : 0 };
    },
    inspectSession: async () => ({
      status: "login-required",
      blocksBasicUse: false,
      nextStep: "Abre la aplicación Claude y ejecuta /login.",
    }),
  });

  assert.deepEqual(operations, ["check", "prepare", "start"]);
  assert.equal(result.started, true);
  assert.equal(result.session.status, "login-required");
  assert.match(lines.join("\n"), /claude auth login/);
  assert.match(lines.join("\n"), /claude auth status/);
  assert.match(lines.join("\n"), /http:\/\/localhost:3000\/ajustes/);
  assert.match(lines.join("\n"), /npx playwright install chromium/);
  assert.doesNotMatch(lines.join("\n"), /taskkill|iniciar\.bat|password|CLAUDE_CLI_PATH=/i);
});

test("debe_continuar_sin_sesion_de_claude", async () => {
  const result = await runPrepareGuide({
    write() {},
    prompt: async (id) => id !== "prepare",
    runAssistant: async () => ({ exitCode: 0 }),
    inspectSession: async () => ({
      status: "binary-missing",
      blocksBasicUse: false,
      nextStep: "Puedes continuar; los análisis con IA quedarán limitados.",
    }),
  });

  assert.equal(result.prepared, false);
  assert.equal(result.started, true);
  assert.equal(result.session.blocksBasicUse, false);
});

test("debe_omitir_arranque_si_la_persona_rechaza", async () => {
  const operations = [];
  const result = await runPrepareGuide({
    write() {},
    prompt: async (id) => id !== "start",
    runAssistant: async (operation) => {
      operations.push(operation);
      return { exitCode: 0 };
    },
    inspectSession: async () => ({
      status: "ok",
      blocksBasicUse: false,
      nextStep: "Sesión local comprobada.",
    }),
  });

  assert.deepEqual(operations, ["check", "prepare"]);
  assert.equal(result.started, false);
});
