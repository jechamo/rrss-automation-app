import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MockAiEngine, MockFixtureMissingError } from "./mock-engine";
import { getEngine } from "./index";

const original = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in original)) delete process.env[key];
  }
  Object.assign(process.env, original);
});

function activateMock(): void {
  const runId = "run-20260827-engine";
  const dataDir = path.join(process.cwd(), ".e2e-runtime", runId, "data");
  process.env.RRSS_E2E_MODE = "mock";
  process.env.RRSS_E2E_RUN_ID = runId;
  process.env.RRSS_DATA_DIR = dataDir;
  process.env.DATABASE_URL = `file:${path.join(dataDir, "e2e.db").replaceAll("\\", "/")}`;
}

describe("motor IA simulado", () => {
  it("debe_devolver_un_dossier_determinista_para_una_intencion_conocida", async () => {
    activateMock();
    const engine = new MockAiEngine();

    const first = await engine.run({
      system: "Eres un analista de negocio y marketing experto. Analizas productos SaaS/appwebs",
      prompt: "Devuelve un dossier de negocio",
      json: true,
    });
    const second = await engine.run({
      system: "Eres un analista de negocio y marketing experto. Analizas productos SaaS/appwebs",
      prompt: "Devuelve un dossier de negocio",
      json: true,
    });

    expect(first.data).toEqual(second.data);
    expect(first.data).toMatchObject({ nicho: "automatización de contenido" });
  });

  it("debe_fallar_cerrado_cuando_no_hay_fixture", async () => {
    const engine = new MockAiEngine();

    await expect(engine.run({ system: "capacidad nueva", prompt: "sin contrato" }))
      .rejects.toThrowError(MockFixtureMissingError);
  });

  it("debe_seleccionar_el_motor_mock_aunque_ajustes_pidiera_el_cli_real", () => {
    activateMock();

    expect(getEngine("claude-cli")).toBeInstanceOf(MockAiEngine);
  });
});
