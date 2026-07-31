import assert from "node:assert/strict";
import test from "node:test";
import { composeTikTokCopy } from "./publish.js";
import type { ClipMoment } from "./contracts.js";

const MOMENT: ClipMoment = {
  id: "a",
  title: "La inteligencia artificial cambia el trabajo",
  start: 1,
  end: 31,
  duration: 30,
  viralScore: 80,
  controversyScore: 75,
  confidence: 90,
  hook: "La inteligencia artificial no te quitará el trabajo",
  evidence: "",
  whyViral: "",
  whyControversial: "",
  context: "",
  risk: "low",
  riskReason: "",
};

test("prepara copy editable de TikTok sin llamadas a modelos", () => {
  const copy = composeTikTokCopy(MOMENT, "controversial");
  assert.match(copy.caption, /¿Estás de acuerdo o no\?/);
  assert.ok(copy.hashtags.includes("#Polemica"));
  assert.ok(copy.hashtags.includes("#Inteligencia"));
  assert.equal(new Set(copy.hashtags).size, copy.hashtags.length);
});
