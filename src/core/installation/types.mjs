/**
 * @typedef {"ok" | "blocked" | "optional-blocked" | "optional-degraded" | "skipped"} StepStatus
 */

/**
 * @typedef {"required" | "optional"} CheckClassification
 */

/**
 * @typedef {"platform" | "runtime" | "dependencies" | "configuration" | "data" | "process" | "cache" | "capability"} CheckCategory
 */

/**
 * @typedef {object} CheckResult
 * @property {string} id
 * @property {CheckClassification} classification
 * @property {StepStatus} status
 * @property {CheckCategory} category
 * @property {string} nextStep
 */

/** @type {readonly StepStatus[]} */
export const STEP_STATUSES = Object.freeze([
  "ok",
  "blocked",
  "optional-blocked",
  "optional-degraded",
  "skipped",
]);

/** @type {readonly CheckClassification[]} */
export const CHECK_CLASSIFICATIONS = Object.freeze(["required", "optional"]);

/** @type {readonly CheckCategory[]} */
export const CHECK_CATEGORIES = Object.freeze([
  "platform",
  "runtime",
  "dependencies",
  "configuration",
  "data",
  "process",
  "cache",
  "capability",
]);
