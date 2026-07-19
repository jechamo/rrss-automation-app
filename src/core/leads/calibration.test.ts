import test from "node:test";
import assert from "node:assert/strict";
import { auditLeadCalibration, calibrateLeads } from "./calibration.js";
import { EMPTY_LEADS, type Lead } from "./types.js";

function lead(patch: Partial<Lead> = {}): Lead {
  return {
    nombre: "Negocio",
    tipo: "Gimnasio",
    direccion: "Madrid",
    web: "https://example.com",
    telefono: "",
    email: "",
    motivo: "No dispone de reservas ni seguimiento automatizado",
    temperatura: "caliente",
    canalRecomendado: "correo",
    estrategia: "",
    borrador: { asunto: "", cuerpo: "" },
    fitScore: 5,
    intentScore: 5,
    scoreRazon: "",
    origen: "ia",
    ...patch,
  };
}

test("recalibra lotes 5/5 sin inventar intención", () => {
  const input = { ...EMPTY_LEADS, leads: [lead(), lead({ nombre: "Negocio 2" })] };
  assert.ok(auditLeadCalibration(input).length > 0);

  const result = calibrateLeads(input);
  assert.deepEqual(result.leads.map((item) => [item.fitScore, item.intentScore]), [[4, 3], [4, 3]]);
  assert.ok(result.leads.every((item) => item.temperatura === "templado"));
  assert.ok(result.leads.every((item) => item.scoreRazon.includes("no se observó")));
  assert.deepEqual(auditLeadCalibration(result), []);
});

test("conserva una señal explícita y limita calientes al 25%", () => {
  const result = calibrateLeads({
    ...EMPTY_LEADS,
    leads: Array.from({ length: 4 }, (_, index) =>
      lead({
        nombre: `Negocio ${index + 1}`,
        scoreRazon: "El negocio solicitó presupuesto para una solución de reservas",
      }),
    ),
  });
  assert.equal(result.leads.filter((item) => item.temperatura === "caliente").length, 1);
});
