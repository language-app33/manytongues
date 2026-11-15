// @ts-check
/*
 * Personal sets: the pure rules in src/sets.ts, one sentence a test.
 *
 * A personal set is a deck with a `set` field; a student's answer for one
 * of its pictures is a record in that picture's progress. These are the
 * readers that narrow both, and the one function that writes an answer.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const S = await import(path.join(here, "..", "src", "sets.ts"));

test("readSet takes nothing that is not an object, and never throws", () => {
  for (const raw of [null, undefined, "set", 3, true, [], [1, 2]]) {
    assert.equal(S.readSet(raw, "dA"), null);
  }
});

test("readSet fills empty wording with the default and trims the rest", () => {
  const s = S.readSet({ wording: { question: "  Who? ", none: "", askName: 5 } }, "dA");
  assert.equal(s.wording.question, "Who?");
  assert.equal(s.wording.none, S.DEFAULT_WORDING.none);
  assert.equal(s.wording.askName, S.DEFAULT_WORDING.askName);
  assert.equal(s.wording.askWord, S.DEFAULT_WORDING.askWord);
});

test("readSet cuts over-long wording at its limit", () => {
  const s = S.readSet({ wording: { question: "x".repeat(500) } }, "dA");
  assert.equal(s.wording.question.length, S.SET_LIMITS.wording);
});

test("readSet keeps lists that look like deck ids, once each, never its own deck, at most twelve", () => {
  const many = Array.from({ length: 20 }, (_, i) => `d${i}`);
  const s = S.readSet({ lists: ["dA", "dB", "dB", "<b>", 7, ...many] }, "dA");
  assert.equal(s.lists[0], "dB");
  assert.ok(!s.lists.includes("dA"));
  assert.ok(!s.lists.includes("<b>"));
  assert.equal(s.lists.length, S.SET_LIMITS.lists);
  assert.equal(new Set(s.lists).size, s.lists.length);
});

test("readSet keeps at most five hundred ticked words", () => {
  const s = S.readSet({ named: Array.from({ length: 600 }, (_, i) => `k${i}`) }, "dA");
  assert.equal(s.named.length, S.SET_LIMITS.named);
});

test("readSet drops unknown fields, and reads the kinds and the order", () => {
  const s = S.readSet({ extra: 1, asks: { name: false, word: "no" }, order: "after" }, "dA");
  assert.equal("extra" in s, false);
  assert.deepEqual(s.asks, { name: false, word: true, both: true });
  assert.equal(s.order, "after");
  assert.equal(S.readSet({ order: "sideways" }, "dA").order, "before");
});

test("an empty set has the default wording, no lists, every kind on, the word before the name", () => {
  const e = S.emptySet();
  assert.deepEqual(e.wording, S.DEFAULT_WORDING);
  assert.deepEqual(e.lists, []);
  assert.deepEqual(e.named, []);
  assert.deepEqual(e.asks, { name: true, word: true, both: true });
  assert.equal(e.order, "before");
  assert.deepEqual(S.readSet(e, "dA"), e);
});

test("readAnswer takes only a record with a time on it, and drops what it does not know", () => {
  for (const raw of [null, "x", 3, [], {}, { updated: "soon" }, { updated: -1 }]) {
    assert.equal(S.readAnswer(raw), null);
  }
  assert.deepEqual(S.readAnswer({ updated: 5, meaning: " aunt ", none: "yes", skip: true, list: "dB", phase: "new" }), {
    updated: 5,
    meaning: "aunt",
    skip: true,
    list: "dB",
  });
  assert.equal(S.readAnswer({ updated: 5, meaning: "x".repeat(500) }).meaning.length, 200);
});

/** @returns {any} */
const item = () => ({
  id: "i1",
  updated: 1,
  forms: [
    { id: "i1", s: { img2pick: { phase: "review", updated: 1 }, [S.SET_KEY]: { updated: 1, list: "dB", skip: true } } },
    { id: "i1-f1", s: {} },
  ],
});

test("withAnswer keeps the record's other fields, and stamps the record and the item", () => {
  const next = S.withAnswer(item(), { meaning: "aunt", skip: undefined }, 99);
  assert.deepEqual(next.forms[0].s[S.SET_KEY], { updated: 99, list: "dB", meaning: "aunt" });
  assert.equal(next.updated, 99);
});

test("withAnswer leaves every other key of the progress, and every other form, untouched", () => {
  const was = item();
  const next = S.withAnswer(was, { none: true }, 99);
  assert.deepEqual(next.forms[0].s.img2pick, was.forms[0].s.img2pick);
  assert.equal(next.forms[1], was.forms[1]);
  assert.deepEqual(was.forms[0].s[S.SET_KEY], { updated: 1, list: "dB", skip: true }, "and the item it was given");
});

test("withAnswer writes a first answer onto a form with no progress", () => {
  const next = S.withAnswer({ forms: [{ id: "x" }] }, { list: "dC" }, 7);
  assert.deepEqual(next.forms[0].s, { [S.SET_KEY]: { updated: 7, list: "dC" } });
});
