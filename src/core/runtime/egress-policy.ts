import { lookup } from "node:dns/promises";
import {
  recordBlockedExternalAttempt,
  recordNetworkRequest,
} from "@/core/testing/mock-runtime";

export class E2EEgressError extends Error {
  readonly code = "E2E_EGRESS_BLOCKED";

  constructor() {
    super("E2E_EGRESS_BLOCKED: destino no permitido por el perfil de validación.");
    this.name = "E2EEgressError";
  }
}

export class E2EResponseLimitError extends Error {
  readonly code = "E2E_RESPONSE_LIMIT";

  constructor() {
    super("E2E_RESPONSE_LIMIT: la respuesta local supera el límite de validación.");
    this.name = "E2EResponseLimitError";
  }
}

export function isE2EEgressError(error: unknown): error is E2EEgressError {
  return error instanceof E2EEgressError ||
    (typeof error === "object" && error !== null &&
      (error as { code?: unknown }).code === "E2E_EGRESS_BLOCKED");
}

export function assertAllowedEgress(input: string | URL): void {
  let url: URL;
  try {
    url = input instanceof URL ? input : new URL(input);
  } catch {
    throw new E2EEgressError();
  }

  if ((url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username !== "" || url.password !== "" || !isLoopback(url.hostname)) {
    recordBlockedExternalAttempt();
    throw new E2EEgressError();
  }
}

interface EgressGuardOptions {
  maxResponseBytes?: number;
  timeoutMs?: number;
}

export function createEgressGuard(
  fetchImpl: typeof fetch,
  options: EgressGuardOptions = {},
): typeof fetch {
  const maxResponseBytes = positiveInteger(options.maxResponseBytes, 8 * 1024 * 1024);
  const timeoutMs = positiveInteger(options.timeoutMs, 30_000);
  return async function guardedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const target = input instanceof Request ? input.url : input;
    const targetUrl = await assertAllowedResolvedEgress(target);
    recordNetworkRequest("loopback");
    const signals = [AbortSignal.timeout(timeoutMs)];
    if (input instanceof Request) signals.push(input.signal);
    if (init?.signal) signals.push(init.signal);
    const response = await fetchImpl(input, {
      ...init,
      redirect: "manual",
      signal: signals.length === 1 ? signals[0] : AbortSignal.any(signals),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) await assertAllowedResolvedEgress(new URL(location, targetUrl));
      throw new E2EEgressError();
    }
    return limitResponse(response, maxResponseBytes);
  };
}

type FetchHost = { fetch: typeof fetch };
const EGRESS_GUARD_MARKER = Symbol.for("rrss.e2e.global-egress-guard");
type GuardedFetchHost = FetchHost & Record<symbol, unknown>;

export function installGlobalEgressGuard(host: FetchHost = globalThis): void {
  const guardedHost = host as GuardedFetchHost;
  if (guardedHost[EGRESS_GUARD_MARKER] === true) return;
  host.fetch = createEgressGuard(host.fetch.bind(host));
  Object.defineProperty(host, EGRESS_GUARD_MARKER, { value: true });
}

export function isGlobalEgressGuardInstalled(host: FetchHost = globalThis): boolean {
  return (host as GuardedFetchHost)[EGRESS_GUARD_MARKER] === true;
}

type BrowserRoute = {
  request(): { url(): string };
  continue(): Promise<void>;
  abort(code?: string): Promise<void>;
};

type BrowserRouter = {
  route(pattern: string, handler: (route: BrowserRoute) => Promise<void>): Promise<unknown>;
};

export async function installLoopbackRouteGuard(router: BrowserRouter): Promise<void> {
  await router.route("**/*", async (route) => {
    try {
      await assertAllowedResolvedEgress(route.request().url());
      await route.continue();
    } catch (error) {
      if (!(error instanceof E2EEgressError)) throw error;
      await route.abort("blockedbyclient");
    }
  });
}

async function assertAllowedResolvedEgress(input: string | URL): Promise<URL> {
  const url = input instanceof URL ? input : new URL(input);
  assertAllowedEgress(url);
  if (url.hostname.toLocaleLowerCase("en-US") !== "localhost") return url;

  try {
    const addresses = await lookup("localhost", { all: true, verbatim: true });
    if (addresses.length > 0 && addresses.every(({ address }) => isLoopback(address))) return url;
  } catch {
    // La resolución ausente o ambigua falla cerrada.
  }
  recordBlockedExternalAttempt();
  throw new E2EEgressError();
}

function isLoopback(hostname: string): boolean {
  const normalized = hostname.toLocaleLowerCase("en-US");
  return normalized === "localhost" || normalized === "[::1]" || normalized === "::1" ||
    /^127(?:\.\d{1,3}){3}$/u.test(normalized) &&
      normalized.split(".").slice(1).every((part) => Number(part) <= 255);
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function limitResponse(response: Response, maxBytes: number): Response {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    void response.body?.cancel();
    throw new E2EResponseLimitError();
  }
  if (!response.body) return response;

  const reader = response.body.getReader();
  let received = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          controller.close();
          return;
        }
        received += chunk.value.byteLength;
        if (received > maxBytes) {
          await reader.cancel();
          controller.error(new E2EResponseLimitError());
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
