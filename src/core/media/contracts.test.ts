import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFalRequestBody,
  buildHeygenVideoBody,
  classifyPollStatus,
  FAL_MODEL_IDS,
  isRetriableStatus,
  providerHttpError,
  queueFailureMessage,
  retryDelayMs,
} from "./contracts.js";

test("fal.ai construye bodies verticales segun cada esquema", () => {
  assert.deepEqual(buildFalRequestBody(FAL_MODEL_IDS.kling, "demo", 9), {
    prompt: "demo",
    aspect_ratio: "9:16",
    duration: "10",
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
  assert.equal(buildFalRequestBody(FAL_MODEL_IDS.seedance, "demo", 99).duration, "10");
  assert.throws(() => buildFalRequestBody("fal-ai/modelo-antiguo", "demo"), /no tiene un contrato/);
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
