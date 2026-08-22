/**
 * @param {{
 *   filesystem: {
 *     observePresence: (input: {
 *       projectRoot: string,
 *       candidatePath: string
 *     }) => {candidatePath: string, present: boolean}
 *   }
 * }} dependencies
 */
export function createPersistenceAdapter({ filesystem }) {
  return Object.freeze({
    /**
     * @param {{
     *   projectRoot: string,
     *   databasePath: string,
     *   sidecarPaths: string[],
     *   preparationStatus?: "pending" | "prepared",
     *   managed?: boolean
     * }} input
     */
    inspect({
      projectRoot,
      databasePath,
      sidecarPaths,
      preparationStatus = "pending",
      managed = false,
    }) {
      const database = protectWhenPresent(
        filesystem.observePresence({
          projectRoot,
          candidatePath: databasePath,
        }),
      );
      const sidecars = sidecarPaths.map((candidatePath) =>
        protectWhenPresent(
          filesystem.observePresence({ projectRoot, candidatePath }),
        ),
      );
      const databaseExists = database.present;
      const sidecarExists = sidecars.some((sidecar) => sidecar.present);
      const protectedData = databaseExists || sidecarExists;
      const persistenceReady =
        preparationStatus === "prepared" && (!protectedData || managed);

      return Object.freeze({
        checked: true,
        preparationStatus,
        databaseExists,
        sidecarExists,
        protected: protectedData,
        database,
        sidecars,
        check: Object.freeze({
          id: "local-persistence",
          classification: "required",
          status: persistenceReady ? "ok" : "blocked",
          category: "data",
          nextStep: protectedData
            ? "Conserva los datos locales y solicita un reset separado."
            : persistenceReady
              ? "Persistencia local comprobada."
              : "Prepara la persistencia local antes de iniciar la aplicación.",
        }),
      });
    },
  });
}

/**
 * @param {{candidatePath: string, present: boolean}} observation
 */
function protectWhenPresent(observation) {
  return Object.freeze({
    ...observation,
    protection: observation.present ? "protected" : "none",
  });
}
