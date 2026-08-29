import path from "node:path";

export class E2EProfileError extends Error {
  readonly code = "E2E_PROFILE_INVALID";

  constructor() {
    super("E2E_PROFILE_INVALID: configuración de validación no segura.");
    this.name = "E2EProfileError";
  }
}

export type RuntimeProfile =
  | { mode: "normal"; dataDir: string }
  | { mode: "mock"; runId: string; dataDir: string; databasePath: string };

export type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveRuntimeProfile(
  env: RuntimeEnvironment = process.env,
  cwd = process.cwd(),
): RuntimeProfile {
  const projectRoot = path.resolve(cwd);
  const normalDataDir = path.join(projectRoot, "data");
  const mode = env.RRSS_E2E_MODE;

  if (mode === undefined || mode === "") {
    return { mode: "normal", dataDir: normalDataDir };
  }
  if (mode !== "mock") throw new E2EProfileError();

  const runId = env.RRSS_E2E_RUN_ID;
  if (!runId || !/^[a-z0-9][a-z0-9-]{5,63}$/u.test(runId)) {
    throw new E2EProfileError();
  }

  const expectedDataDir = path.join(projectRoot, ".e2e-runtime", runId, "data");
  const configuredDataDir = env.RRSS_DATA_DIR;
  if (!configuredDataDir || !path.isAbsolute(configuredDataDir)) {
    throw new E2EProfileError();
  }
  const dataDir = path.resolve(configuredDataDir);
  if (!samePath(dataDir, expectedDataDir) || samePath(dataDir, normalDataDir)) {
    throw new E2EProfileError();
  }

  const databasePath = sqlitePath(env.DATABASE_URL);
  if (!databasePath || !isContained(dataDir, databasePath)) {
    throw new E2EProfileError();
  }

  return { mode: "mock", runId, dataDir, databasePath };
}

export function getDataDir(
  env: RuntimeEnvironment = process.env,
  cwd = process.cwd(),
): string {
  return resolveRuntimeProfile(env, cwd).dataDir;
}

export function isMockE2E(env: RuntimeEnvironment = process.env): boolean {
  if (!env.RRSS_E2E_MODE) return false;
  return resolveRuntimeProfile(env).mode === "mock";
}

function sqlitePath(databaseUrl: string | undefined): string | null {
  if (!databaseUrl?.startsWith("file:")) return null;
  const value = databaseUrl.slice("file:".length);
  if (!value || value.startsWith("./") || value.startsWith("../")) return null;
  return path.resolve(value);
}

function isContained(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative.length > 0 && relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function samePath(left: string, right: string): boolean {
  return path.resolve(left).toLocaleLowerCase("en-US") ===
    path.resolve(right).toLocaleLowerCase("en-US");
}
