import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";

export class UnsafeProjectPathError extends Error {
  constructor() {
    super("La ruta solicitada no es segura.");
    this.name = "UnsafeProjectPathError";
    this.code = "UNSAFE_PROJECT_PATH";
  }
}

export class SensitiveConfigurationPathError extends Error {
  constructor() {
    super("La configuración sensible no se puede resolver.");
    this.name = "SensitiveConfigurationPathError";
    this.code = "SENSITIVE_CONFIGURATION_PATH";
  }
}

/**
 * Resuelve una ruta candidata desde la raíz del proyecto.
 *
 * @param {string} projectRoot
 * @param {string} candidatePath
 * @returns {string}
 */
export function resolveProjectPath(projectRoot, candidatePath) {
  return resolveContainedProjectPath(projectRoot, candidatePath, false);
}

export function resolveProjectWritePath(projectRoot, candidatePath) {
  return resolveContainedProjectPath(projectRoot, candidatePath, candidatePath === ".env");
}

function resolveContainedProjectPath(projectRoot, candidatePath, allowFixedEnv) {
  const root = safeRealPath(projectRoot);

  if (targetsSensitiveConfiguration(candidatePath) && !allowFixedEnv) {
    throw new SensitiveConfigurationPathError();
  }

  if (hasParentTraversal(candidatePath)) {
    throw new UnsafeProjectPathError();
  }

  const candidate = path.resolve(root, candidatePath);
  assertContained(root, candidate);

  const resolvedCandidate = resolveFromExistingAncestor(root, candidate);
  assertContained(root, resolvedCandidate);
  if (
    targetsSensitiveConfiguration(path.relative(root, resolvedCandidate)) &&
    !allowFixedEnv
  ) {
    throw new SensitiveConfigurationPathError();
  }
  return resolvedCandidate;
}

/**
 * @param {string} candidatePath
 * @returns {boolean}
 */
function targetsSensitiveConfiguration(candidatePath) {
  return pathSegments(candidatePath)
    .some((segment) => {
      const basename = segment
        .split(":")[0]
        .replace(/[ .]+$/u, "")
        .toLowerCase();
      return (
        basename !== ".env.example" &&
        (basename === ".env" || basename.startsWith(".env."))
      );
    });
}

/**
 * @param {string} candidatePath
 * @returns {boolean}
 */
function hasParentTraversal(candidatePath) {
  return pathSegments(candidatePath).includes("..");
}

/**
 * @param {string} candidatePath
 * @returns {string[]}
 */
function pathSegments(candidatePath) {
  return candidatePath.split(/[\\/]+/u);
}

/**
 * @param {string} value
 * @returns {string}
 */
function safeRealPath(value) {
  try {
    return realpathSync.native(value);
  } catch {
    throw new UnsafeProjectPathError();
  }
}

/**
 * Canonicaliza el ancestro existente más cercano y conserva bajo él los
 * segmentos todavía inexistentes.
 *
 * @param {string} root
 * @param {string} candidate
 * @returns {string}
 */
function resolveFromExistingAncestor(root, candidate) {
  let ancestor = candidate;
  const missingSegments = [];

  while (true) {
    try {
      const resolvedAncestor = realpathSync.native(ancestor);
      assertContained(root, resolvedAncestor);
      return path.resolve(resolvedAncestor, ...missingSegments);
    } catch (error) {
      if (error instanceof UnsafeProjectPathError) {
        throw error;
      }
      if (filesystemEntryExists(ancestor)) {
        throw new UnsafeProjectPathError();
      }
    }

    const parent = path.dirname(ancestor);
    if (parent === ancestor) {
      throw new UnsafeProjectPathError();
    }
    missingSegments.unshift(path.basename(ancestor));
    ancestor = parent;
  }
}

/**
 * Detecta también enlaces rotos sin leer contenido.
 *
 * @param {string} candidate
 * @returns {boolean}
 */
function filesystemEntryExists(candidate) {
  try {
    lstatSync(candidate);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return false;
    }
    throw new UnsafeProjectPathError();
  }
}

/**
 * @param {string} root
 * @param {string} candidate
 */
function assertContained(root, candidate) {
  const relative = path.relative(root, candidate);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new UnsafeProjectPathError();
  }
}
