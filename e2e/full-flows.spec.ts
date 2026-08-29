import { createHash } from "node:crypto";
import { expect, test } from "playwright/test";
import { assertAllowedEgress } from "../src/core/runtime/egress-policy";
import {
  createAnalyzedProject,
  heygenConfig,
  reviewedFalConfig,
  runResource,
  waitForPiece,
} from "./support/api";
import { ProjectPage } from "./support/project.page";

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

test("competencia, leads y virales se generan y amplían sin duplicados", async ({ page, request }) => {
  const projectId = await createAnalyzedProject(request, "Mercado E2E local");
  const competencia = await runResource(request, projectId, "competencia");
  const leads = await runResource(request, projectId, "leads", { zona: "Madrid" });
  const virales = await runResource(request, projectId, "virales", {
    fuente: "scrapecreators", nivel: "preciso", cantidad: 10, maxCreditos: 10,
  });

  expect((competencia.competencia as { competidores: unknown[] }).competidores).toHaveLength(1);
  expect((leads.leads as { leads: unknown[] }).leads).toHaveLength(1);
  const firstVirales = (virales.virales as { virales: Array<{ url: string }> }).virales;
  expect(firstVirales).toHaveLength(1);
  const firstCompetitionUrls = (competencia.competencia as { competidores: Array<{ url: string }> })
    .competidores.map((item) => item.url);
  const firstLeadUrls = (leads.leads as { leads: Array<{ web: string }> }).leads.map((item) => item.web);
  const firstViralUrls = firstVirales.map((item) => item.url);

  const expandedCompetition = await runResource(request, projectId, "competencia", { modo: "ampliar" });
  const expandedLeads = await runResource(request, projectId, "leads", { modo: "ampliar", zona: "Madrid" });
  const expandedVirales = await runResource(request, projectId, "virales", {
    modo: "ampliar", fuente: "scrapecreators", nivel: "preciso", cantidad: 10, maxCreditos: 10,
  });
  expect((expandedCompetition.competencia as { competidores: unknown[] }).competidores).toHaveLength(1);
  expect((expandedLeads.leads as { leads: unknown[] }).leads).toHaveLength(1);
  expect((expandedVirales.virales as { virales: unknown[] }).virales).toHaveLength(1);
  expect((expandedCompetition.competencia as { competidores: Array<{ url: string }> })
    .competidores.map((item) => item.url)).toEqual(firstCompetitionUrls);
  expect((expandedLeads.leads as { leads: Array<{ web: string }> })
    .leads.map((item) => item.web)).toEqual(firstLeadUrls);
  expect((expandedVirales.virales as { virales: Array<{ url: string }> })
    .virales.map((item) => item.url)).toEqual(firstViralUrls);

  const project = new ProjectPage(page, projectId);
  await project.open();
  await project.expectMarketFixtures();
});

test("fal.ai, HeyGen y ElevenLabs recorren pending hasta pieza lista con assets locales", async ({ request }) => {
  const projectId = await createAnalyzedProject(
    request,
    "Proveedores E2E locales",
    { codeType: "github_public", codePath: "https://github.com/fixture/local" },
  );
  const virales = await runResource(request, projectId, "virales", {
    fuente: "web", nivel: "rapido", cantidad: 10,
  });
  const viralUrl = (virales.virales as { virales: Array<{ url: string }> }).virales[0].url;
  const falStart = await request.post(`/api/projects/${projectId}/content/run`, {
    data: { sourceUrl: viralUrl, config: reviewedFalConfig },
  });
  expect(falStart.status()).toBe(200);
  const falIds = await falStart.json() as { pieceId: string };
  const falPiece = await waitForPiece(request, projectId, falIds.pieceId, "listo");
  const falAssets = falPiece.assets as { clips: string[]; audioPath: string; logs: string[] };
  expect(falAssets.clips).toHaveLength(1);
  expect(falAssets.audioPath).toMatch(/locucion\.mp3$/u);
  expect(falAssets.logs.join(" ")).toContain("simulado local");

  const heygenStart = await request.post(`/api/projects/${projectId}/content/run`, {
    data: { sourceUrl: viralUrl, config: heygenConfig },
  });
  expect(heygenStart.status()).toBe(200);
  const heygenIds = await heygenStart.json() as { pieceId: string };
  const heygenPiece = await waitForPiece(request, projectId, heygenIds.pieceId, "listo");
  const heygenAssets = heygenPiece.assets as { presenterPath: string; videoPath: string };
  expect(heygenAssets.presenterPath).toMatch(/avatar\.mp4$/u);
  expect(heygenAssets.videoPath).toBeTruthy();

  const options = await request.get("/api/providers/heygen/options?kind=avatar");
  await expect(options.json()).resolves.toMatchObject({
    options: [{ id: "avatar-e2e", label: "Avatar E2E local" }],
  });
  const status = await request.get("/api/e2e/status");
  const report = (await status.json()).mockRuntime as {
    providers: Record<string, { transitions: string[] }>;
  };
  expect(report.providers.fal.transitions).toContain("pending");
  expect(report.providers.fal.transitions).toContain("completed");
  expect(report.providers.heygen.transitions).toContain("completed");
  expect(report.providers.elevenlabs.transitions).toContain("completed");
  expect(report.providers.github.transitions).toContain("completed");
});

