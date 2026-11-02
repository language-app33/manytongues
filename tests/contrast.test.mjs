/* A space's colour is used as an accent only where it can be seen (0.543). */
import { test } from "node:test";
import assert from "node:assert/strict";
const { contrastRatio, usableAccent } = await import("../src/contrast.ts");

test("contrast is the WCAG ratio", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
  assert.equal(contrastRatio("#777777", "#777777"), 1);
  assert.ok(Number.isNaN(contrastRatio("blue", "#ffffff")));
});

test("a mid-tone passes; a faint or a very dark colour doesn't", () => {
  assert.equal(usableAccent("#d9480f"), true, "a strong orange stands out on both pages");
  assert.equal(usableAccent("#fff3bf"), false, "a pale yellow vanishes on the light page");
  assert.equal(usableAccent("#10152a"), false, "a near-black vanishes on the dark page");
  assert.equal(usableAccent(""), false);
});
