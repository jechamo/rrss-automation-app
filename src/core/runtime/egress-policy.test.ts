import { describe, expect, it, vi } from "vitest";
import {
  E2EEgressError,
  E2EResponseLimitError,
  assertAllowedEgress,
  createEgressGuard,
  installGlobalEgressGuard,
  installLoopbackRouteGuard,
  isE2EEgressError,
} from "./egress-policy";

describe("política de egreso E2E", () => {
  it.each([
    "http://localhost:3000/api/health/ready",
    "http://127.0.0.1:4317/fixture",
    "http://127.23.45.67:8080/fixture",
    "https://[::1]:4443/fixture",
  ])("debe_permitir_loopback_sin_credenciales: %s", (url) => {
    expect(() => assertAllowedEgress(url)).not.toThrow();
  });

  it.each([
    "https://api.anthropic.com/v1/messages",
    "https://192.168.1.20/private",
    "http://0.0.0.0:3000/",
    "https://user:secret@localhost:3000/",
    "file:///C:/private.txt",
  ])("debe_bloquear_un_destino_externo_antes_de_conectar: %s", (url) => {
    expect(() => assertAllowedEgress(url)).toThrowError(E2EEgressError);
  });

  it("debe_bloquear_un_destino_externo_antes_de_invocar_fetch", async () => {
    const realFetch = vi.fn<typeof fetch>();
    const guardedFetch = createEgressGuard(realFetch);

    await expect(guardedFetch("https://api.openai.com/v1/models"))
      .rejects.toThrowError(/E2E_EGRESS_BLOCKED/u);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("debe_delegar_fetch_cuando_el_destino_es_loopback", async () => {
    const response = new Response("ok");
    const realFetch = vi.fn<typeof fetch>().mockResolvedValue(response);
    const guardedFetch = createEgressGuard(realFetch);

    const guardedResponse = await guardedFetch("http://localhost:4567/fixture");
    expect(guardedResponse).toBeInstanceOf(Response);
    await expect(guardedResponse.text()).resolves.toBe("ok");
    expect(realFetch).toHaveBeenCalledOnce();
  });

  it("debe_desactivar_redirecciones_automaticas_y_rechazar_un_salto_externo", async () => {
    const realFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { Location: "https://example.com/salida" },
    }));
    const guardedFetch = createEgressGuard(realFetch);

    await expect(guardedFetch("http://127.0.0.1:4567/redirige"))
      .rejects.toThrowError(E2EEgressError);
    expect(realFetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4567/redirige",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it.each([7, 8])("debe_aceptar_respuestas_en_n_menos_uno_y_n_bytes: %s", async (bytes) => {
    const realFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("x", {
      headers: { "Content-Length": String(bytes) },
    }));
    const guardedFetch = createEgressGuard(realFetch, { maxResponseBytes: 8, timeoutMs: 100 });

    await expect(guardedFetch("http://127.0.0.1:4567/fixture")).resolves.toBeInstanceOf(Response);
  });

  it("debe_rechazar_una_respuesta_de_n_mas_uno_bytes_antes_de_procesarla", async () => {
    const realFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("x", {
      headers: { "Content-Length": "9" },
    }));
    const guardedFetch = createEgressGuard(realFetch, { maxResponseBytes: 8, timeoutMs: 100 });

    await expect(guardedFetch("http://127.0.0.1:4567/fixture"))
      .rejects.toThrowError(E2EResponseLimitError);
  });

  it("debe_cortar_un_body_sin_content_length_cuando_supera_el_limite", async () => {
    const realFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("1234"));
    const guardedFetch = createEgressGuard(realFetch, { maxResponseBytes: 3, timeoutMs: 100 });

    const response = await guardedFetch("http://127.0.0.1:4567/fixture");
    await expect(response.text()).rejects.toThrowError(E2EResponseLimitError);
  });

  it("debe_aplicar_timeout_material_al_fetch_global", async () => {
    const realFetch = vi.fn<typeof fetch>().mockImplementation((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      }));
    const guardedFetch = createEgressGuard(realFetch, { maxResponseBytes: 8, timeoutMs: 5 });

    await expect(guardedFetch("http://127.0.0.1:4567/lento")).rejects.toThrow(/timed out/iu);
  });

  it("debe_instalar_una_unica_barrera_global_sobre_fetch", async () => {
    const realFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("ok"));
    const host = { fetch: realFetch };

    installGlobalEgressGuard(host);
    const guarded = host.fetch;
    installGlobalEgressGuard(host);

    expect(host.fetch).toBe(guarded);
    await expect(host.fetch("https://api.anthropic.com/v1/messages"))
      .rejects.toThrowError(E2EEgressError);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("debe_reconocer_el_error_a_traves_de_bundles_distintos", () => {
    expect(isE2EEgressError({ code: "E2E_EGRESS_BLOCKED" })).toBe(true);
    expect(isE2EEgressError({ code: "OTRO" })).toBe(false);
  });

  it("debe_abortar_en_el_navegador_antes_de_abrir_un_destino_externo", async () => {
    let handler: ((route: {
      request(): { url(): string };
      continue(): Promise<void>;
      abort(code?: string): Promise<void>;
    }) => Promise<void>) | undefined;
    await installLoopbackRouteGuard({
      async route(_pattern, callback) { handler = callback; },
    });
    const route = {
      request: () => ({ url: () => "https://example.com/tracker" }),
      continue: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
    };

    expect(handler).toBeTypeOf("function");
    await handler!(route);
    expect(route.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(route.continue).not.toHaveBeenCalled();
  });
});
