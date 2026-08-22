/**
 * @typedef {"project-preparation" | "process" | "cache" | "data-reset" | "outside-project"} ConsentEffect
 */

/**
 * @typedef {object} ConsentRequest
 * @property {ConsentEffect} effect
 * @property {string} scope
 * @property {"blocked" | "skipped"} rejectionOutcome
 */

/**
 * Ejecuta únicamente el efecto cubierto por la petición y la confirmación.
 * Una confirmación ausente equivale siempre a `approved: false`.
 *
 * @param {{
 *   request: ConsentRequest,
 *   confirmation?: {effect?: ConsentEffect, approved?: boolean},
 *   effect: () => unknown
 * }} input
 * @returns {{executed: boolean, outcome: "executed" | "blocked" | "skipped"}}
 */
export function executeWithConsent({
  request,
  confirmation = { effect: request?.effect, approved: false },
  effect,
}) {
  const authorized =
    typeof effect === "function" &&
    confirmation.approved === true &&
    confirmation.effect === request?.effect;

  if (!authorized) {
    return Object.freeze({
      executed: false,
      outcome: request?.rejectionOutcome === "skipped" ? "skipped" : "blocked",
    });
  }

  effect();
  return Object.freeze({ executed: true, outcome: "executed" });
}
