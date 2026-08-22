import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { classifyOptionalCapabilities } from "./capabilities.mjs";
import { executeWithConsent } from "./consent.mjs";
import { sanitizeDiagnostic } from "./diagnostics.mjs";
import { resolveProjectPath } from "./paths.mjs";
import * as pathsModule from "./paths.mjs";
import { runPrecheck } from "./precheck.mjs";
import {
  createPreparationReceipt,
  REQUIRED_CHECK_MANIFEST,
} from "./receipt.mjs";

test("debe_bloquear_ready_sin_el_manifiesto_obligatorio_completo", () => {
  const empty = createPreparationReceipt([], []);
  const interrupted = runPrecheck({});
  const subset = runPrecheck({
    required: REQUIRED_CHECK_MANIFEST.slice(0, -1).map(({ id, category }) =>
      requiredCheck(id, category),
    ),
  });
  const complete = runPrecheck({ required: completeRequiredChecks() });

  assert.equal(empty.requiredComplete, false);
  assert.equal(empty.overallStatus, "blocked");
  assert.equal(interrupted.requiredComplete, false);
  assert.equal(interrupted.overallStatus, "blocked");
  assert.equal(subset.requiredComplete, false);
  assert.equal(subset.overallStatus, "blocked");
  assert.equal(complete.requiredComplete, true);
  assert.equal(complete.overallStatus, "ready");
});

test("debe_bloquear_un_obligatorio_que_no_coincide_con_el_manifiesto", () => {
  const spoofed = completeRequiredChecks({
    "windows-11": {
      classification: "optional",
      category: "capability",
    },
  });
  const receipt = createPreparationReceipt(spoofed, []);

  assert.equal(receipt.requiredComplete, false);
  assert.equal(receipt.overallStatus, "blocked");
});

test("debe_bloquear_datos_existentes_sin_reset_confirmado", () => {
  const sensitiveValues = [
    "DATABASE_URL=file:C:\\SyntheticUser\\Private\\dev.db",
    "CONTENIDO_SQLITE_SINTETICO",
  ];

  const receipt = runPrecheck({
    required: completeRequiredChecks({
      "local-persistence": {
        status: "blocked",
        nextStep: sensitiveValues.join(" "),
        rawValue: sensitiveValues[1],
      },
    }),
    optional: [],
  });

  assert.equal(receipt.overallStatus, "blocked");
  assert.equal(receipt.requiredComplete, false);
  assert.equal(
    receipt.required.some(
      (check) => check.category === "data" && check.status === "blocked",
    ),
    true,
  );
  const serialized = JSON.stringify(receipt);
  for (const sensitiveValue of sensitiveValues) {
    assert.doesNotMatch(serialized, new RegExp(escapeRegExp(sensitiveValue)));
  }
});

test("debe_usar_una_sola_fuente_para_datos_protegidos", () => {
  const receipt = runPrecheck({
    required: completeRequiredChecks({
      "local-persistence": {
        status: "blocked",
      },
    }),
    data: { databaseExists: true, sidecarExists: true },
  });

  assert.equal(
    receipt.required.filter((check) => check.category === "data").length,
    1,
  );
  assert.equal(
    receipt.required.some((check) => check.id === "protected-local-data"),
    false,
  );
});

test("debe_bloquear_reset_sin_confirmacion_separada", () => {
  const request = Object.freeze({
    effect: "data-reset",
    scope: "datos locales protegidos",
    rejectionOutcome: "blocked",
  });
  let resetEffects = 0;
  const reset = () => {
    resetEffects += 1;
  };

  executeWithConsent({
    request,
    confirmation: { effect: "project-preparation", approved: true },
    effect: reset,
  });
  executeWithConsent({ request, effect: reset });
  executeWithConsent({
    request,
    confirmation: { effect: "data-reset", approved: false },
    effect: reset,
  });
  assert.equal(resetEffects, 0);

  const approved = executeWithConsent({
    request,
    confirmation: { effect: "data-reset", approved: true },
    effect: reset,
  });

  assert.equal(resetEffects, 1);
  assert.deepEqual(approved, { executed: true, outcome: "executed" });
});