test("login temporal no expone contraseña y el contenido propio se remonta sin proveedores", async ({ request }) => {
  const ownProjectId = await createAnalyzedProject(request, "Login E2E local");
  const fixtureValue = "clave-fixture-no-secreta";
  const saved = await request.put(`/api/projects/${ownProjectId}/login`, {
    data: { user: "operador@fixture.local", pass: fixtureValue },
  });
  expect(saved.status()).toBe(200);
  const loginStatus = await request.get(`/api/projects/${ownProjectId}/login`);
  const loginText = await loginStatus.text();
  expect(loginText).toContain('"configured":true');
  expect(loginText).not.toContain(fixtureValue);

  const demoStart = await request.post(`/api/projects/${ownProjectId}/content/demo/run`, {
    data: {
      config: heygenConfig,
      demo: {
        funcion: "Panel privado fixture",
        funcionUrl: `${process.env.RRSS_E2E_FIXTURE_URL}/private`,
        pasos: ["Abrir panel privado"],
        navSteps: [
          { action: "goto", url: `${process.env.RRSS_E2E_FIXTURE_URL}/private`, pauseMs: 20 },
          { action: "wait", selector: "#crear", pauseMs: 20 },
        ],
        usarLogin: true,
        grabacionModo: "auto",
      },
    },
  });
  expect(demoStart.status()).toBe(200);
  const { pieceId } = await demoStart.json() as { pieceId: string };
  const piece = await waitForPiece(request, ownProjectId, pieceId, "listo");
  const assets = piece.assets as { recordingPath: string; presenterPath: string };
  expect(assets.recordingPath).toMatch(/screen\.(?:webm|mp4)$/u);
  expect(assets.presenterPath).toBeTruthy();

  const before = await request.get("/api/e2e/status");
  const beforeReport = (await before.json()).mockRuntime as { simulatedRequests: number };
  const remount = await request.post(`/api/content/${ownProjectId}/${pieceId}/remount`, {
    data: { mode: "existing" },
  });
  expect(remount.status()).toBe(200);
  await waitForPiece(request, ownProjectId, pieceId, "listo");
  const after = await request.get("/api/e2e/status");
  const afterReport = (await after.json()).mockRuntime as { simulatedRequests: number };
  expect(afterReport.simulatedRequests).toBe(beforeReport.simulatedRequests);
});

