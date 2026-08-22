import { sanitizeDiagnostic } from "./diagnostics.mjs";

/**
 * Convierte observaciones opcionales en resultados seguros sin usar mensajes
 * crudos del adaptador.
 *
 * @param {{id: string, available: boolean, unavailableMode?: "blocked" | "degraded" | "skipped"}[]} capabilities
 * @returns {import("./types.mjs").CheckResult[]}
 */
export function classifyOptionalCapabilities(capabilities) {
  return capabilities.map((capability) =>
    sanitizeDiagnostic({
      id: capability.id,
      classification: "optional",
      status: capability.available
        ? "ok"
        : capability.unavailableMode === "skipped"
          ? "skipped"
        : capability.unavailableMode === "degraded"
          ? "optional-degraded"
          : "optional-blocked",
      category: "capability",
    }),
  );
}
