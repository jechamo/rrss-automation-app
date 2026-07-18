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
import { DEFAULT_CONFIG } from "../content/types.js";
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
    subtitleText: "Texto",
  });
  assert.equal(timeline.version, 2);
  assert.equal(mixVideoCount(timeline), 2);
  assert.equal(mixVisualDuration(timeline), 7.5);
  assert.equal(timeline.segments[0].locked, true);
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
});
