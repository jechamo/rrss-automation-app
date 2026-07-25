import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFalRequestBody,
  buildHeygenVideoBody,
  classifyPollStatus,
  FAL_MODEL_IDS,
  isRetriableStatus,
  providerHttpError,
  friendlyProviderFailure,
  sanitizeProviderMessage,
  planDemoTimeline,
  queueFailureMessage,
  resolveFalDuration,
  retryDelayMs,
} from "./contracts.js";
import { buildVisualPlan, estimateNarrationSeconds, effectiveClipLimit } from "./planning.js";
import {
  DEFAULT_CONFIG,
  EMPTY_CONTENT,
  validateFalPromptReview,
} from "../content/types.js";
import { coerceMixRecipe, mixVideoCount, mixVisualDuration } from "./mix-contracts.js";

test("fal.ai construye bodies verticales segun cada esquema", () => {
  assert.deepEqual(buildFalRequestBody(FAL_MODEL_IDS.kling, "demo", 9), {
    prompt: "demo",
    aspect_ratio: "9:16",
    duration: "10",
    generate_audio: false,
  });
  assert.deepEqual(buildFalRequestBody(FAL_MODEL_IDS.seedance, "demo", 7), {
    prompt: "demo",
    aspect_ratio: "9:16",
    duration: "7",
  });
  assert.deepEqual(buildFalRequestBody(FAL_MODEL_IDS.luma, "demo", 9), {
    prompt: "demo",
    aspect_ratio: "9:16",
    duration: "9s",
  });
});

test("fal.ai acota duraciones y rechaza contratos desconocidos", () => {
  assert.equal(buildFalRequestBody(FAL_MODEL_IDS.seedance, "demo", 2).duration, "5");
  // Seedance tope en 12: una peticion de 99 (o 15) se acota a "12".
  assert.equal(buildFalRequestBody(FAL_MODEL_IDS.seedance, "demo", 99).duration, "12");
  assert.throws(() => buildFalRequestBody("fal-ai/modelo-antiguo", "demo"), /no tiene un contrato/);
});

test("resolveFalDuration mapea 5/10/15 al esquema de cada modelo", () => {
  // Kling v3: 5/10/15 tal cual.
  assert.deepEqual(resolveFalDuration(FAL_MODEL_IDS.kling, 15), {
    body: "15",
    effectiveSeconds: 15,
    label: "15 s",
  });
  assert.equal(resolveFalDuration(FAL_MODEL_IDS.kling, 10).body, "10");
  // Seedance Pro Fast: 5/10/12 (15 -> 12).
  assert.equal(resolveFalDuration(FAL_MODEL_IDS.seedance, 15).body, "12");
  assert.equal(resolveFalDuration(FAL_MODEL_IDS.seedance, 15).effectiveSeconds, 12);
  assert.equal(resolveFalDuration(FAL_MODEL_IDS.seedance, 10).body, "10");
  // Luma Ray 2: solo 5s/9s (10 y 15 -> 9s).
  assert.equal(resolveFalDuration(FAL_MODEL_IDS.luma, 5).body, "5s");
  assert.equal(resolveFalDuration(FAL_MODEL_IDS.luma, 10).body, "9s");
  assert.equal(resolveFalDuration(FAL_MODEL_IDS.luma, 15).body, "9s");
  assert.equal(resolveFalDuration(FAL_MODEL_IDS.luma, 15).effectiveSeconds, 9);
});

test("buildFalRequestBody incluye 15 en Kling", () => {
  assert.deepEqual(buildFalRequestBody(FAL_MODEL_IDS.kling, "demo", 15), {
    prompt: "demo",
    aspect_ratio: "9:16",
    duration: "15",
    generate_audio: false,
  });
});

test("fal.ai usa los contratos oficiales de Seedance 2, Kling 2.5 y Veo 3.1", () => {
  assert.deepEqual(buildFalRequestBody(FAL_MODEL_IDS.seedanceV2Fast, "demo", 15), {
    prompt: "demo",
    resolution: "720p",
    aspect_ratio: "9:16",
    duration: "15",
    generate_audio: false,
  });
  assert.deepEqual(buildFalRequestBody(FAL_MODEL_IDS.kling25, "demo", 15), {
    prompt: "demo",
    aspect_ratio: "9:16",
    duration: "10",
  });
  assert.deepEqual(buildFalRequestBody(FAL_MODEL_IDS.veo31Fast, "demo", 10), {
    prompt: "demo",
    aspect_ratio: "9:16",
    duration: "8s",
    resolution: "1080p",
    generate_audio: false,
  });
  assert.equal(resolveFalDuration(FAL_MODEL_IDS.veo31, 5).body, "4s");
  assert.equal(resolveFalDuration(FAL_MODEL_IDS.klingPro, 15).body, "15");
});

