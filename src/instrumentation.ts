export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.RRSS_E2E_MODE !== "mock") return;
  const { installGlobalEgressGuard } = await import("@/core/runtime/egress-policy");
  installGlobalEgressGuard();
}
