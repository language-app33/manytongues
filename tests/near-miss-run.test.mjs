// @ts-check
/*
 * A spelling near-miss does not break the run when writing a word from its
 * meaning (0.628, stage F1 of the plan).
 *
 * Right twice running is what proves a word written from its meaning. A
 * near miss there — one letter out, or the right letters with the wrong
 * harakat — used to count as a miss in that run, so right, near, right was
 * not two running. It now leaves the run as it was. Everything else about
 * a near miss stays: it is marked hard, counted as a near miss, and comes
 * round again.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const { gradeInto } = await import(path.join(here, "..", "src", "grade.ts"));
const { solid, freshState } = await import(path.join(here, "..", "src", "scheduler.ts"));

const clock = { now: () => Date.UTC(2026, 10, 15, 9), random: () => 0.5 };
const card = (/** @type {Record<string, any>} */ s) => ({
  id: "w", kind: "word", tags: [], created: 1, updated: 1,
  forms: [{ id: "w", ar: "كتاب", en: "book", lat: "kitaab", s }],
});
/** One answer to `type` on the card, marked as the screen marks it. */
function answer(/** @type {any} */ it, /** @type {string} */ type, /** @type {"right" | "near" | "harakat" | "wrong"} */ how) {
  const ok = how === "right";
  const checked = ok ? { ok: true, reason: "exact" } : { ok: false, reason: how };
  const rating = ok ? "good" : how === "wrong" ? "again" : "hard";
  const out = gradeInto([it], [{ id: "w", subId: null, rating, correct: ok, advance: true }], { type, how: { checked }, clock });
  return out ? out[0] : it;
}
const run = (/** @type {string} */ type, /** @type {("right" | "near" | "harakat" | "wrong")[]} */ answers) => {
  let it = card({ [type]: freshState() });
  for (const a of answers) it = answer(it, type, a);
  return it.forms[0].s[type];
};

test("right, near, right writing from the meaning is right twice running", () => {
  for (const type of ["en2ar", "img2ar", "ctx2ar"]) {
    assert.equal(solid(run(type, ["right", "near", "right"])), true, `${type} with a letter out`);
    assert.equal(solid(run(type, ["right", "harakat", "right"])), true, `${type} with the harakat wrong`);
  }
});

test("a real miss still breaks it, and two near misses do not make a run", () => {
  assert.equal(solid(run("en2ar", ["right", "wrong", "right"])), false);
  assert.equal(solid(run("en2ar", ["near", "near"])), false);
});

test("everything else about a near miss stays", () => {
  const s = run("en2ar", ["right", "near"]);
  assert.equal(s.near, 1, "it is counted as a near miss");
  assert.equal(s.reps, 2, "and as an answer");
});

test("on any other exercise a near miss counts in the run as before", () => {
  assert.equal(solid(run("ar2en", ["right", "near", "right"])), false);
  assert.equal(solid(run("tr2ar", ["right", "near", "right"])), false, "writing from a cue is not writing from the meaning");
});
