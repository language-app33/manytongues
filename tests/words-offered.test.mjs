/*
 * "Words this teaches": which word cards a phrase or sentence is offered
 * as teaching. Every form of a card is looked for — a verb's conjugations,
 * a noun's plural — not only the word on the front, and the form found is
 * the one the practice side blanks.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { must } from "./helpers.mjs";

import { buildContextIndex, wordsOffered } from "../src/context-index.ts";
import { sentenceWords } from "../src/sentence-words.ts";
import { LANGUAGES } from "../src/languages.ts";

const ar = LANGUAGES["ar-PS"];

/** @param {string} id @param {string} word @param {string} en @param {any[]} [cells] @returns {any} */
const card = (id, word, en, cells = []) => ({
  id, lang: "ar-PS", tags: [], created: 1,
  forms: [{ id, ar: word, en, lat: "", s: {} }, ...cells.map((c, i) => ({ id: `${id}-${i}`, lat: "", s: {}, ...c }))],
});

const wrote = card("V", "كتب", "he wrote", [
  { ar: "كتبت", en: "she wrote", row: "past", col: "she" },
  { ar: "بيكتبوا", en: "they write", row: "present", col: "they" },
]);
const book = card("N", "كتاب", "book", [{ ar: "كتب", en: "books" }]);
const house = card("H", "بيت", "house");

test("a verb is offered for any of its conjugations, and says which", () => {
  const found = wordsOffered("هي كتبت رسالة", [wrote, house], ar);
  assert.deepEqual(found.map((m) => m.card.id), ["V"]);
  assert.equal(must(found[0], "the verb").form.ar, "كتبت");
  const present = wordsOffered("الولاد بيكتبوا هلأ", [wrote], ar);
  assert.equal(must(present[0], "the verb").form.ar, "بيكتبوا");
});

test("the word on the front is still found first, as before", () => {
  const found = wordsOffered("هو كتب رسالة في البيت", [wrote, house], ar);
  assert.deepEqual(found.map((m) => [m.card.id, m.form.ar]), [["V", "كتب"], ["H", "بيت"]]);
});

test("a noun is offered for its plural", () => {
  const found = wordsOffered("عندي كتب كثير", [book], ar);
  assert.equal(must(found[0], "the noun").form.en, "books");
});

test("the form offered is the form the practice side blanks", () => {
  const phrase = { ...card("P", "هي كتبت رسالة", "she wrote a letter"), uses: ["V"] };
  const offered = must(wordsOffered(phrase.forms[0].ar, [wrote], ar)[0], "offered");
  const index = buildContextIndex([phrase, wrote], ar);
  assert.equal(must(index.get(offered.form.id), "indexed under the form offered").length, 1);
});

test("nothing is offered for a single word, for itself, or for a word not there", () => {
  assert.deepEqual(wordsOffered("كتبت", [wrote], ar), [], "a word does not contain words");
  assert.deepEqual(wordsOffered("هي كتبت رسالة", [{ ...wrote, id: "S" }], ar, "S"), [], "not itself");
  assert.deepEqual(wordsOffered("رحت على السوق", [wrote, house], ar), []);
});

/* A verb saved with its past "he" left blank — the card's own word — and
   only its present and subjunctive written, as "to keep" was. */
const keep = {
  id: "K", lang: "ar-PS", tags: [], created: 1, category: "verb", name: "to keep",
  forms: [
    { id: "K", ar: "", en: "", lat: "", s: {} },
    { id: "K-0", ar: "بَخَلّي", en: "I keep", row: "present", col: "i", lat: "", s: {} },
    { id: "K-1", ar: "بِتخَلّي", en: "you keep", row: "present", col: "you-m", lat: "", s: {} },
    { id: "K-2", ar: "تخلي", en: "to keep", row: "subjunctive", col: "you-m", lat: "", s: {} },
  ],
};

test("a verb with its own word blank is offered for the forms it has", () => {
  const found = wordsOffered("لو ممكن تخلي بس 3 تطبيقات", [keep, house], ar);
  assert.deepEqual(found.map((m) => [m.card.id, m.form.ar]), [["K", "تخلي"]]);
});

test("a verb with its own word blank gives a sentence's word a card", () => {
  const { bare } = sentenceWords("شو بتخلي", [keep], ar);
  assert.deepEqual(bare, ["شو"]);
});
