export async function register(): Promise<void> {
  // El import debe ir dentro de un `if` literal sobre NEXT_RUNTIME: webpack solo
  // elimina la rama muerta en el build edge así (no con un `return` anticipado).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.RRSS_E2E_MODE !== "mock") return;
    const { installGlobalEgressGuard } = await import("@/core/runtime/egress-policy");
    installGlobalEgressGuard();
  }
}
