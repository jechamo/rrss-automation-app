// @vitest-environment node

import { describe, expect, it } from "vitest";
import { checkDatabaseReadiness, checkReadiness } from "./readiness";

describe("health readiness", () => {
  it("declara ready con base operativa y Vault vacío", async () => {
    await expect(checkReadiness({
      databaseProbe: async () => {},
      vaultProbe: () => "empty",
    })).resolves.toEqual({
      service: "rrss-studio",
      schemaVersion: 1,
      status: "ready",
      checks: { application: "ok", database: "ok", vault: "empty" },
    });
  });

  it("bloquea sin propagar detalles de DB o Vault", async () => {
    const report = await checkReadiness({
      databaseProbe: async () => { throw new Error("C:\\ruta\\privada\\dev.db"); },
      vaultProbe: () => { throw new Error("CLAVE_EN_CLARO"); },
    });

    expect(report.status).toBe("blocked");
    expect(report.checks).toEqual({ application: "ok", database: "blocked", vault: "blocked" });
    expect(JSON.stringify(report)).not.toMatch(/ruta|dev\.db|CLAVE_EN_CLARO/u);
  });

  it("rechaza una SQLite íntegra pero sin el esquema de negocio", async () => {
    const database = {
      $queryRawUnsafe: async () => [{ quick_check: "ok" }],
      project: { count: async () => { throw new Error("no such table: Project"); } },
    };

    await expect(checkDatabaseReadiness(database)).rejects.toThrow();
  });
});
