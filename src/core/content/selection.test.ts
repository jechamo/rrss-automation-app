import test from "node:test";
import assert from "node:assert/strict";
import { reconcileActivePiece } from "./selection.js";

test("debe_sincronizar_activo_y_detalle_cuando_cambia_indice", () => {
  const pieces = ["a", "b", "c", "d"];
  assert.deepEqual(reconcileActivePiece("c", 2, pieces), {
    pieceId: "c",
    outcome: "kept",
  });
});

test("debe_reconciliar_activo_cuando_desaparece", () => {
  const previous = ["a", "b", "c", "d"];
  const shrunk = previous.filter((id) => id !== "b");
  assert.deepEqual(reconcileActivePiece("b", 1, shrunk), {
    pieceId: "c",
    outcome: "replaced",
  });
});

test("debe_activar_vecina_anterior_cuando_desaparece_la_ultima", () => {
  const previous = ["a", "b", "c", "d"];
  const shrunk = previous.filter((id) => id !== "d");
  assert.deepEqual(reconcileActivePiece("d", 3, shrunk), {
    pieceId: "c",
    outcome: "replaced",
  });
});

test("debe_vaciar_cuando_la_coleccion_esta_vacia", () => {
  assert.deepEqual(reconcileActivePiece("a", 0, []), {
    pieceId: null,
    outcome: "empty",
  });
});

test("debe_conservar_en_la_primera_carga_sin_activo_previo", () => {
  const pieces = ["a", "b", "c"];
  assert.deepEqual(reconcileActivePiece(null, 0, pieces), {
    pieceId: "a",
    outcome: "kept",
  });
});

test("debe_seleccionar_la_primera_pieza_aunque_exista_indice_heredado", () => {
  const pieces = ["a", "b", "c"];
  assert.deepEqual(reconcileActivePiece(null, 2, pieces), {
    pieceId: "a",
    outcome: "kept",
  });
});

test("debe_acotar_el_indice_fuera_de_rango_sin_excepcion", () => {
  const pieces = ["a", "b"];
  assert.deepEqual(reconcileActivePiece("z", 5, pieces), {
    pieceId: "b",
    outcome: "replaced",
  });
});
