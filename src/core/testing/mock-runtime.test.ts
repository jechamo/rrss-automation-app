import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "node:path";
import {
  mockRuntimeReport,
  recordNetworkRequest,
  resetMockRuntime,
  setMockScenario,
  simulateMockProvider,
} from "./mock-runtime";

const original = { ...process.env };

describe("runtime de proveedores E2E", () => {
  beforeEach(() => {
    const runId = "run-mock-runtime-test";
    const dataDir = path.join(process.cwd(), ".e2e-runtime", runId, "data");
    process.env.RRSS_E2E_MODE = "mock";
    process.env.RRSS_E2E_RUN_ID = runId;
    process.env.RRSS_DATA_DIR = dataDir;
    process.env.DATABASE_URL = `file:${path.join(dataDir, "e2e.db").replaceAll("\\", "/")}`;
    resetMockRuntime();
  });

  afterEach(() => {
    process.env = { ...original };
    resetMockRuntime();
  });

  it("registra pendiente y completado sin petición externa", async () => {
    await simulateMockProvider("fal");
    expect(mockRuntimeReport()).toMatchObject({
      simulatedRequests: 1,
      providers: { fal: { requests: 1, transitions: ["pending", "completed"] } },
      performedExternalRequests: 0,
    });
  });

  it("calcula las peticiones realizadas desde eventos reales del guard", () => {
    recordNetworkRequest("loopback");
    recordNetworkRequest("external");
    expect(mockRuntimeReport()).toMatchObject({
      allowedLoopbackRequests: 1,
      performedExternalRequests: 1,
    });
  });

  it.each(["error", "timeout", "invalid"] as const)(
    "falla cerrado para el escenario %s",
    async (scenario) => {
      setMockScenario("heygen", scenario);
      await expect(simulateMockProvider("heygen")).rejects.toThrow(/simulad|inválida/u);
      expect(mockRuntimeReport().providers.heygen.transitions).toEqual(["pending", scenario]);
    },
  );

  it("no puede activarse fuera del perfil E2E", async () => {
    delete process.env.RRSS_E2E_MODE;
    await expect(simulateMockProvider("claude")).rejects.toThrow("E2E_PROFILE_INVALID");
  });
});
