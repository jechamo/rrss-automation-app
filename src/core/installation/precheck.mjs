import { sanitizeDiagnostic } from "./diagnostics.mjs";
import { createPreparationReceipt } from "./receipt.mjs";

/**
 * Ejecuta la comprobación de aplicación únicamente sobre observaciones ya
 * normalizadas. No lee contenidos ni invoca efectos.
 *
 * @param {{
 *   required?: import("./types.mjs").CheckResult[],
 *   optional?: import("./types.mjs").CheckResult[],
 *   inspectors?: {
 *     inspectRequired: () => import("./types.mjs").CheckResult[],
 *     inspectOptional: () => import("./types.mjs").CheckResult[],
 *   }
 * }} input
 * @returns {{
 *   version: 1,
 *   required: import("./types.mjs").CheckResult[],
 *   optional: import("./types.mjs").CheckResult[],
 *   requiredComplete: boolean,
 *   overallStatus: "ready" | "blocked"
 * }}
 */
export function runPrecheck(input) {
  const requiredObservations =
    input.inspectors?.inspectRequired() ?? input.required ?? [];
  const optionalObservations =
    input.inspectors?.inspectOptional() ?? input.optional ?? [];
  const required = requiredObservations.map(normalizeRequiredCheck);
  const optional = optionalObservations.map(normalizeOptionalCheck);

  return createPreparationReceipt(required, optional);
}

/**
 * @param {import("./types.mjs").CheckResult} check
 * @returns {import("./types.mjs").CheckResult}
 */
function normalizeRequiredCheck(check) {
  const safeCheck = sanitizeDiagnostic(check);

  if (safeCheck.status !== "blocked") {
    return safeCheck;
  }

  return {
    ...safeCheck,
    nextStep: `${safeCheck.nextStep} Alternativa segura: detén la preparación y conserva el estado actual.`,
  };
}

/**
 * @param {import("./types.mjs").CheckResult} check
 * @returns {import("./types.mjs").CheckResult}
 */
function normalizeOptionalCheck(check) {
  return sanitizeDiagnostic({ ...check, classification: "optional" });
}
