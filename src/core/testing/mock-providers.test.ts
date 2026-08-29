import { describe, expect, it } from "vitest";
import {
  MockProviderMissingError,
  mockProviderAsset,
  mockProviderOptions,
} from "./mock-providers";

describe("proveedores simulados", () => {
  it("debe_usar_valores_ficticios_sin_fallback_real", () => {
    const options = mockProviderOptions("heygen-voices");
    const serialized = JSON.stringify(options);

    expect(options).toEqual([{ id: "voice-e2e", label: "Voz E2E local", hint: "fixture" }]);
    expect(serialized).not.toMatch(/api[_-]?key|token|secret|sk-/iu);
  });

  it("debe_producir_el_mismo_asset_para_la_misma_capacidad", () => {
    const first = mockProviderAsset("fal-video", "piece-1", 2);
    const second = mockProviderAsset("fal-video", "piece-1", 2);

    expect(first).toEqual(second);
    expect(first.name).toBe("clip-2.mp4");
    expect(first.bytes.length).toBeGreaterThan(10);
  });

  it("debe_fallar_cerrado_para_una_capacidad_de_proveedor_desconocida", () => {
    expect(() => mockProviderAsset("provider-nuevo" as never, "piece-1", 0))
      .toThrowError(MockProviderMissingError);
  });
});
