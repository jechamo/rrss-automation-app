import path from "node:path";

class ProcessAdapterError extends Error {
  /**
   * @param {string} code
   * @param {string} [effect]
   */
  constructor(code, effect) {
    super("La acción de proceso no está autorizada.");
    this.name = "ProcessAdapterError";
    this.code = code;
    if (effect) {
      this.effect = effect;
    }
  }
}

/**
 * @param {{
 *   projectRoot?: string,
 *   nodeExecutable?: string,
 *   npmCliPath?: string,
 *   taskkillExecutable?: string,
 *   inheritOutput?: boolean,
 *   environment?: Record<string, string | undefined>,
 *   buildEnvironment?: Record<string, string | undefined>,
 *   pathApi?: typeof path,
 *   spawn: (executable: string, argv: string[], options: {
 *     shell: false,
 *     cwd?: string,
 *     env?: Record<string, string | undefined>,
 *     detached?: true,
 *     stdio?: "ignore",
 *     windowsHide?: true
 *   }) => unknown
 * }} dependencies
 */
export function createProcessAdapter({
  projectRoot = process.cwd(),
  nodeExecutable = process.execPath,
  npmCliPath = process.env.npm_execpath,
  systemRoot = "C:\\Windows",
  taskkillExecutable = "C:\\Windows\\System32\\taskkill.exe",
  canonicalize = path.resolve,
  pathApi = path,
  spawn,
  inheritOutput = false,
  environment,
  buildEnvironment,
}) {
  /**
   * @param {{executable: string, argv: string[], shell: false}} descriptor
   */
  function classify(descriptor) {
    if (!isAllowedNpmDescriptor(
      descriptor,
      projectRoot,
      nodeExecutable,
      npmCliPath,
      pathApi,
    )) {
      return {
        effect: isOutsideProjectEffect(descriptor, pathApi)
          ? "outside-project"
          : "forbidden",
        allowed: false,
      };
    }
    return {
      effect: descriptor.argv[1] === "--version"
        ? "runtime-inspection"
        : descriptor.argv[2] === "start"
          ? "process"
          : "project-preparation",
      allowed: true,
    };
  }

  /**
   * @param {{executable: string, argv: string[], shell: false}} descriptor
   */
  function invoke(descriptor) {
    assertProcessDescriptor(descriptor);

    const classification = classify(descriptor);
    if (!classification.allowed) {
      throw new ProcessAdapterError(
        classification.effect === "outside-project"
          ? "OUTSIDE_PROJECT_EFFECT_FORBIDDEN"
          : "PROCESS_DESCRIPTOR_FORBIDDEN",
        classification.effect,
      );
    }

    const detachedStart =
      classification.effect === "process" &&
      descriptor.detached === true &&
      descriptor.stdio === "ignore" &&
      descriptor.windowsHide === true;
    const invocationEnvironment =
      descriptor.argv[1] === "run" && descriptor.argv[2] === "build"
        ? buildEnvironment ?? environment
        : environment;
    return spawn(descriptor.executable, descriptor.argv, {
      shell: false,
      ...(projectRoot ? { cwd: projectRoot } : {}),
      ...(invocationEnvironment ? { env: invocationEnvironment } : {}),
      ...(!detachedStart && inheritOutput ? { stdio: "inherit" } : {}),
      ...(detachedStart
        ? { detached: true, stdio: "ignore", windowsHide: true }
        : {}),
    });
  }

  /**
   * @param {{
   *   observation: {detected: boolean, status: string, port?: number, pid?: number},
   *   confirmation: {confirmed: boolean, port?: number, pid?: number}
   * }} input
   */
  function terminateDetected({ observation, confirmation }) {
    if (!isSameDetectedProcess(observation, confirmation)) {
      throw new ProcessAdapterError("PROCESS_CONFIRMATION_REQUIRED");
    }
    assertWindowsSystemExecutable({
      candidate: taskkillExecutable,
      executableName: "taskkill.exe",
      systemRoot,
      canonicalize,
    });

    const descriptor = {
      executable: taskkillExecutable,
      argv: ["/PID", String(observation.pid), "/T", "/F"],
      shell: false,
    };
    const outcome = spawn(descriptor.executable, descriptor.argv, { shell: false });
    return { descriptor, outcome };
  }

  return Object.freeze({
    classify,
    invoke,
    terminateDetected,
    paths: Object.freeze({ nodeExecutable, npmCliPath }),
  });
}

