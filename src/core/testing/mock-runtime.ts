import { isMockE2E } from "@/core/runtime/e2e-profile";

export type MockProvider =
  | "claude"
  | "gemini"
  | "fal"
  | "heygen"
  | "elevenlabs"
  | "scrapecreators"
  | "yt-dlp"
  | "github"
  | "web-search"
  | "clips";

export type MockScenario = "success" | "error" | "timeout" | "invalid";
type MockTransition = "pending" | "completed" | Exclude<MockScenario, "success">;

interface ProviderState {
  requests: number;
  transitions: MockTransition[];
}

interface MockRuntimeState {
  scenarios: Partial<Record<MockProvider, MockScenario>>;
  providers: Partial<Record<MockProvider, ProviderState>>;
  blockedExternalAttempts: number;
  allowedLoopbackRequests: number;
  performedExternalRequests: number;
}

const STATE_KEY = Symbol.for("rrss.e2e.mock-runtime");

function state(): MockRuntimeState {
  const root = globalThis as typeof globalThis & { [STATE_KEY]?: MockRuntimeState };
  root[STATE_KEY] ??= {
    scenarios: {},
    providers: {},
    blockedExternalAttempts: 0,
    allowedLoopbackRequests: 0,
    performedExternalRequests: 0,
  };
  return root[STATE_KEY];
}

function assertMockMode(): void {
  if (!isMockE2E()) {
    throw new Error("E2E_PROFILE_INVALID: los proveedores simulados solo existen en el perfil E2E.");
  }
}

export function resetMockRuntime(): void {
  const current = state();
  current.scenarios = {};
  current.providers = {};
  current.blockedExternalAttempts = 0;
  current.allowedLoopbackRequests = 0;
  current.performedExternalRequests = 0;
}

export function setMockScenario(provider: MockProvider, scenario: MockScenario): void {
  assertMockMode();
  state().scenarios[provider] = scenario;
}

export async function simulateMockProvider(provider: MockProvider): Promise<void> {
  assertMockMode();
  const runtime = state();
  const current = runtime.providers[provider] ?? { requests: 0, transitions: [] };
  current.requests += 1;
  current.transitions.push("pending");
  runtime.providers[provider] = current;
  await new Promise((resolve) => setTimeout(resolve, 5));

  const scenario = runtime.scenarios[provider] ?? "success";
  if (scenario === "success") {
    current.transitions.push("completed");
    return;
  }
  current.transitions.push(scenario);
  if (scenario === "timeout") throw new Error(`${provider}: timeout simulado.`);
  if (scenario === "invalid") throw new Error(`${provider}: respuesta inválida simulada.`);
  throw new Error(`${provider}: error controlado simulado.`);
}

export function recordMockProviderUse(provider: MockProvider): void {
  assertMockMode();
  const runtime = state();
  const current = runtime.providers[provider] ?? { requests: 0, transitions: [] };
  current.requests += 1;
  current.transitions.push("pending", "completed");
  runtime.providers[provider] = current;
}

export function recordBlockedExternalAttempt(): void {
  if (process.env.RRSS_E2E_MODE === "mock") state().blockedExternalAttempts += 1;
}

export function recordNetworkRequest(kind: "loopback" | "external"): void {
  if (process.env.RRSS_E2E_MODE !== "mock") return;
  if (kind === "loopback") state().allowedLoopbackRequests += 1;
  else state().performedExternalRequests += 1;
}

export function mockRuntimeReport() {
  const runtime = state();
  const providers = Object.fromEntries(
    Object.entries(runtime.providers).map(([provider, value]) => [provider, {
      requests: value.requests,
      transitions: [...value.transitions],
    }]),
  ) as Record<string, ProviderState>;
  return {
    simulatedRequests: Object.values(providers).reduce((sum, item) => sum + item.requests, 0),
    providers,
    blockedExternalAttempts: runtime.blockedExternalAttempts,
    allowedLoopbackRequests: runtime.allowedLoopbackRequests,
    performedExternalRequests: runtime.performedExternalRequests,
  };
}
