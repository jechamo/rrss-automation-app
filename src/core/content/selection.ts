export type Reconciliation =
  | { pieceId: string; outcome: "kept" }
  | { pieceId: string; outcome: "replaced" }
  | { pieceId: null; outcome: "empty" };

/**
 * Reconcilia la pieza activa contra la colección actual y devuelve valor y
 * desenlace juntos, de modo que la interfaz elija el microcopy correcto sin una
 * segunda fuente de verdad (design.md §7.1, research.md §D-SELECTION-CONTRACT).
 *
 * Prioridad: conservar → vecina siguiente → vecina anterior → vacío.
 *
 * @param previousId    ID activo previo, o `null` en la primera carga.
 * @param previousIndex Posición de referencia; única vía para localizar a la
 *                      vecina cuando el ID ya desapareció de la colección.
 * @param pieceIds      Colección actual, en orden.
 */
export function reconcileActivePiece(
  previousId: string | null,
  previousIndex: number,
  pieceIds: readonly string[],
): Reconciliation {
  if (pieceIds.length === 0) {
    return { pieceId: null, outcome: "empty" };
  }

  if (previousId !== null && pieceIds.includes(previousId)) {
    return { pieceId: previousId, outcome: "kept" };
  }

  // Primera carga: nadie perdió una pieza, así que empieza siempre por la
  // primera y conserva el desenlace "kept", sin reutilizar un índice anterior.
  if (previousId === null) {
    return { pieceId: pieceIds[0], outcome: "kept" };
  }

  // Al desaparecer el ID, la posición que ocupaba pasa a alojar a la vecina
  // siguiente; acotar al último índice válido da la anterior sin excepción.
  const boundedIndex = Math.min(Math.max(previousIndex, 0), pieceIds.length - 1);
  const neighborId = pieceIds[boundedIndex];

  return { pieceId: neighborId, outcome: "replaced" };
}