test("debe_declarar_opcional_sin_bloquear_ready", () => {
  const optional = classifyOptionalCapabilities([
    { id: "ffmpeg", available: false, unavailableMode: "blocked" },
  ]);

  const receipt = runPrecheck({
    required: completeRequiredChecks(),
    optional,
    data: { databaseExists: false, sidecarExists: false },
  });

  assert.deepEqual(receipt.optional, [
    {
      id: "ffmpeg",
      classification: "optional",
      status: "optional-blocked",
      category: "capability",
      nextStep:
        "El montaje final no estará disponible; el uso local básico puede continuar.",
    },
  ]);
  assert.equal(receipt.requiredComplete, true);
  assert.equal(receipt.overallStatus, "ready");
});

test("debe_sanear_opcional_desconocido_sin_bloquear_obligatorios", () => {
  const sensitiveNextStep =
    "DATABASE_URL=file:C:\\SyntheticUser\\Private\\dev.db";
  const receipt = runPrecheck({
    required: completeRequiredChecks(),
    optional: [
      {
        id: "future-capability",
        classification: "required",
        status: "future-ok",
        category: "future-category",
        nextStep: sensitiveNextStep,
      },
      {
        id: "browser-automation",
        classification: "optional",
        status: "optional-degraded",
        category: "capability",
        nextStep: sensitiveNextStep,
      },
    ],
    data: { databaseExists: false, sidecarExists: false },
  });

  assert.deepEqual(receipt.optional, [
    {
      id: "future-capability",
      classification: "optional",
      status: "optional-blocked",
      category: "capability",
      nextStep: "Revisa la capacidad opcional antes de continuar.",
    },
    {
      id: "browser-automation",
      classification: "optional",
      status: "optional-degraded",
      category: "capability",
      nextStep: "Revisa la capacidad opcional antes de continuar.",
    },
  ]);
  assert.equal(receipt.requiredComplete, true);
  assert.equal(receipt.overallStatus, "ready");
  assert.doesNotMatch(JSON.stringify(receipt), /DATABASE_URL|SyntheticUser/u);
});

test("debe_recalcular_recibo_en_cada_ejecucion", () => {
  const sourceRequired = completeRequiredChecks();
  const expectedReady = {
    version: 1,
    required: completeRequiredChecks(),
    optional: [],
    requiredComplete: true,
    overallStatus: "ready",
  };

  const first = runPrecheck({
    required: sourceRequired,
    optional: [],
    data: { databaseExists: false, sidecarExists: false },
  });
  sourceRequired[0].status = "blocked";

  const second = runPrecheck({
    required: completeRequiredChecks(),
    optional: [],
    data: { databaseExists: false, sidecarExists: false },
  });
  const interrupted = runPrecheck({
    required: completeRequiredChecks({ "node-npm-runtime": "blocked" }),
  });
  const afterInterruption = runPrecheck({
    required: completeRequiredChecks(),
    optional: [],
    data: { databaseExists: false, sidecarExists: false },
  });

  assert.deepEqual(first, expectedReady);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.required), true);
  assert.equal(Object.isFrozen(first.optional), true);
  assert.equal(first.required.every(Object.isFrozen), true);
  assert.deepEqual(second, expectedReady);
  assert.equal(interrupted.overallStatus, "blocked");
  assert.deepEqual(afterInterruption, expectedReady);
  assert.notStrictEqual(second, afterInterruption);
  assert.notStrictEqual(second.required, afterInterruption.required);
});

