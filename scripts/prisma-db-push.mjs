import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, "db", "push"], {
  // Prisma 6 en Windows puede devolver un Schema engine error vacío con niveles más bajos.
  // Se acota al subproceso de db push; no modifica el entorno del usuario.
  env: { ...process.env, RUST_LOG: "info" },
  shell: false,
  stdio: "inherit",
  windowsHide: true,
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
