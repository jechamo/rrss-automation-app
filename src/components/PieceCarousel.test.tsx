import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { PieceCarousel } from "@/components/PieceCarousel";
import { createTestPiece } from "@/components/content-tray-test-fixtures";

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
});

const pieces = [
  createTestPiece("a", "Pieza A"),
  createTestPiece("b", "Pieza B"),
  createTestPiece("c", "Pieza C"),
];

test("debe_nombrar_indicador_y_pieza_activa", () => {
  render(
    <PieceCarousel
      projectId="p1"
      pieces={pieces}
      activeId="a"
    />,
  );

  expect(screen.getByRole("button", { name: "Ir a pieza 2 de 3" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Pieza activa 1 de 3" })).toBeTruthy();
});

test("debe_conservar_seleccion_sin_movimiento", () => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }),
  });

  render(
    <PieceCarousel
      projectId="p1"
      pieces={pieces}
      activeId="b"
    />,
  );

  expect(screen.getByRole("button", { name: "Pieza activa 2 de 3" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Anterior, pieza 1 de 3" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Siguiente, pieza 3 de 3" })).toBeTruthy();
  expect(screen.getByText("Pieza A")).toBeTruthy();
  expect(screen.getByText("Pieza B")).toBeTruthy();
  expect(screen.getByText("Pieza C")).toBeTruthy();
});

test("debe_actualizar_detalle_en_una_activacion_desde_el_carrusel", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(
    <PieceCarousel
      projectId="p1"
      pieces={pieces}
      activeId="a"
      onSelect={onSelect}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Ir a pieza 2 de 3" }));
  expect(onSelect).toHaveBeenCalledWith("b");
});
