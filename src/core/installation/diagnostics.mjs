/**
 * @typedef {import("./types.mjs").CheckResult} CheckResult
 */

import {
  CHECK_CATEGORIES,
  CHECK_CLASSIFICATIONS,
  STEP_STATUSES,
} from "./types.mjs";

const SAFE_NEXT_STEP_BY_CATEGORY = new Map([
  ["platform", "Comprueba la plataforma compatible antes de continuar."],
  ["runtime", "Comprueba el runtime local antes de continuar."],
  ["dependencies", "Prepara las dependencias dentro del proyecto."],
  ["configuration", "Revisa la plantilla de configuración del proyecto."],
  ["data", "Revisa el estado de los datos locales sin modificarlos."],
  ["process", "Revisa el proceso o puerto detectado antes de continuar."],
  ["cache", "Revisa la caché local antes de continuar."],
  ["capability", "Revisa la capacidad opcional antes de continuar."],
]);

const SAFE_NEXT_STEP_BY_OPTIONAL_ID = new Map([
  [
    "ai-authenticated",
    "Los análisis con IA no estarán disponibles hasta iniciar sesión localmente.",
  ],
  [
    "external-providers",
    "La generación con proveedores externos no estará disponible hasta configurarlos localmente.",
  ],
  [
    "audiovisual-tools",
    "El montaje audiovisual queda degradado mientras falten las herramientas locales.",
  ],
  [
    "browser-navigation",
    "La grabación y navegación automatizada quedan degradadas. Instala Chromium manualmente con: npx playwright install chromium",
  ],
  [
    "ffmpeg",
    "El montaje final no estará disponible; el uso local básico puede continuar.",
  ],
]);

const SAFE_NEXT_STEP_BY_REQUIRED_ID = new Map([
  [
    "local-persistence",
    "Conserva los datos locales y solicita un reset separado. Alternativa segura: detén la preparación sin modificar los datos.",
  ],
  [
    "local-port-process",
    "Comprueba el proceso o puerto local antes de continuar.",
  ],
]);

const APPROVED_STATIC_NEXT_STEPS = new Set([
  ...SAFE_NEXT_STEP_BY_CATEGORY.values(),
  ...SAFE_NEXT_STEP_BY_OPTIONAL_ID.values(),
  ...SAFE_NEXT_STEP_BY_REQUIRED_ID.values(),
  "Prepara la persistencia local antes de iniciar la aplicación.",
  "Persistencia local comprobada.",
  "Este asistente solo admite Windows 11.",
  "Confirma la preparación dentro del proyecto antes de continuar.",
  "Confirma el proceso o puerto concreto antes de continuar.",
  "El resguardo se conservó. Restaura los datos manualmente o reintenta la preparación.",
  "Operación válida: check|prepare|reset|start.",
  "Revisa la plantilla de configuración del proyecto. Alternativa segura: detén la preparación y conserva el estado actual.",
]);

/**
 * @param {Record<string, unknown>} diagnostic
 * @returns {CheckResult}
 */
export function sanitizeDiagnostic(diagnostic) {
  const classification = normalizeClassification(diagnostic.classification);
  const categoryIsKnown = isAllowed(CHECK_CATEGORIES, diagnostic.category);
  const idIsSafe = isSafeCheckId(diagnostic.id);
  const id = idIsSafe
    ? diagnostic.id
    : classification === "optional"
      ? "unknown-capability"
      : "unknown-check";
  const category = normalizeCategory(diagnostic.category, classification);

  return {
    id,
    classification,
    status: normalizeStatus(
      diagnostic.status,
      categoryIsKnown && idIsSafe,
      classification,
    ),
    category,
    nextStep: safeNextStepFor(
      category,
      id,
      classification,
      diagnostic.status,
      diagnostic.nextStep,
    ),
  };
}

/**
 * @param {unknown} status
 * @param {boolean} categoryIsKnown
 * @param {import("./types.mjs").CheckClassification} classification
 * @returns {import("./types.mjs").StepStatus}
 */
function normalizeStatus(status, categoryIsKnown, classification) {
  const statusIsKnown = categoryIsKnown && isAllowed(STEP_STATUSES, status);
  const statusMatchesClassification =
    classification === "optional"
      ? status === "ok" ||
        status === "optional-blocked" ||
        status === "optional-degraded" ||
        status === "skipped"
      : status === "ok" || status === "blocked" || status === "skipped";

  if (statusIsKnown && statusMatchesClassification) {
    return status;
  }

  return classification === "optional" ? "optional-blocked" : "blocked";
}

/**
 * @param {unknown} category
 * @param {import("./types.mjs").CheckClassification} classification
 * @returns {import("./types.mjs").CheckCategory}
 */
function normalizeCategory(category, classification) {
  if (isAllowed(CHECK_CATEGORIES, category)) {
    return category;
  }

  return classification === "optional" ? "capability" : "configuration";
}

/**
 * @param {unknown} classification
 * @returns {import("./types.mjs").CheckClassification}
 */
function normalizeClassification(classification) {
  return isAllowed(CHECK_CLASSIFICATIONS, classification)
    ? classification
    : "required";
}

/**
 * @param {readonly string[]} allowedValues
 * @param {unknown} value
 * @returns {boolean}
 */
function isAllowed(allowedValues, value) {
  return typeof value === "string" && allowedValues.includes(value);
}

/**
 * Admite ids internos kebab-case y rechaza nombres heredados del prototipo.
 *
 * @param {unknown} id
 * @returns {id is string}
 */
function isSafeCheckId(id) {
  return (
    typeof id === "string" &&
    id.length <= 64 &&
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(id) &&
    id !== "prototype" &&
    !Object.hasOwn(Object.prototype, id)
  );
}

/**
 * @param {import("./types.mjs").CheckCategory} category
 * @param {unknown} id
 * @param {import("./types.mjs").CheckClassification} classification
 * @param {unknown} status
 * @param {unknown} nextStep
 * @returns {string}
 */
function safeNextStepFor(category, id, classification, status, nextStep) {
  if (
    typeof nextStep === "string" &&
    APPROVED_STATIC_NEXT_STEPS.has(nextStep)
  ) {
    return nextStep;
  }

  if (classification === "optional" && typeof id === "string") {
    return (
      SAFE_NEXT_STEP_BY_OPTIONAL_ID.get(id) ??
      SAFE_NEXT_STEP_BY_CATEGORY.get("capability")
    );
  }

  return status === "blocked"
    ? (SAFE_NEXT_STEP_BY_REQUIRED_ID.get(id) ??
        SAFE_NEXT_STEP_BY_CATEGORY.get(category))
    : SAFE_NEXT_STEP_BY_CATEGORY.get(category);
}
