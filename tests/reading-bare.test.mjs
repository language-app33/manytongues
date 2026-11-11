/*
 * Reading without the vowel marks (0.608).
 *
 * The owner's goal is students who read everyday Arabic, which is written
 * without its harakat. So a word keeps them while what it means is being
 * learnt and loses them once the first level of its ladder is passed; a
 * sentence never has them. What is checked here is the part that is not a
 * screen: which marks come off, that nothing else does, how a text is cut
 * into words a learner can tap, and the point on the ladder where a word
 * goes bare. The screen itself is walked in tests/smoke.mjs.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { LANGUAGES, hasMarks, piecesOf, withoutMarks } from "../src/languages.ts";
import { BARE_FROM_LEVEL, freshState, readsBare } from "../src/scheduler.ts";

const ar = LANGUAGES["ar-PS"];
const he = LANGUAGES["he-IL"];
const vi = LANGUAGES["vi"];

test("Arabic and Hebrew declare the marks a reader learns to do without; Vietnamese does not", () => {
  assert.equal(ar.marks && ar.marks.name, "harakat");
  assert.equal(he.marks && he.marks.name, "niqqud");
  assert.equal(vi.marks, undefined, "a tone is part of every Vietnamese word as written");
});

test("the harakat come off and the letters stay", () => {
  assert.equal(withoutMarks("كِتاب", ar), "كتاب");
  assert.equal(withoutMarks("مُعَلِّمَة", ar), "معلمة", "shadda and sukun are harakat too");
  assert.equal(withoutMarks("قَرَأْتُ", ar), "قرأت", "a hamza is a letter, not a mark");
  assert.equal(withoutMarks("كِتابٌ جَدِيدٌ", ar), "كتاب جديد", "tanween, and the space between words");
  assert.equal(withoutMarks("مِسْتَشْفى، يا خالِد؟", ar), "مستشفى، يا خالد؟", "punctuation stays");
});

test("the niqqud come off Hebrew, the maqaf stays", () => {
  assert.equal(withoutMarks("שָׁלוֹם", he), "שלום");
  assert.equal(withoutMarks("בֵּית־סֵפֶר", he), "בית־ספר");
});

test("a language with no marks to take off is shown as written", () => {
  assert.equal(withoutMarks("cảm ơn", vi), "cảm ơn");
  assert.equal(withoutMarks("كِتاب", null), "كِتاب", "nor is anything taken off with no language");
  assert.equal(hasMarks("cảm ơn", vi), false);
});

test("whether a text has any marks at all", () => {
  assert.equal(hasMarks("كِتاب", ar), true);
  assert.equal(hasMarks("كتاب", ar), false);
  assert.equal(hasMarks("", ar), false);
});

test("a text is cut into its words, each tappable for its marks, and joins back exactly", () => {
  const text = "أنا  بَحِبّ القَهْوَة كتير";
  const pieces = piecesOf(text, ar);
  assert.equal(pieces.map((p) => p.text).join(""), text, "nothing lost, the double space included");
  const words = pieces.filter((p) => /\S/.test(p.text));
  assert.deepEqual(words.map((p) => p.bare), ["أنا", "بحب", "القهوة", "كتير"]);
  assert.deepEqual(
    words.map((p) => p.key),
    ["", "بحب", "القهوة", ""],
    "a word with no marks has nothing to give back, so nothing to tap",
  );
  assert.ok(pieces.filter((p) => !/\S/.test(p.text)).every((p) => p.key === ""), "nor has a space");
});

/* ---- where on the ladder a word goes bare ---- */

const ladder = ["ar2pick", "ar2en", "match", "en2pick", "tr2ar", "en2ar"];
const state = (/** @type {Record<string, unknown>} */ over = {}) => ({ ...freshState(), ...over });
const table = (/** @type {Record<string, any>} */ s) => (/** @type {string} */ t) => s[t];
const rightTwice = state({ phase: "learning", step: 1, hist: [1, 1] });

test("bare from the second level, which is the owner's rule", () => {
  assert.equal(BARE_FROM_LEVEL, 2);
});

test("a word nobody has met keeps its harakat", () => {
  assert.equal(readsBare(ladder, table({})), false);
});

test("and keeps them while its meaning is being learnt", () => {
  assert.equal(readsBare(ladder, table({ ar2pick: state({ phase: "learning", hist: [1] }) })), false,
    "right once is not the level passed");
  assert.equal(readsBare(ladder, table({ ar2pick: rightTwice })), false,
    "every first-level question has to be passed, not one of them");
});

test("it goes bare once every first-level question is right twice running", () => {
  assert.equal(readsBare(ladder, table({ ar2pick: rightTwice, ar2en: rightTwice })), true);
});

test("and stays bare on the levels above, and when a first-level question comes back", () => {
  const known = { ar2pick: rightTwice, ar2en: state({ phase: "review", hist: [1, 1, 0] }) };
  assert.equal(readsBare(ladder, table(known)), true, "one miss is forgiven, as on the ladder");
});

test("two misses running on the first level put the harakat back until it is recovered", () => {
  const slipped = { ar2pick: rightTwice, ar2en: state({ phase: "learning", hist: [1, 1, 0, 0] }) };
  assert.equal(readsBare(ladder, table(slipped)), false);
});

test("a form with nothing it can be asked is never shown bare", () => {
  assert.equal(readsBare([], table({})), false);
});
