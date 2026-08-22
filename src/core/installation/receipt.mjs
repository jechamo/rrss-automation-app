/**
 * Manifiesto estable del uso local básico. Cada id representa una comprobación
 * exigida por el contrato antes de declarar la preparación completa.
 */
export const REQUIRED_CHECK_MANIFEST = Object.freeze([
  Object.freeze({ id: "windows-11", category: "platform" }),
  Object.freeze({ id: "node-npm-runtime", category: "runtime" }),
  Object.freeze({ id: "project-dependencies", category: "dependencies" }),
  Object.freeze({ id: "configuration-template", category: "configuration" }),
  Object.freeze({ id: "local-persistence", category: "data" }),
  Object.freeze({ id: "local-port-process", category: "process" }),
]);

/**
 * Construye un recibo nuevo en cada llamada y copia únicamente la frontera v1.
 *
 * @param {import("./types.mjs").CheckResult[]} required
 * @param {import("./types.mjs").CheckResult[]} optional
 * @returns {{
 *   version: 1,
 *   required: import("./types.mjs").CheckResult[],
 *   optional: import("./types.mjs").CheckResult[],
 *   requiredComplete: boolean,
 *   overallStatus: "ready" | "blocked"
 * }}
 */
export function createPreparationReceipt(required, optional) {
  const requiredSnapshot = Object.freeze(required.map(copyCheckResult));
  const optionalSnapshot = Object.freeze(optional.map(copyCheckResult));
  const checksById = new Map(
    requiredSnapshot.map((check) => [check.id, check]),
  );
  const manifestComplete = REQUIRED_CHECK_MANIFEST.every(
    (requirement) => matchesManifest(checksById.get(requirement.id), requirement),
  );
  const requiredComplete =
    manifestComplete &&
    requiredSnapshot.every((check) => check.status === "ok");

  return Object.freeze({
    version: 1,
    required: requiredSnapshot,
    optional: optionalSnapshot,
    requiredComplete,
    overallStatus: requiredComplete ? "ready" : "blocked",
  });
}

/**
 * @param {import("./types.mjs").CheckResult | undefined} check
 * @param {{id: string, category: import("./types.mjs").CheckCategory}} requirement
 */
function matchesManifest(check, requirement) {
  return (
    check?.classification === "required" &&
    check.status === "ok" &&
    check.category === requirement.category
  );
}

/**
 * @param {import("./types.mjs").CheckResult} check
 * @returns {import("./types.mjs").CheckResult}
 */
function copyCheckResult(check) {
  return Object.freeze({
    id: check.id,
    classification: check.classification,
    status: check.status,
    category: check.category,
    nextStep: check.nextStep,
  });
}
