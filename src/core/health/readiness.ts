export type ReadinessReport = {
  service: "rrss-studio";
  schemaVersion: 1;
  status: "ready" | "blocked";
  checks: {
    application: "ok";
    database: "ok" | "blocked";
    vault: "ok" | "empty" | "blocked";
  };
};

type ReadinessDatabase = {
  $queryRawUnsafe(query: string): Promise<Array<Record<string, unknown>>>;
  project: { count(): Promise<number> };
};

export async function checkDatabaseReadiness(database: ReadinessDatabase): Promise<void> {
  const result = await database.$queryRawUnsafe("PRAGMA quick_check");
  const quickCheck = result[0]?.quick_check;
  if (quickCheck !== "ok") throw new Error("DATABASE_NOT_READY");
  await database.project.count();
}

export async function checkReadiness({
  databaseProbe,
  vaultProbe,
}: {
  databaseProbe: () => Promise<void>;
  vaultProbe: () => "empty" | "ready";
}): Promise<ReadinessReport> {
  let database: ReadinessReport["checks"]["database"] = "ok";
  let vault: ReadinessReport["checks"]["vault"] = "empty";

  try {
    await databaseProbe();
  } catch {
    database = "blocked";
  }
  try {
    vault = vaultProbe() === "ready" ? "ok" : "empty";
  } catch {
    vault = "blocked";
  }

  return {
    service: "rrss-studio",
    schemaVersion: 1,
    status: database === "ok" && vault !== "blocked" ? "ready" : "blocked",
    checks: { application: "ok", database, vault },
  };
}