export function assertWindowsSystemExecutable({
  candidate,
  executableName,
  systemRoot,
  canonicalize = path.resolve,
}) {
  try {
    const expected = canonicalize(
      path.join(systemRoot, "System32", executableName),
    );
    const actual = canonicalize(candidate);
    if (String(actual).toLowerCase() === String(expected).toLowerCase()) {
      return;
    }
  } catch {
    // La frontera pública solo expone un código seguro.
  }
  throw new ProcessAdapterError("UNSAFE_SYSTEM_EXECUTABLE");
}

/**
 * @param {unknown} descriptor
 */
function assertProcessDescriptor(descriptor) {
  if (
    !descriptor ||
    typeof descriptor !== "object" ||
    Array.isArray(descriptor) ||
    typeof descriptor.executable !== "string" ||
    descriptor.executable.trim() === "" ||
    !Array.isArray(descriptor.argv) ||
    !descriptor.argv.every((argument) => typeof argument === "string")
  ) {
    throw new ProcessAdapterError("INVALID_PROCESS_DESCRIPTOR");
  }

  if (descriptor.shell !== false) {
    throw new ProcessAdapterError("SHELL_EXECUTION_FORBIDDEN");
  }
}

/**
 * @param {{executable?: string, argv?: string[]}} descriptor
 */
function isOutsideProjectEffect(descriptor, pathApi = path) {
  const executable = executableName(descriptor?.executable);
  const argv = Array.isArray(descriptor?.argv)
    ? descriptor.argv.map((argument) => argument.toLowerCase())
    : [];
  const invokesNpm =
    executable === "npm" ||
    (executable === "node" &&
      pathApi.basename(argv[0] ?? "").toLowerCase() === "npm-cli.js");

  return (
    (invokesNpm &&
      (argv.includes("--global") ||
        argv.includes("-g") ||
        argv.some((argument) => argument.startsWith("--location=global")))) ||
    (executable === "setx" && argv[0] === "path")
  );
}

/**
 * @param {{executable?: string, argv?: string[], cwd?: string}} descriptor
 * @param {string | undefined} projectRoot
 * @param {string | undefined} nodeExecutable
 * @param {string | undefined} npmCliPath
 * @param {typeof path} pathApi
 */
function isAllowedNpmDescriptor(
  descriptor,
  projectRoot,
  nodeExecutable,
  npmCliPath,
  pathApi,
) {
  if (
    !isCanonicalAbsoluteMatch(descriptor?.executable, nodeExecutable, pathApi) ||
    !isApprovedNpmCli(npmCliPath, pathApi) ||
    !isCanonicalAbsoluteMatch(descriptor?.argv?.[0], npmCliPath, pathApi)
  ) {
    return false;
  }
  if (
    projectRoot &&
    (!descriptor.cwd ||
      pathApi.resolve(descriptor.cwd).toLowerCase() !==
        pathApi.resolve(projectRoot).toLowerCase())
  ) {
    return false;
  }
  const argv = descriptor.argv?.slice(1);
  if (!Array.isArray(argv)) {
    return false;
  }
  return [
    ["--version"],
    ["install"],
    ["ci"],
    ["run", "db:generate"],
    ["run", "db:push"],
    ["run", "build"],
    ["run", "start"],
  ].some((allowed) =>
    allowed.length === argv.length &&
    allowed.every((argument, index) => argument === argv[index])
  );
}

function isApprovedNpmCli(candidate, pathApi) {
  return (
    typeof candidate === "string" &&
    pathApi.isAbsolute(candidate) &&
    pathApi.basename(candidate).toLowerCase() === "npm-cli.js"
  );
}

function isCanonicalAbsoluteMatch(candidate, approved, pathApi) {
  return (
    typeof candidate === "string" &&
    typeof approved === "string" &&
    pathApi.isAbsolute(candidate) &&
    pathApi.isAbsolute(approved) &&
    pathApi.resolve(candidate).toLowerCase() ===
      pathApi.resolve(approved).toLowerCase()
  );
}

/**
 * Normaliza ruta y extensión sin ejecutar ni resolver el binario.
 *
 * @param {string | undefined} executable
 */
function executableName(executable) {
  return executable
    ?.split(/[\\/]/u)
    .at(-1)
    ?.replace(/\.(?:cmd|exe)$/iu, "")
    .toLowerCase();
}

/**
 * @param {{detected: boolean, status: string, port?: number, pid?: number}} observation
 * @param {{confirmed: boolean, port?: number, pid?: number}} confirmation
 */
function isSameDetectedProcess(observation, confirmation) {
  return (
    observation?.detected === true &&
    observation.status === "occupied" &&
    Number.isInteger(observation.pid) &&
    confirmation?.confirmed === true &&
    confirmation.pid === observation.pid &&
    confirmation.port === observation.port
  );
}