test("laboratorio de clips conserva el terminado al reanudar", async ({ page, request }) => {
  const upload = await request.post("/api/clips", {
    multipart: {
      sourceType: "upload",
      selectionMode: "ai",
      title: "Clip fixture",
      file: {
        name: "fixture.mp4",
        mimeType: "video/mp4",
        buffer: Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex"),
      },
    },
  });
  expect(upload.status()).toBe(202);
  const created = await upload.json() as { job: { id: string } };
  let job: Record<string, unknown> = {};
  await expect.poll(async () => {
    const response = await request.get(`/api/clips/${created.job.id}`);
    job = (await response.json() as { job: Record<string, unknown> }).job;
    return job.status;
  }, { timeout: 30_000 }).toBe("ready");
  const selection = job.selection as {
    transcript: Array<{ text: string }>;
    moments: Array<{ outputName: string }>;
  };
  expect(selection.transcript[0].text).toBe("Resultado fixture sincronizado");
  const outputName = selection.moments[0].outputName;
  const asset = await request.get(`/api/clips/${created.job.id}/asset?name=${outputName}`);
  const beforeHash = createHash("sha256").update(await asset.body()).digest("hex");

  const resume = await request.post(`/api/clips/${created.job.id}/resume`);
  expect(resume.status()).toBe(202);
  await expect.poll(async () => {
    const response = await request.get(`/api/clips/${created.job.id}`);
    return ((await response.json()) as { job: { logs: string[] } }).job.logs.at(-1);
  }).toContain("sin regenerar");
  const sameAsset = await request.get(`/api/clips/${created.job.id}/asset?name=${outputName}`);
  const afterHash = createHash("sha256").update(await sameAsset.body()).digest("hex");
  expect(afterHash).toBe(beforeHash);

  const youtube = await request.post("/api/clips", {
    multipart: {
      sourceType: "youtube",
      sourceUrl: "https://www.youtube.com/watch?v=e2e-fixture",
      selectionMode: "ai",
      title: "Descarga yt-dlp fixture",
    },
  });
  expect(youtube.status()).toBe(202);
  const youtubeJob = await youtube.json() as { job: { id: string } };
  await expect.poll(async () => {
    const response = await request.get(`/api/clips/${youtubeJob.job.id}`);
    return ((await response.json()) as { job: { status: string } }).job.status;
  }).toBe("ready");
  const runtime = await request.get("/api/e2e/status");
  const runtimeReport = (await runtime.json()).mockRuntime as {
    providers: Record<string, { transitions: string[] }>;
  };
  expect(runtimeReport.providers["yt-dlp"].transitions).toContain("completed");

  await page.goto("/clips");
  await expect(page.getByRole("heading", { name: "Laboratorio de clips virales y polémicos" })).toBeVisible();
  await expect(page.getByText("Momento viral fixture", { exact: true })).toBeVisible();
});

test("error, timeout y respuesta inválida son controlados y recuperables", async ({ request }) => {
  const projectId = await createAnalyzedProject(request, "Recuperación E2E local");
  const virales = await runResource(request, projectId, "virales", {
    fuente: "web", nivel: "rapido", cantidad: 10,
  });
  const viralUrl = (virales.virales as { virales: Array<{ url: string }> }).virales[0].url;
  await request.put("/api/e2e/scenario", { data: { provider: "fal", scenario: "error" } });
  const failedStart = await request.post(`/api/projects/${projectId}/content/run`, {
    data: { sourceUrl: viralUrl, config: reviewedFalConfig },
  });
  const failedIds = await failedStart.json() as { pieceId: string };
  const failed = await waitForPiece(request, projectId, failedIds.pieceId, "error");
  expect(JSON.stringify(failed)).toContain("simulado");
  expect(JSON.stringify(failed)).not.toMatch(/api[_-]?key|password|\.vaultkey/iu);

  await request.put("/api/e2e/scenario", { data: { provider: "fal", scenario: "success" } });
  const retriedStart = await request.post(`/api/projects/${projectId}/content/run`, {
    data: { sourceUrl: viralUrl, config: reviewedFalConfig },
  });
  const retriedIds = await retriedStart.json() as { pieceId: string };
  await waitForPiece(request, projectId, retriedIds.pieceId, "listo");

  await request.put("/api/e2e/scenario", { data: { provider: "heygen", scenario: "timeout" } });
  const timeout = await request.post("/api/connectors/heygen/test");
  await expect(timeout.json()).resolves.toMatchObject({ ok: false });
  await request.put("/api/e2e/scenario", { data: { provider: "gemini", scenario: "invalid" } });
  const invalid = await request.post("/api/connectors/gemini/test");
  const invalidBody = await invalid.json() as { ok: boolean; detail: string };
  expect(invalidBody.ok).toBe(false);
  expect(invalidBody.detail).toContain("respuesta inválida simulada");
  expect(invalidBody.detail).not.toMatch(/api[_-]?key|bearer|password/iu);
});

test("la barrera de egreso del servidor bloquea antes de conectar", async ({ request }) => {
  const probe = await request.post("/api/e2e/egress-probe");
  expect(probe.status()).toBe(409);
  await expect(probe.json()).resolves.toEqual({ blocked: true, code: "E2E_EGRESS_BLOCKED" });
  const status = await request.get("/api/e2e/status");
  const report = (await status.json()).mockRuntime as {
    blockedExternalAttempts: number;
    allowedLoopbackRequests: number;
    performedExternalRequests: number;
  };
  expect(report.blockedExternalAttempts).toBeGreaterThan(0);
  expect(report.allowedLoopbackRequests).toBeGreaterThan(0);
  expect(report.performedExternalRequests).toBe(0);
});
