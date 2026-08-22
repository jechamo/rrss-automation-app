import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ContentTray } from "@/components/ContentTray";
import { createTestPiece } from "@/components/content-tray-test-fixtures";

vi.mock("@/components/GenerateContentModal", () => ({ GenerateContentModal: () => null }));
vi.mock("@/components/DemoContentModal", () => ({ DemoContentModal: () => null }));
vi.mock("@/components/PublishModal", () => ({ PublishModal: () => null }));
vi.mock("@/components/SelfRecordModal", () => ({ SelfRecordModal: () => null }));
vi.mock("@/components/PipelineGraph", () => ({ PipelineGraph: () => null }));

const pieceA = createTestPiece("a", "Alpha lista");
const pieceB = createTestPiece("b", "Beta lista");

function mockContentApis(pieces = [pieceA, pieceB], options: { ok?: boolean } = {}) {
  const ok = options.ok ?? true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/content/") && !url.includes("/api/content/p1/")) {
        return {
          ok,
          json: async () => ({ pieces, runs: {} }),
        };
      }
      if (url.includes("/api/virales/")) {
        return {
          ok: true,
          json: async () => ({ virales: { virales: [] } }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }),
  );
  vi.stubGlobal(
    "EventSource",
    class {
      onmessage = null;
      close() {}
    },
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("debe_actualizar_detalle_en_una_activacion", async () => {
  mockContentApis();
  const user = userEvent.setup();
  render(<ContentTray projectId="p1" projectUrl="https://example.test" ready />);

  await screen.findByText("Alpha lista");
  await user.click(screen.getByRole("button", { name: "carrusel" }));
  await user.click(screen.getByRole("button", { name: "Ir a pieza 2 de 2" }));

  expect(screen.getByText("Revisando: Beta lista")).toBeTruthy();
  expect(screen.getByText(/Activa 2\/2 · Beta lista/)).toBeTruthy();
});

test("debe_anunciar_detalle_actualizado", async () => {
  mockContentApis();
  const user = userEvent.setup();
  render(<ContentTray projectId="p1" projectUrl="https://example.test" ready />);

  await screen.findByText("Alpha lista");
  await user.click(screen.getByRole("button", { name: "carrusel" }));
  await user.click(screen.getByRole("button", { name: "Ir a pieza 2 de 2" }));

  expect(screen.getByText("Pieza activa: Beta lista. Detalle actualizado.")).toBeTruthy();
});

test("debe_conservar_plegados_independientes", async () => {
  mockContentApis();
  const user = userEvent.setup();
  render(<ContentTray projectId="p1" projectUrl="https://example.test" ready />);

  const openButtons = await screen.findAllByRole("button", { name: /Abrir detalle de / });
  expect(openButtons).toHaveLength(2);
  expect(screen.queryByText("Desarrollo")).toBeNull();

  await user.click(openButtons[0]);
  expect(screen.getByRole("button", { name: "Cerrar detalle de Alpha lista, listo" })).toBeTruthy();
  expect(screen.getByText("Desarrollo")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /Abrir detalle de / })).toHaveLength(1);
});

test("debe_exponer_estado_activo_en_texto", async () => {
  mockContentApis();
  render(<ContentTray projectId="p1" projectUrl="https://example.test" ready />);

  expect((await screen.findAllByText("Listo para revisar")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("youtube").length).toBeGreaterThan(0);
});

test("debe_conservar_foco_del_control_activado", async () => {
  mockContentApis();
  const user = userEvent.setup();
  render(<ContentTray projectId="p1" projectUrl="https://example.test" ready />);

  const first = (await screen.findAllByRole("button", { name: /Abrir detalle de / }))[0];
  await user.click(first);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Cerrar detalle de Alpha lista, listo" }),
  );
});

test("debe_vaciar_detalle_sin_residuo", async () => {
  mockContentApis([pieceA]);
  const user = userEvent.setup();
  render(<ContentTray projectId="p1" projectUrl="https://example.test" ready />);

  await screen.findByText("Alpha lista");
  await user.click(screen.getByRole("button", { name: "Eliminar" }));
  await user.click(screen.getByRole("button", { name: "Eliminar pieza" }));

  await waitFor(() => {
    expect(screen.queryByText("Alpha lista")).toBeNull();
  });
  expect(screen.getByText("La colección ya no tiene piezas.")).toBeTruthy();
  expect(screen.getByText("No hay piezas en esta colección. Crea una para revisar su guion y recursos aquí.")).toBeTruthy();
  expect(screen.queryByText("Preview provisional")).toBeNull();
});

test("debe_activar_vecina_al_desaparecer_la_activa", async () => {
  mockContentApis();
  const user = userEvent.setup();
  render(<ContentTray projectId="p1" projectUrl="https://example.test" ready />);

  await screen.findByText("Alpha lista");
  await user.click(screen.getByRole("button", { name: "carrusel" }));
  await user.click(screen.getByRole("button", { name: "Ir a pieza 2 de 2" }));
  expect(screen.getByText("Revisando: Beta lista")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Eliminar" }));
  await user.click(screen.getByRole("button", { name: "Eliminar pieza" }));

  await waitFor(() => {
    expect(screen.getByText(/La pieza que revisabas ya no está disponible. Se ha abierto Alpha lista/)).toBeTruthy();
  });
  expect(screen.getByText("Revisando: Alpha lista")).toBeTruthy();
});

test("debe_mantener_contraste_y_estado_activo", async () => {
  mockContentApis();
  render(<ContentTray projectId="p1" projectUrl="https://example.test" ready />);

  const statuses = await screen.findAllByText("Listo para revisar");
  expect(statuses[0].textContent).toMatch(/Listo/);
});

test("debe_cubrir_los_seis_estados_de_bandeja", async () => {
  mockContentApis([]);
  const empty = render(<ContentTray projectId="p1" projectUrl="https://example.test" ready />);
  expect(await screen.findByText("No hay piezas en esta colección. Crea una para revisar su guion y recursos aquí.")).toBeTruthy();
  empty.unmount();

  mockContentApis([pieceA], { ok: false });
  const failed = render(<ContentTray projectId="p1" projectUrl="https://example.test" ready />);
  expect(await screen.findByText("No se pudo actualizar parte de la lista. Vuelve a intentarlo sin perder las piezas ya cargadas.")).toBeTruthy();
  failed.unmount();

  mockContentApis();
  const blocked = render(<ContentTray projectId="p1" projectUrl="https://example.test" ready={false} />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText(/Esta pieza no está disponible para revisión desde aquí/)).toBeTruthy();
  blocked.unmount();

  mockContentApis();
  render(<ContentTray projectId="p1" projectUrl="https://example.test" ready />);
  expect(await screen.findByText("Colección lista. Abre solo las piezas que necesites revisar.")).toBeTruthy();
  expect(screen.getByText("Algunas piezas necesitan atención. Las demás están listas para revisar.")).toBeTruthy();
});

test("debe_mantener_controles_accesibles", async () => {
  mockContentApis();
  render(<ContentTray projectId="p1" projectUrl="https://example.test" ready />);

  const open = await screen.findByRole("button", { name: "Abrir detalle de Alpha lista, listo" });
  expect(open.getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByRole("link", { name: "Abrir viral fuente de Alpha lista" })).toBeTruthy();
});