test("fal.ai exige prompts revisados y conserva compatibilidad con HeyGen", () => {
  assert.match(validateFalPromptReview(DEFAULT_CONFIG, "viral"), /revisa los prompts/i);
  assert.equal(
    validateFalPromptReview({ ...DEFAULT_CONFIG, rama: "heygen" }, "viral"),
    "",
  );
  const approved = {
    ...DEFAULT_CONFIG,
    falClipMode: "manual" as const,
    falClipCount: 1,
    falPromptReview: {
      approvedAt: "2026-07-19T10:00:00.000Z",
      content: {
        ...EMPTY_CONTENT,
        escaleta: [
          { n: 1, descripcion: "Plano", prompt: "Cinematic vertical shot", texto: "", segundos: 5 },
        ],
      },
    },
  };
  assert.equal(validateFalPromptReview(approved, "viral"), "");
});

test("HeyGen usa exactamente una narracion", () => {
  assert.deepEqual(
    buildHeygenVideoBody({ avatarId: "avatar-1", texto: "Hola", voiceId: "voice-1" }),
    {
      type: "avatar",
      avatar_id: "avatar-1",
      resolution: "1080p",
      aspect_ratio: "9:16",
      title: "RRSS Studio",
      script: "Hola",
      voice_id: "voice-1",
    },
  );
  assert.deepEqual(
    buildHeygenVideoBody({ avatarId: "avatar-1", audioAssetId: "audio-1" }),
    {
      type: "avatar",
      avatar_id: "avatar-1",
      resolution: "1080p",
      aspect_ratio: "9:16",
      title: "RRSS Studio",
      audio_asset_id: "audio-1",
    },
  );
  assert.throws(
    () => buildHeygenVideoBody({ avatarId: "avatar-1" }),
    /exactamente una fuente/,
  );
  assert.throws(
    () =>
      buildHeygenVideoBody({
        avatarId: "avatar-1",
        texto: "Hola",
        audioAssetId: "audio-1",
      }),
    /exactamente una fuente/,
  );
});

test("errores HTTP simulados no filtran credenciales y respetan reintentos", () => {
  const body = JSON.stringify({
    error: { code: "rate_limit_exceeded", message: "Too many requests" },
  });
  assert.equal(providerHttpError("HeyGen", 429, body), "HeyGen 429: Too many requests");
  assert.equal(providerHttpError("HeyGen", 502, "<html>bad gateway</html>"), "HeyGen respondio 502.");
  assert.equal(isRetriableStatus(429), true);
  assert.equal(isRetriableStatus(503), true);
  assert.equal(isRetriableStatus(400), false);
  assert.equal(retryDelayMs("7", 0), 7000);
  assert.equal(retryDelayMs(null, 2), 6000);
});

test("polling y errores de cola se interpretan de forma defensiva", () => {
  assert.equal(classifyPollStatus("processing"), "pending");
  assert.equal(classifyPollStatus("COMPLETED"), "completed");
  assert.equal(classifyPollStatus("FAILED"), "failed");
  assert.equal(queueFailureMessage({ message: "modelo sin capacidad" }), "modelo sin capacidad");
  assert.equal(
    queueFailureMessage(undefined, [{ message: "iniciando" }, { message: "fallo final" }]),
    "fallo final",
  );
});

test("errores de proveedor muestran causas accionables y ocultan secretos", () => {
  assert.equal(
    friendlyProviderFailure("fal.ai", "HTTP 402: insufficient credits"),
    "fal.ai: saldo o créditos insuficientes. Revisa la facturación del proveedor.",
  );
  assert.equal(
    friendlyProviderFailure("fal.ai", "HTTP 429: too many requests"),
    "fal.ai: límite temporal de solicitudes alcanzado. Espera unos minutos y reintenta.",
  );
  assert.doesNotMatch(
    friendlyProviderFailure("fal.ai", "authorization: Bearer secreto123 fallo remoto"),
    /secreto123/,
  );
  assert.equal(
    sanitizeProviderMessage("https://example.test/run?key=secreto123&model=x"),
    "https://example.test/run?key=[oculto]&model=x",
  );
});

test("la timeline de demo incluye todos los cortes fal.ai en orden", () => {
  const timeline = planDemoTimeline(
    [
      { prompt: "hook" },
      { prompt: "" },
      { prompt: "apoyo 2" },
      { prompt: "" },
      { prompt: "apoyo 3" },
      { prompt: "cierre" },
    ],
    4,
  );
  assert.deepEqual(
    timeline.filter((slot) => slot.kind === "clip").map((slot) => slot.clipIndex),
    [0, 1, 2, 3],
  );
  assert.equal(timeline.filter((slot) => slot.kind === "recording").length, 2);
});

