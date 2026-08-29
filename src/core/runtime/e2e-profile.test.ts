import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  E2EProfileError,
  resolveRuntimeProfile,
  type RuntimeEnvironment,
} from "./e2e-profile";

const cwd = path.resolve("C:/Synthetic Root/RRSS Project");
const runId = "run-20260827-a";
const dataDir = path.join(cwd, ".e2e-runtime", runId, "data");

function mockEnv(overrides: RuntimeEnvironment = {}): RuntimeEnvironment {
  return {
    RRSS_E2E_MODE: "mock",
    RRSS_E2E_RUN_ID: runId,
    RRSS_DATA_DIR: dataDir,
    DATABASE_URL: `file:${path.join(dataDir, "e2e.db").replaceAll("\\", "/")}`,
    ...overrides,
  };
}

describe("perfil E2E aislado", () => {
  it("debe_rechazar_la_raiz_normal_cuando_el_perfil_mock_esta_activo", () => {
    expect(() => resolveRuntimeProfile(mockEnv({
      RRSS_DATA_DIR: path.join(cwd, "data"),
      DATABASE_URL: `file:${path.join(cwd, "data", "dev.db").replaceAll("\\", "/")}`,
    }), cwd)).toThrowError(E2EProfileError);
  });

  it("debe_conservar_el_modo_normal_cuando_no_se_activa_mock", () => {
    const profile = resolveRuntimeProfile({}, cwd);

    expect(profile).toEqual({
      mode: "normal",
      dataDir: path.join(cwd, "data"),
    });
  });

  it("debe_aceptar_una_raiz_con_espacios_cuando_pertenece_al_run_id", () => {
    const profile = resolveRuntimeProfile(mockEnv(), cwd);

    expect(profile).toMatchObject({ mode: "mock", runId, dataDir });
  });

  it("debe_rechazar_database_url_fuera_de_la_raiz_aislada", () => {
    expect(() => resolveRuntimeProfile(mockEnv({
      DATABASE_URL: "file:C:/Synthetic Root/otro/dev.db",
    }), cwd)).toThrowError(/E2E_PROFILE_INVALID/u);
  });

  it("debe_rechazar_un_modo_desconocido", () => {
    expect(() => resolveRuntimeProfile({ RRSS_E2E_MODE: "maybe" }, cwd))
      .toThrowError(/E2E_PROFILE_INVALID/u);
  });

  it("debe_generar_raices_distintas_para_dos_ejecuciones", () => {
    const first = resolveRuntimeProfile(mockEnv(), cwd);
    const secondRunId = "run-20260827-b";
    const secondDataDir = path.join(cwd, ".e2e-runtime", secondRunId, "data");
    const second = resolveRuntimeProfile(mockEnv({
      RRSS_E2E_RUN_ID: secondRunId,
      RRSS_DATA_DIR: secondDataDir,
      DATABASE_URL: `file:${path.join(secondDataDir, "e2e.db").replaceAll("\\", "/")}`,
    }), cwd);

    expect(first.dataDir).not.toBe(second.dataDir);
  });
});
