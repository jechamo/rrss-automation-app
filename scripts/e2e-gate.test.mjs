import { describe, expect, it } from "vitest";
import { resolveE2EGateStatus } from "./e2e-gate.mjs";

describe("gate E2E bloqueante", () => {
  it("devuelve exit code no cero ante un Playwright roto sintético", () => {
    expect(resolveE2EGateStatus(1, { performedExternalRequests: 0 })).toBe(1);
  });

  it("falla cerrado cuando falta la evidencia o hubo una salida externa", () => {
    expect(resolveE2EGateStatus(0, undefined)).toBe(1);
    expect(resolveE2EGateStatus(0, { performedExternalRequests: 1 })).toBe(1);
  });

  it("solo permite verde con Playwright y evidencia local verdes", () => {
    expect(resolveE2EGateStatus(0, { performedExternalRequests: 0 })).toBe(0);
  });
});