test("el plan audiovisual calcula cortes antes de consumir fal.ai", () => {
  const config = { ...DEFAULT_CONFIG, falClipMode: "auto" as const };
  const plan = buildVisualPlan({
    config,
    origin: "own",
    recordingSeconds: 13,
    targetSeconds: 30,
  });
  assert.equal(plan.protectedDemoSeconds, 13);
  assert.equal(plan.brollSeconds, 17);
  assert.equal(plan.clipCount, 4);
  assert.equal(plan.generatedSeconds, 20);
  assert.equal(plan.estimated, true); // falta locucion real
});

test("el limite manual de cortes respeta 0-6 y no inventa recursos", () => {
  assert.equal(effectiveClipLimit({ ...DEFAULT_CONFIG, falClipMode: "manual", falClipCount: 0 }), 0);
  assert.equal(effectiveClipLimit({ ...DEFAULT_CONFIG, falClipMode: "manual", falClipCount: 6 }), 6);
  assert.equal(
    buildVisualPlan({
      config: { ...DEFAULT_CONFIG, falClipMode: "manual", falClipCount: 2 },
      origin: "viral",
    }).clipCount,
    2,
  );
  assert.ok(estimateNarrationSeconds("una locucion breve pero medible") > 0);
});

test("MIX v1 sigue siendo compatible y MIX v2 conserva recortes y bloqueos", () => {
  const legacy = coerceMixRecipe({
    videoAssetIds: ["a", "a", "b"],
    subtitleText: "Texto",
  });
  assert.equal(legacy.version, 1);
  assert.deepEqual(legacy.videoAssetIds, ["a", "b"]);
  assert.equal(mixVideoCount(legacy), 2);

  const timeline = coerceMixRecipe({
    version: 2,
    segments: [
      { assetId: "demo", sourceStart: 2, sourceEnd: 6.5, label: "Resultado", locked: true },
      { assetId: "clip", sourceStart: 0, sourceEnd: 3, label: "B-roll" },
    ],
    overlays: [
      { assetId: "overlay", sourceStart: 1, sourceEnd: 4, timelineStart: 2, mode: "pip", position: "bottom-right", size: 0.42 },
    ],
    subtitleText: "Texto",
  });
  assert.equal(timeline.version, 2);
  assert.equal(mixVideoCount(timeline), 2);
  assert.equal(mixVisualDuration(timeline), 7.5);
  assert.equal(timeline.segments[0].locked, true);
  assert.equal(timeline.overlays.length, 1);
  assert.equal(timeline.overlays[0].mode, "pip");
  assert.equal(timeline.overlays[0].position, "bottom-right");
  assert.equal(timeline.overlays[0].timelineStart, 2);
  assert.equal(timeline.includeBrandOutro, true);
});

test("MIX v2 descarta segmentos imposibles de forma defensiva", () => {
  const recipe = coerceMixRecipe({
    version: 2,
    segments: [
      { assetId: "", sourceStart: 0, sourceEnd: 3 },
      { assetId: "a", sourceStart: 4, sourceEnd: 2 },
      { assetId: "ok", sourceStart: -2, sourceEnd: 2 },
    ],
  });
  assert.equal(recipe.segments.length, 1);
  assert.equal(recipe.segments[0].sourceStart, 0);
  assert.equal(recipe.segments[0].sourceEnd, 2);
  assert.deepEqual(recipe.overlays, []);
});

test("MIX v2 sanea superposiciones sin romper recetas anteriores", () => {
  const recipe = coerceMixRecipe({
    version: 2,
    segments: [{ assetId: "base", sourceStart: 0, sourceEnd: 8 }],
    overlays: [
      { assetId: "", sourceStart: 0, sourceEnd: 3 },
      { assetId: "bad", sourceStart: 4, sourceEnd: 2 },
      { assetId: "ok", sourceStart: -2, sourceEnd: 3, timelineStart: -4, mode: "pip", position: "unknown", size: 9 },
    ],
  });
  assert.equal(recipe.overlays.length, 1);
  assert.equal(recipe.overlays[0].sourceStart, 0);
  assert.equal(recipe.overlays[0].timelineStart, 0);
  assert.equal(recipe.overlays[0].position, "top-right");
  assert.equal(recipe.overlays[0].size, 0.8);
});

test("MIX conserva todas las capas y permite desactivar el cierre de marca", () => {
  const overlays = Array.from({ length: 27 }, (_, index) => ({
    assetId: `layer-${index}`,
    sourceStart: 0,
    sourceEnd: 2,
    timelineStart: index,
  }));
  const recipe = coerceMixRecipe({
    version: 2,
    segments: [{ assetId: "base", sourceStart: 0, sourceEnd: 40 }],
    overlays,
    includeBrandOutro: false,
  });
  assert.equal(recipe.overlays.length, 27);
  assert.equal(recipe.includeBrandOutro, false);
});
