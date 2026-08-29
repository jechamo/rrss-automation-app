import { expect, type APIRequestContext } from "playwright/test";

export async function createAnalyzedProject(
  request: APIRequestContext,
  name: string,
  code: { codeType: "none" | "github_public"; codePath?: string } = { codeType: "none" },
): Promise<string> {
  const response = await request.post("/api/projects", {
    data: {
      name,
      url: process.env.RRSS_E2E_FIXTURE_URL,
      codeType: code.codeType,
      codePath: code.codePath,
    },
  });
  expect(response.status()).toBe(200);
  const { projectId } = await response.json() as { projectId: string };
  await expect.poll(async () => (await request.get(`/api/dossier/${projectId}`)).status(), {
    timeout: 30_000,
  }).toBe(200);
  return projectId;
}

export async function runResource(
  request: APIRequestContext,
  projectId: string,
  resource: "competencia" | "leads" | "virales",
  data: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const start = await request.post(`/api/projects/${projectId}/${resource}/run`, { data });
  expect(start.status()).toBe(200);
  let result: Record<string, unknown> = {};
  await expect.poll(async () => {
    try {
      const response = await request.get(`/api/${resource}/${projectId}`);
      result = await response.json() as Record<string, unknown>;
      const run = result.lastRun as { status?: string } | undefined;
      return run?.status === "ok" && result[resource] ? "ok" : run?.status === "error" ? "error" : "pending";
    } catch {
      return "pending";
    }
  }, { timeout: 60_000 }).toBe("ok");
  expect(result[resource]).toBeTruthy();
  return result;
}

export async function waitForPiece(
  request: APIRequestContext,
  projectId: string,
  pieceId: string,
  status: "listo" | "error",
): Promise<Record<string, unknown>> {
  let piece: Record<string, unknown> = {};
  await expect.poll(async () => {
    try {
      const response = await request.get(`/api/content/${projectId}`);
      const body = await response.json() as { pieces: Array<Record<string, unknown>> };
      piece = body.pieces.find((candidate) => candidate.id === pieceId) ?? {};
      return piece.status;
    } catch {
      return "pending";
    }
  }, { timeout: 60_000 }).toBe(status);
  return piece;
}

export const reviewedFalConfig = {
  rama: "fal",
  videoAuto: true,
  videoModelo: "",
  vozProveedor: "elevenlabs",
  vozAuto: true,
  vozId: "",
  falClipSeconds: 5,
  falClipMode: "manual",
  falClipCount: 1,
  usarGemini: true,
  falPromptReview: {
    approvedAt: "2026-08-27T00:00:00.000Z",
    content: {
      plataforma: "tiktok",
      patronAplicado: "resultado primero",
      notaLegal: "Concepto reinterpretado para la marca fixture.",
      guion: {
        gancho: "Mira el resultado fixture",
        desarrollo: "Un recorrido local y controlado",
        cta: "Revisa tu proyecto",
        locucion: "Mira cómo convertimos una app en contenido revisable.",
        hashtags: ["#fixture"],
        duracionTotal: 8,
      },
      escaleta: [{
        n: 1,
        descripcion: "Panel local",
        prompt: "vertical local software dashboard fixture",
        texto: "Resultado",
        segundos: 5,
      }],
    },
  },
};

export const heygenConfig = {
  rama: "heygen",
  videoAuto: false,
  videoModelo: "avatar-e2e",
  vozProveedor: "heygen",
  vozAuto: false,
  vozId: "voice-e2e",
  falClipSeconds: 5,
  falClipMode: "auto",
  falClipCount: 0,
  usarGemini: false,
  heygen: {
    avatarId: "avatar-e2e",
    avatarLabel: "Avatar E2E local",
    narracion: "voice",
    voiceId: "voice-e2e",
    audioAssetId: "",
    audioLabel: "",
  },
};
