import test from "node:test";
import assert from "node:assert/strict";
import { navigationTargetScore, selectorTextHint } from "./navigation-repair-rules.js";

test("extrae la intención textual de un selector Playwright", () => {
  assert.equal(selectorTextHint('button:has-text("PlayStation")'), "PlayStation");
  assert.equal(selectorTextHint("text='Gaming'"), "Gaming");
});

test("relaciona PlayStation con la tarjeta dinámica PlayStation 5", () => {
  assert.equal(navigationTargetScore(["Movies"], "PlayStation"), 0);
  assert.ok(navigationTargetScore(["PlayStation 5 · 1.248 votos"], "PlayStation") >= 70);
});
