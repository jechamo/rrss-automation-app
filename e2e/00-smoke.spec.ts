import { expect, test } from "playwright/test";
import { assertAllowedEgress } from "../src/core/runtime/egress-policy";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", async (route) => {
    try {
      assertAllowedEgress(route.request().url());
      await route.continue();
    } catch {
      await route.abort("blockedbyclient");
    }
  });
});

test("debe_abrir_una_instalacion_vacia_sin_claves", async ({ page, request }) => {
  const profile = await request.get("/api/e2e/status");
  expect(profile.status()).toBe(200);
  await expect(profile.json()).resolves.toMatchObject({
    profile: "mock",
    isolated: true,
    parentSecretPresent: false,
    businessRows: { projects: 0, pieces: 0 },
  });

  const health = await request.get("/api/health/ready");
  expect(health.status()).toBe(200);
  await expect(health.json()).resolves.toMatchObject({ status: "ready" });

  await page.goto("/");
  await expect(page.getByRole("main").getByRole("img", { name: "LeadView" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Nuevo análisis", exact: true }))
    .toBeVisible();

  await page.goto("/ajustes");
  await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible();
  await expect(page.getByText("Herramientas del sistema", { exact: true })).toBeVisible();
  for (const tool of ["FFmpeg", "ffprobe", "yt-dlp", "Whisper local"]) {
    const row = page.getByText(tool, { exact: true }).locator("../..");
    await expect(row).toContainText("✕");
  }
  await expect(page.getByPlaceholder("Pega tu API key").first()).toBeVisible();
});

test("debe_crear_proyecto_y_persistir_el_dossier_desde_una_web_local", async ({ page, request }) => {
  await page.goto("/proyecto/nuevo");
  await page.getByLabel("Nombre del proyecto").fill("Proyecto E2E local");
  await page.getByLabel("URL de la appweb").fill(process.env.RRSS_E2E_FIXTURE_URL!);
  const createdPromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && new URL(response.url()).pathname === "/api/projects"
  );
  await page.getByRole("button", { name: "Crear y analizar" }).click();
  await createdPromise;

  await expect(page).toHaveURL(/\/proyecto\/[^/]+$/u);
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  await expect(page.getByText("Completado", { exact: true }).first())
    .toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Dossier de negocio" }))
    .toBeVisible({ timeout: 60_000 });

  await expect.poll(async () => {
    try {
      const response = await request.get(`/api/dossier/${projectId}`);
      if (!response.ok()) return null;
      const body = await response.json() as { dossier?: { nicho?: string } | null };
      return body.dossier?.nicho ?? null;
    } catch {
      return null;
    }
  }, {
    timeout: 90_000,
  }).toBe("automatización de contenido");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Dossier de negocio" })).toBeVisible();
});

test("debe_bloquear_una_navegacion_externa_sin_conectar", async ({ page }) => {
  await expect(page.goto("https://example.com/no-debe-conectar", { timeout: 10_000 }))
    .rejects.toThrow(/ERR_BLOCKED_BY_CLIENT|net::ERR_FAILED/u);
});
