// @ts-check
/*
 * A deck's quality — see src/deck-quality.ts.
 *
 * Every number here was worked out by hand from the owner's rules before
 * the test was run: 55 points for words met in sentences (two for the word
 * itself, one for each other form, half the card each), 10 for sentences
 * well made, 5 for each of seven smaller checks, and the points of a check
 * with nothing to measure shared among the rest.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deckQuality, formsToMeet, qualityTone, unknownFinder, wantsSentences } from "../src/deck-quality.ts";
import { LANGUAGES } from "../src/languages.ts";

const ar = LANGUAGES["ar-PS"];
const vi = LANGUAGES["vi-Hue"];
const he = LANGUAGES["he-IL"];

/** @param {any} q @param {string} key */
const checkOf = (q, key) => q.checks.find((/** @type {any} */ c) => c.key === key);
/** @param {any} q @param {string} id */
const rowOf = (q, id) => q.words.find((/** @type {any} */ w) => w.id === id);
/** @param {number} a @param {number} b @param {string} [what] */
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what || ""} ${a} ≠ ${b}`);

/* ---- what is asked to be in sentences ---- */

test("each form a student is asked is counted once: the word itself wants two sentences, the rest one", () => {
  const card = {
    id: "book", lang: "ar-PS", category: "noun",
    forms: [
      { id: "book", ar: "كتاب", en: "book" },
      { id: "books", ar: "كتب", en: "books" },
      { id: "same", ar: "كتب", en: "books, spelt again" },
      { id: "off", ar: "كتيب", en: "booklet", ask: false },
      { id: "empty", ar: "", en: "nothing written" },
    ],
  };
  assert.deepEqual(formsToMeet(card), [{ ar: "كتاب", need: 2 }, { ar: "كتب", need: 1 }]);
});

test("names, and cards there only to fill blanks, are not asked to be in sentences", () => {
  assert.equal(wantsSentences({ id: "a", category: "noun", forms: [{ ar: "باب", en: "door" }] }, ar), true);
  assert.equal(wantsSentences({ id: "b", category: "person", forms: [{ ar: "سارة", en: "Sarah" }] }, ar), false);
  assert.equal(wantsSentences({ id: "c", category: "place", forms: [{ ar: "نابلس", en: "Nablus" }] }, ar), false);
  assert.equal(wantsSentences({ id: "d", fills: ["name"], drill: false, forms: [{ ar: "رامي", en: "Rami" }] }, ar), false);
  assert.equal(wantsSentences({ id: "e", forms: [{ ar: "سكّر الباب من فضلك", en: "close the door please" }] }, ar), false,
    "a phrase is a sentence, not a word");
});

/* ---- a deck worked out whole ---- */

test("a small deck, scored by hand", () => {
  const coffee = { id: "w1", lang: "vi-Hue", category: "noun",
    forms: [{ id: "w1", ar: "cà phê", en: "coffee", lat: "", clips: ["h1"], images: ["i1"] }] };
  const drink = { id: "s1", lang: "vi-Hue", uses: ["w1"],
    forms: [{ id: "s1", ar: "tôi uống cà phê", en: "I drink coffee", lat: "", clips: ["h2"] }] };
  const known = [coffee, drink,
    { id: "k1", lang: "vi-Hue", category: "pronoun", forms: [{ ar: "tôi", en: "I" }] },
    { id: "k2", lang: "vi-Hue", category: "verb", forms: [{ ar: "uống", en: "to drink" }] }];
  const q = deckQuality([coffee, drink], { lang: vi, pool: known, known });
  /* The word is in one sentence of the two it wants: half of 55. The one
     sentence is linked and knows all its words: 10. Recordings, pictures,
     no repeats, nothing long: 5 each. No conversation: 0. Pronunciation
     and review have nothing to measure in Vietnamese with no blanks, so
     the 90 points left are scaled to 100. (27.5 + 10 + 20) / 90. */
  assert.equal(checkOf(q, "words").share, 0.5);
  assert.equal(checkOf(q, "sentences").share, 1);
  assert.equal(checkOf(q, "pronunciation").applies, false, "Vietnamese is written in Latin letters");
  assert.equal(checkOf(q, "reviewed").applies, false, "nothing has a blank");
  assert.equal(checkOf(q, "scene").share, 0);
  assert.equal(q.score, Math.round((57.5 * 100) / 90));
  assert.equal(q.fixes[0].key, "words", "the change worth most comes first");
  assert.match(q.fixes[0].text, /1 word needs more sentences/);
  assert.ok(q.fixes.some((f) => f.key === "scene"));
});

test("a deck with nothing to learn from is not scored, and a deck of words alone scores low", () => {
  assert.equal(deckQuality([], { lang: ar, pool: [] }).score, null);
  const names = [{ id: "n", category: "person", forms: [{ ar: "سارة", en: "Sarah" }] }];
  assert.equal(deckQuality(names, { lang: ar, pool: names }).score, null);
  const door = { id: "d", lang: "ar-PS", category: "noun",
    forms: [{ ar: "باب", en: "door", lat: "baab", clips: ["c"], images: ["i"] }] };
  const q = deckQuality([door], { lang: ar, pool: [door] });
  assert.equal(checkOf(q, "words").applies, true);
  assert.equal(checkOf(q, "sentences").applies, true, "no sentences is not spared, it is nothing earned");
  /* Recordings, pictures, pronunciation, no repeats: 20 of 90 — review
     and length have nothing to measure. */
  assert.equal(q.score, Math.round((20 * 100) / 90));
  assert.ok(q.fixes.some((f) => f.key === "sentences"));
});

/* ---- what counts as a word being in a sentence ---- */

test("a confirmed link counts, for the form the sentence holds; an unconfirmed one does not", () => {
  const book = { id: "book", lang: "ar-PS", category: "noun",
    forms: [{ id: "book", ar: "كتاب", en: "book" }, { id: "books", ar: "كتب", en: "books" }] };
  const one = { id: "s1", lang: "ar-PS", uses: ["book"], forms: [{ ar: "عندي كتاب", en: "I have a book" }] };
  const two = { id: "s2", lang: "ar-PS", uses: ["book"], forms: [{ ar: "الكتب هون", en: "the books are here" }] };
  const three = { id: "s3", lang: "ar-PS", forms: [{ ar: "وين الكتاب", en: "where is the book" }] };
  const pool = [book, one, two, three];
  const q = deckQuality(pool, { lang: ar, pool, pending: true });
  assert.deepEqual(rowOf(q, "book").forms, [{ ar: "كتاب", need: 2, met: 1 }, { ar: "كتب", need: 1, met: 1 }],
    "the plural is met in the sentence that has the plural; the unconfirmed sentence counts for nothing");
  assert.equal(rowOf(q, "book").share, 0.75);
  const confirm = q.fixes.find((f) => f.key === "confirm");
  assert.ok(confirm, "the link nobody has confirmed is offered");
  assert.match(confirm.text, /1 link between a word and a sentence in this deck is waiting/);
  /* Confirming it takes the card from 0.75 to 1: a quarter of 55, scaled. */
  const total = q.checks.filter((c) => c.applies).reduce((t, c) => t + c.weight, 0);
  assert.ok(Math.abs(confirm.gain - (55 * 0.25 * 100) / total) < 1e-9);

  const elsewhere = deckQuality([book], { lang: ar, pool });
  assert.equal(rowOf(elsewhere, "book").share, 0, "a sentence in another deck does not count");
});

/* A verb behind a blank, agreeing with the pronoun beside it. */
const pronoun = (/** @type {string} */ person, /** @type {string} */ word, /** @type {string} */ en, /** @type {Record<string, string>} */ picks = {}, created = 1) => ({
  id: `p-${person}`, lang: "ar-PS", category: "pronoun", person, created,
  forms: [{ id: `p-${person}`, ar: word, en, lat: en, ...picks }],
});
const speak = {
  id: "speak", lang: "ar-PS", category: "verb", created: 6,
  forms: [
    { id: "speak", ar: "حكى", en: "to speak", lat: "haka" },
    { id: "v-pres-i", row: "present", col: "i", ar: "بحكي", en: "speak", lat: "bahki" },
    { id: "v-pres-he", row: "present", col: "he", ar: "بيحكي", en: "speaks", lat: "biyihki" },
    { id: "v-pres-she", row: "present", col: "she", ar: "بتحكي", en: "speaks", lat: "btihki" },
    { id: "v-pres-they", row: "present", col: "they", ar: "بيحكوا", en: "speak", lat: "biyihku" },
    { id: "v-past-i", row: "past", col: "i", ar: "حكيت", en: "spoke", lat: "hakeet" },
    { id: "v-past-he", row: "past", col: "he", ar: "حكى", en: "spoke", lat: "haka" },
    { id: "v-past-she", row: "past", col: "she", ar: "حكت", en: "spoke", lat: "hakat" },
  ],
};
const pronouns = [
  pronoun("i", "أنا", "I", {}, 1),
  pronoun("he", "هو", "he", { number: "singular", gender: "masculine" }, 2),
  pronoun("she", "هي", "she", { number: "singular", gender: "feminine" }, 3),
  pronoun("they", "هم", "they", { number: "plural" }, 4),
];
const speaking = (/** @type {any} */ tenses, /** @type {any} */ review) => ({
  id: "s", lang: "ar-PS", sentence: true, created: 9, ...(review ? { review } : {}),
  forms: [{ id: "s", ar: "{{pronoun}} {{verb}} عربي", en: "{{pronoun}} {{verb}} Arabic", lat: "{{pronoun}} {{verb}} arabi",
    ...(tenses ? { tenses: { verb: tenses } } : {}) }],
});

test("one sentence with a blank that takes every form covers all of them", () => {
  const frame = speaking(null, null);
  const pool = [...pronouns, speak, frame];
  const q = deckQuality([speak, frame], { lang: ar, pool });
  /* Every person of both tenses stands in it once; the he-past is the
     verb's own word, which wants two. Half of a half, plus every other
     form: 0.25 + 0.5. */
  const row = rowOf(q, "speak");
  assert.equal(row.forms.length, 7, "the he-past and the card's own word are one");
  assert.ok(row.forms.every((/** @type {any} */ f) => f.met === 1), JSON.stringify(row.forms));
  assert.equal(row.share, 0.75);
});

test("a blank that takes only some forms covers exactly those", () => {
  const frame = speaking(["present"], null);
  const pool = [...pronouns, speak, frame];
  const row = rowOf(deckQuality([speak, frame], { lang: ar, pool }), "speak");
  const met = Object.fromEntries(row.forms.map((/** @type {any} */ f) => [f.ar, f.met]));
  assert.deepEqual(met, { "حكى": 0, "بحكي": 1, "بيحكي": 1, "بتحكي": 1, "بيحكوا": 1, "حكيت": 0, "حكت": 0 });
  /* Four of the six other forms: 0.5 × 4/6. */
  assert.ok(Math.abs(row.share - 1 / 3) < 1e-9);
});

test("a blank counts only in the sentences review lets through", () => {
  const frame = speaking(["present"], { ok: [] });
  const pool = [...pronouns, speak, frame];
  const q = deckQuality([speak, frame], { lang: ar, pool });
  assert.equal(rowOf(q, "speak").share, 0, "reviewed, and nothing approved: nothing is asked");
  assert.equal(checkOf(q, "reviewed").share, 0, "and the card is waiting for review");
});

test("a verb's own examples are sentences for the forms they show", () => {
  const want = {
    id: "eat", lang: "ar-PS", category: "verb",
    forms: [
      { id: "eat", ar: "أكل", en: "to eat" },
      { id: "sub-i", row: "subjunctive", col: "i", ar: "آكل", en: "eat" },
      { id: "sub-she", row: "subjunctive", col: "she", ar: "تاكل", en: "eat" },
    ],
    examples: [{ ar: "لازم {{verb}}", en: "{{verb-who}} must {{verb-plain}}" }],
  };
  const row = rowOf(deckQuality([want], { lang: ar, pool: [want] }), "eat");
  const met = Object.fromEntries(row.forms.map((/** @type {any} */ f) => [f.ar, f.met]));
  assert.deepEqual(met, { "أكل": 0, "آكل": 1, "تاكل": 1 });
});

/* ---- sentences well made ---- */

test("a sentence loses its points for a word no deck of the course teaches, or for teaching no word", () => {
  const door = { id: "door", lang: "ar-PS", category: "noun", forms: [{ ar: "باب", en: "door" }] };
  const shut = { id: "shut", lang: "ar-PS", category: "verb", forms: [{ ar: "سكّر", en: "close" }] };
  const good = { id: "g", lang: "ar-PS", uses: ["door"], forms: [{ ar: "سكّر الباب", en: "close the door" }] };
  const odd = { id: "o", lang: "ar-PS", uses: ["door"], forms: [{ ar: "افتح الباب", en: "open the door" }] };
  const bare = { id: "b", lang: "ar-PS", forms: [{ ar: "سكّر الباب", en: "close the door" }] };
  const known = [door, shut];
  const q = deckQuality([door, good, odd, bare], { lang: ar, pool: known, known });
  near(checkOf(q, "sentences").share, 1 / 3, "only the first is linked and knows all its words");
  const unknown = q.fixes.find((f) => f.key === "unknown");
  assert.ok(unknown);
  assert.match(unknown.text, /1 sentence uses a word no deck in the course teaches \(افتح\)/);
  assert.ok(q.fixes.some((f) => f.key === "unlinked"));
});

test("small words that hold a sentence together are never unknown", () => {
  const find = unknownFinder([{ id: "b", category: "noun", forms: [{ ar: "بيت", en: "house" }] }], ar);
  assert.deepEqual(find("في البيت"), [], "في is a preposition, البيت is the house");
  assert.deepEqual(find("{{name}} في البيت"), [], "and a blank is filled with something");
  assert.deepEqual(find("في البيت الكبير"), ["الكبير"]);
});

/* ---- the smaller checks ---- */

test("the smaller checks each count their own share", () => {
  const word = (/** @type {string} */ id, /** @type {string} */ w, /** @type {string} */ en, extra = {}) =>
    ({ id, lang: "ar-PS", category: "noun", forms: [{ ar: w, en, ...extra }] });
  const a = word("a", "باب", "door", { lat: "baab", clips: ["c"] });
  const b = word("b", "باب", "door");
  const c = word("c", "بيت", "house", { images: ["i"] });
  const long = { id: "l", lang: "ar-PS", uses: ["a"], forms: [{ ar: Array(14).fill("باب").join(" "), en: "doors" }] };
  const scene = { id: "sc", lang: "ar-PS", speakers: ["A", "B"], lines: [{ ar: "باب", en: "door", who: 0 }, { ar: "بيت", en: "house", who: 1 }] };
  const deck = [a, b, c, long, scene];
  const q = deckQuality(deck, { lang: ar, pool: deck });
  near(checkOf(q, "repeats").share, 1 - 1 / 3, "two cards for door: one of three is a repeat");
  near(checkOf(q, "pictures").share, 1 / 3);
  /* Units: three word forms, the long sentence, two lines. One recorded,
     one with its pronunciation. */
  near(checkOf(q, "recordings").share, 1 - 5 / 6);
  near(checkOf(q, "pronunciation").share, 1 - 5 / 6);
  near(checkOf(q, "long").share, 2 / 3, "the fourteen-word sentence is long; the lines are not");
  assert.equal(checkOf(q, "scene").share, 1);
});

test("the colours change at 80 and 50", () => {
  assert.equal(qualityTone(80), "good");
  assert.equal(qualityTone(79), "fair");
  assert.equal(qualityTone(50), "fair");
  assert.equal(qualityTone(49), "poor");
});

/* ---- the lookup the list of decks relies on ---- */

test("looking a word up by its key answers what the matcher answers", () => {
  /** @type {[any, string[], string[]][]} */
  const cases = [
    [ar, ["الكتاب", "وبالكتاب", "كتابها", "كتب", "باب", "البيت", "مكتبة"], ["كتاب", "كتب", "باب", "بيت", "مكتب"]],
    [vi, ["cà phê", "ma", "má", "Má"], ["cà phê", "ma", "má"]],
    [he, ["הספר", "וספר", "ספרים", "בית"], ["ספר", "בית", "ספרים"]],
  ];
  for (const [lang, tokens, words] of cases) {
    const keyed = lang.context.keyed;
    for (const t of tokens) {
      for (const w of words) {
        assert.equal(keyed.token(t).includes(keyed.word(w)), lang.context.matches(t, w), `${lang.id}: ${t} / ${w}`);
      }
    }
  }
});