test("debe_devolver_recuperacion_segura", () => {
  const sensitivePath = "C:\\SyntheticUser\\Private\\dev.db";
  const sensitiveContent = "CONTENIDO_SQLITE_PRIVADO";

  const receipt = runPrecheck({
    required: [
      {
        id: "configuration-template",
        classification: "required",
        status: "blocked",
        category: "configuration",
        nextStep: `DATABASE_URL=file:${sensitivePath} ${sensitiveContent}`,
        rawValue: sensitiveContent,
      },
    ],
  });

  assert.deepEqual(receipt.required[0], {
    id: "configuration-template",
    classification: "required",
    status: "blocked",
    category: "configuration",
    nextStep:
      "Revisa la plantilla de configuración del proyecto. Alternativa segura: detén la preparación y conserva el estado actual.",
  });
  const serialized = JSON.stringify(receipt);
  assert.doesNotMatch(serialized, /DATABASE_URL/u);
  assert.doesNotMatch(serialized, new RegExp(escapeRegExp(sensitivePath)));
  assert.doesNotMatch(serialized, new RegExp(sensitiveContent));
});

test("debe_rechazar_ready_con_obligatorio_pendiente", () => {
  const receipt = createPreparationReceipt(
    [
      {
        ...requiredCheck("runtime"),
        status: "skipped",
      },
    ],
    [],
  );

  assert.equal(receipt.requiredComplete, false);
  assert.equal(receipt.overallStatus, "blocked");
  assert.throws(
    () => {
      receipt.overallStatus = "ready";
    },
    TypeError,
  );
  assert.equal(receipt.overallStatus, "blocked");
});

