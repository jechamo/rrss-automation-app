/**
 * Crea un adaptador de presencia. Resolver la ruta y consultar su existencia
 * son dependencias explícitas para que el consumidor controle los efectos.
 *
 * @param {{
 *   exists: (absolutePath: string) => boolean,
 *   resolveProjectPath: (projectRoot: string, candidatePath: string) => string
 * }} dependencies
 */
export function createFilesystemAdapter({ exists, resolveProjectPath }) {
  return Object.freeze({
    /**
     * @param {{projectRoot: string, candidatePath: string}} input
     * @returns {{candidatePath: string, present: boolean}}
     */
    observePresence({ projectRoot, candidatePath }) {
      const safePath = resolveProjectPath(projectRoot, candidatePath);
      return Object.freeze({
        candidatePath,
        present: Boolean(exists(safePath)),
      });
    },
  });
}