test("debe_mantener_precheck_puro_sin_leer_datos_reales", () => {
  const projectRoot = mkdtempSync(
    path.join(tmpdir(), "rrss-precheck-purity-test-"),
  );
  const inspectionCalls = [];

  try {
    mkdirSync(path.join(projectRoot, "prisma"));
    writeFileSync(path.join(projectRoot, ".env"), "SECRET_SYNTHETIC_VALUE");
    writeFileSync(
      path.join(projectRoot, "prisma", "dev.db"),
      "SYNTHETIC_SQLITE_CONTENT",
    );
    const before = snapshotFilesystem(projectRoot);

    const inspectors = Object.freeze({
      inspectRequired() {
        inspectionCalls.push("required-metadata");
        return completeRequiredChecks();
      },
      inspectOptional() {
        inspectionCalls.push("optional-metadata");
        return [];
      },
    });
    const receipt = runPrecheck({
      inspectors,
    });

    const after = snapshotFilesystem(projectRoot);
    assert.deepEqual(Object.keys(inspectors), [
      "inspectRequired",
      "inspectOptional",
    ]);
    assert.deepEqual(inspectionCalls, [
      "required-metadata",
      "optional-metadata",
    ]);
    assert.deepEqual(after, before);
    assert.equal(receipt.overallStatus, "ready");
    assert.doesNotMatch(
      JSON.stringify(receipt),
      /SECRET_SYNTHETIC_VALUE|SYNTHETIC_SQLITE_CONTENT/u,
    );
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("debe_rechazar_ruta_fuera_del_proyecto", () => {
  const sandbox = mkdtempSync(path.join(tmpdir(), "rrss-installation-test-"));
  const projectRoot = path.join(sandbox, "project");
  const externalRoot = path.join(sandbox, "external");
  const externalFile = path.join(externalRoot, "synthetic.txt");
  const syntheticContent = "CONTENIDO_SINTETICO_NO_DEBE_APARECER";

  try {
    mkdirSync(projectRoot);
    mkdirSync(externalRoot);
    writeFileSync(externalFile, syntheticContent);
    symlinkSync(externalRoot, path.join(projectRoot, "escape"), "junction");

    const unsafeCandidates = [
      externalFile,
      path.join("..", "external", "synthetic.txt"),
      path.join("escape", "synthetic.txt"),
    ];

    for (const candidate of unsafeCandidates) {
      assert.throws(
        () => resolveProjectPath(projectRoot, candidate),
        (error) => {
          assert.equal(error?.code, "UNSAFE_PROJECT_PATH");
          assert.doesNotMatch(String(error), new RegExp(syntheticContent));
          return true;
        },
      );
    }
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("debe_resolver_candidato_inexistente_desde_ancestro_seguro", () => {
  const projectRoot = mkdtempSync(
    path.join(tmpdir(), "rrss-installation-clean-clone-test-"),
  );

  try {
    mkdirSync(path.join(projectRoot, "prisma"));
    const candidatePath = path.join("prisma", "dev.db");
    let resolvedPath;

    assert.doesNotThrow(() => {
      resolvedPath = resolveProjectPath(projectRoot, candidatePath);
    });
    assert.equal(resolvedPath, path.join(projectRoot, candidatePath));
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("debe_rechazar_escritura_cuando_un_junction_escapa_del_root", () => {
  assert.equal(typeof pathsModule.resolveProjectWritePath, "function");
  const sandbox = mkdtempSync(path.join(tmpdir(), "rrss-write-path-"));
  const projectRoot = path.join(sandbox, "project");
  const externalRoot = path.join(sandbox, "external");
  try {
    mkdirSync(projectRoot);
    mkdirSync(externalRoot);
    symlinkSync(externalRoot, path.join(projectRoot, "data"), "junction");

    assert.throws(
      () =>
        pathsModule.resolveProjectWritePath(
          projectRoot,
          path.join("data", "installation", "managed-v1.json"),
        ),
      (error) => error?.code === "UNSAFE_PROJECT_PATH",
    );
    assert.equal(
      pathsModule.resolveProjectWritePath(projectRoot, ".env"),
      path.join(projectRoot, ".env"),
    );
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("debe_rechazar_lectura_de_configuracion_sensible", () => {
  const projectRoot = mkdtempSync(
    path.join(tmpdir(), "rrss-installation-config-test-"),
  );
  const syntheticContent = "VALOR_SINTETICO_NO_DEBE_APARECER";

  try {
    writeFileSync(path.join(projectRoot, ".env"), syntheticContent);

    for (const candidatePath of [
      ".env",
      ".env ",
      ".env.",
      ".env::$DATA",
      ".env.local",
      ".env.local ",
      ".env.development",
      ".env.production",
    ]) {
      assert.throws(
        () => resolveProjectPath(projectRoot, candidatePath),
        (error) => {
          assert.equal(error?.code, "SENSITIVE_CONFIGURATION_PATH");
          assert.doesNotMatch(String(error), new RegExp(syntheticContent));
          return true;
        },
      );
    }
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("debe_rechazar_alias_canonico_que_resuelve_a_env", () => {
  const projectRoot = mkdtempSync(
    path.join(tmpdir(), "rrss-installation-env-alias-test-"),
  );
  try {
    mkdirSync(path.join(projectRoot, ".env"));
    writeFileSync(
      path.join(projectRoot, ".env", "valor.txt"),
      "VALOR_SINTETICO",
    );
    symlinkSync(
      path.join(projectRoot, ".env"),
      path.join(projectRoot, "configuracion-local"),
      "junction",
    );

    assert.throws(
      () =>
        resolveProjectPath(
          projectRoot,
          path.join("configuracion-local", "valor.txt"),
        ),
      (error) => error?.code === "SENSITIVE_CONFIGURATION_PATH",
    );
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("debe_sanear_diagnostico_local", () => {
  const sensitiveEnvironment =
    "DATABASE_URL=file:./synthetic-installation.db";
  const syntheticPersonalPath =
    "C:\\SyntheticUser\\Profile\\rrss-installation";
  const rawProcessOutput =
    "salida cruda sintética: --token=TOKEN_SINTETICO";

  const result = sanitizeDiagnostic({
    id: "runtime-check",
    classification: "required",
    status: "blocked",
    category: "runtime",
    nextStep: `${sensitiveEnvironment} ${syntheticPersonalPath}`,
    environment: sensitiveEnvironment,
    personalPath: syntheticPersonalPath,
    rawOutput: rawProcessOutput,
  });

  assert.deepEqual(result, {
    id: "runtime-check",
    classification: "required",
    status: "blocked",
    category: "runtime",
    nextStep: "Comprueba el runtime local antes de continuar.",
  });

  const serialized = JSON.stringify(result);
  for (const sensitiveValue of [
    "DATABASE_URL",
    syntheticPersonalPath,
    rawProcessOutput,
    "TOKEN_SINTETICO",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(escapeRegExp(sensitiveValue)));
  }
});

test("debe_normalizar_error_desconocido_como_bloqueo", () => {
  const result = sanitizeDiagnostic({
    id: "future-check",
    classification: "required",
    status: "future-ok",
    category: "future-category",
    nextStep: "detalle no confiable",
  });

  assert.deepEqual(result, {
    id: "future-check",
    classification: "required",
    status: "blocked",
    category: "configuration",
    nextStep: "Revisa la plantilla de configuración del proyecto.",
  });
  assert.notEqual(result.status, "ok");
});

test("debe_normalizar_ids_maliciosos_sin_buscar_en_el_prototipo", () => {
  const maliciousIds = ["constructor", "toString", "__proto__", "<script>"];

  for (const id of maliciousIds) {
    const required = sanitizeDiagnostic({
      id,
      classification: "required",
      status: "ok",
      category: "runtime",
      nextStep: "detalle no confiable",
    });
    assert.deepEqual(required, {
      id: "unknown-check",
      classification: "required",
      status: "blocked",
      category: "runtime",
      nextStep: "Comprueba el runtime local antes de continuar.",
    });
  }

  const optional = classifyOptionalCapabilities(
    maliciousIds.map((id) => ({ id, available: true })),
  );
  assert.equal(
    optional.every(
      (check) =>
        check.id === "unknown-capability" &&
        check.classification === "optional" &&
        check.status === "optional-blocked" &&
        check.category === "capability" &&
        check.nextStep ===
          "Revisa la capacidad opcional antes de continuar.",
    ),
    true,
  );
  assert.equal(
    optional.every((check) => typeof check.nextStep === "string"),
    true,
  );
  assert.doesNotMatch(
    JSON.stringify(optional),
    /constructor|toString|__proto__|<script>/u,
  );
});

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * @param {string} id
 * @param {import("./types.mjs").CheckCategory} [category]
 * @returns {import("./types.mjs").CheckResult}
 */
function requiredCheck(id, category = id) {
  const nextStepByCategory = {
    platform: "Comprueba la plataforma compatible antes de continuar.",
    runtime: "Comprueba el runtime local antes de continuar.",
    dependencies: "Prepara las dependencias dentro del proyecto.",
    configuration: "Revisa la plantilla de configuración del proyecto.",
    data: "Revisa el estado de los datos locales sin modificarlos.",
    process: "Revisa el proceso o puerto detectado antes de continuar.",
  };

  return {
    id,
    classification: "required",
    status: "ok",
    category,
    nextStep: nextStepByCategory[category],
  };
}

/**
 * @param {Record<string, import("./types.mjs").StepStatus | Partial<import("./types.mjs").CheckResult>>} [overrides]
 * @returns {import("./types.mjs").CheckResult[]}
 */
function completeRequiredChecks(overrides = {}) {
  return REQUIRED_CHECK_MANIFEST.map(({ id, category }) => {
    const override = overrides[id];
    return {
      ...requiredCheck(id, category),
      ...(typeof override === "string" ? { status: override } : override),
    };
  });
}

/**
 * @param {string} root
 * @returns {Record<string, string>}
 */
function snapshotFilesystem(root) {
  /** @type {Record<string, string>} */
  const snapshot = {};

  for (const entry of readdirSync(root, { recursive: true })) {
    const absolutePath = path.join(root, entry);
    snapshot[entry] = statSync(absolutePath).isDirectory()
      ? "<directory>"
      : readFileSync(absolutePath, "utf8");
  }

  return snapshot;
}
