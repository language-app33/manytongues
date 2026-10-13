/*
 * A text is learnt a sentence at a time.
 *
 * Since 0.434 each sentence of a text is asked its own questions — what it
 * means, which word is missing — and keeps its own progress, so a sentence
 * missed is the one that comes back. Each is shown with its meaning before
 * its first question, the whole text is read through once every sentence
 * is cleared, and progress a text had made before is handed down to its
 * sentences so that nobody goes backwards.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".text-sentences-build");

await build({
  entryPoints: [path.join(here, "..", "src", "ArabicTrainer.tsx")],
  outfile: path.join(out, "trainer.js"),
  bundle: true,
  format: "esm",
  jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  loader: { ".jsx": "jsx" },
  logLevel: "silent",
  define: {
    "process.env.NODE_ENV": '"development"',
    __APP_RELEASE__: '"0"',
    __APP_VERSION__: '"test"',
    __BUILT_AT__: '"0"',
  },
});
const { buildSession, installIndexes, quietUnits, carryToSentences, laddered, resolveQuestion, withoutQuestionAt } = await import(path.join(out, "trainer.js"));
const { TYPES, LANGUAGES } = await import(path.join(here, "..", "src", "languages.ts"));
const { sentenceWords, wordCount, longSentenceOf, LONG_SENTENCE } = await import(path.join(here, "..", "src", "sentence-words.ts"));

const settings = { language: "ar-PS" };
const anyDeck = () => true;

/** A state answered right twice running: cleared, at whatever it asks. */
const solidState = () => ({
  phase: "review", step: 0, ease: 2.5, interval: 1, due: Date.now() + 86400000,
  reps: 2, lapses: 0, right: 2, wrong: 0, skips: 0, near: 0, hints: 0, hist: [1, 1], updated: 1,
});

/**
 * A text of three sentences, each with its meaning.
 * @param {Record<string, any>} [over] @param {(i: number) => Record<string, any>} [linesS]
 * @returns {any}
 */
const text = (over = {}, linesS = () => ({})) => ({
  id: "T", lang: "ar-PS", kind: "dialog", sceneKind: "text", tags: [], created: 1,
  forms: [{ id: "T", ar: "", en: "At home", lat: "", lang: "ar-PS", s: {} }],
  lines: [
    ["أنا ساكن بالبيت", "I live in the house"],
    ["البيت كبير كثير", "The house is very big"],
    ["أختي ساكنة معي", "My sister lives with me"],
  ].map(([ar, en], i) => ({ id: `t${i}`, who: 0, ar, en, lat: "", recs: [], uses: [], s: linesS(i) })),
  ...over,
});

test("a new text is asked about its sentences, each met before its first question", () => {
  const items = [text()];
  installIndexes(items, settings);
  const got = buildSession({ items, settings, inDeck: anyDeck });
  const asked = got.exercises.filter((/** @type {any} */ e) => e.id === "T");
  assert.ok(asked.length > 0, "the text is dealt");
  assert.ok(asked.every((/** @type {any} */ e) => e.subId && e.subId !== "T"), "every question is about a sentence");
  assert.ok(!asked.some((/** @type {any} */ e) => e.type === "dlgwhole"), "the whole text waits for its sentences");
  /* Each sentence is introduced once, just before its first question. */
  const seen = new Set();
  asked.forEach((/** @type {any} */ e, /** @type {number} */ i) => {
    if (e.type === "dlgread") return;
    if (seen.has(e.subId)) return;
    seen.add(e.subId);
    const before = asked[i - 1];
    assert.ok(before && before.type === "dlgread" && before.subId === e.subId, `${e.subId} is met before it is asked`);
  });
  assert.equal(asked.filter((/** @type {any} */ e) => e.type === "dlgread" && !e.subId).length, 0, "no whole-text introduction");
});

test("the whole text is read through once every sentence is cleared", () => {
  const fresh = [text()];
  installIndexes(fresh, settings);
  assert.ok(quietUnits(fresh, settings).has("T"), "held while the sentences are new");

  /* Every sentence cleared at everything it is asked. */
  const cleared = (/** @type {number} */ _i) => Object.fromEntries(["sen2en", "en2sen", "gap2pick", "gap2ar"].map((t) => [t, solidState()]));
  const done = [text({}, cleared)];
  installIndexes(done, settings);
  assert.ok(!quietUnits(done, settings).has("T"), "open once they are all cleared");
  assert.deepEqual(laddered(done[0].forms[0], settings), ["dlgwhole"]);

  /* One sentence still short of it holds the whole text back. */
  const one = [text({}, (i) => (i === 2 ? {} : cleared(i)))];
  installIndexes(one, settings);
  assert.ok(quietUnits(one, settings).has("T"), "held for the last sentence");
});

test("a text's progress is handed down to its sentences, once", () => {
  const before = text({
    forms: [{ id: "T", ar: "", en: "At home", lat: "", lang: "ar-PS", s: { gap2pick: solidState(), sen2en: solidState() } }],
  });
  const lifted = carryToSentences(before);
  for (const line of lifted.lines) {
    assert.deepEqual(line.s.gap2pick.hist, [1, 1], `${line.id} keeps the text's standing`);
    assert.deepEqual(line.s.sen2en.hist, [1, 1]);
    assert.equal(line.s.gap2ar, undefined, "and nothing the text had not reached");
  }
  assert.equal(lifted.forms[0].s.gap2pick.carried, true, "the text's own record says it was handed down");

  /* A sentence of its own record keeps it. */
  const own = { ...solidState(), hist: [0, 0], right: 0, wrong: 2 };
  const mixed = carryToSentences(text({ forms: before.forms }, (i) => (i === 0 ? { gap2pick: own } : {})));
  assert.deepEqual(mixed.lines[0].s.gap2pick.hist, [0, 0], "a sentence already asked is left as it is");

  /* A sentence written in later starts from the beginning. */
  const later = { ...lifted, lines: lifted.lines.concat([{ id: "t3", who: 0, ar: "ما في حدا", en: "Nobody is there", lat: "", recs: [], uses: [], s: {} }]) };
  const again = carryToSentences(later);
  assert.equal(again.lines[3].s.gap2pick, undefined, "nothing inherited by a new sentence");
  assert.equal(carryToSentences(talkOf(before)), talkOf(before), "a conversation is left alone");
});

/* ---- a sentence waits on its words (0.435) ---- */

/** A word card, its every question cleared when `known`. @param {string} id @param {string} ar @param {string} en @param {boolean} known */
const word = (id, ar, en, known) => ({
  id, lang: "ar-PS", kind: "word", tags: [], created: 2,
  forms: [{ id, ar, en, lat: en, lang: "ar-PS", s: known ? Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, solidState()])) : {} }],
});

test("which of a sentence's words have a card, and which have none", () => {
  const ar = LANGUAGES["ar-PS"];
  const cards = [word("w1", "ساكن", "living", false), word("w2", "بيت", "house", false)];
  const got = sentenceWords("أنا ساكن بالبيت، والبيت كبير.", cards, ar);
  assert.deepEqual(got.hits.map((/** @type {any} */ h) => h.card.id), ["w1", "w2"], "a prefix peeled is still the word");
  assert.deepEqual(got.bare, ["أنا", "كبير"], "and every other word, said once each time it is said, without its punctuation");
  assert.deepEqual(sentenceWords("{{name}} ساكن هون", cards, ar).bare, ["هون"], "a blank is not a word without a card");
});

test("a sentence is not met until most of its words are known", () => {
  /* Two sentences: one whose three carded words are all unknown, and one
     with no card behind any of its words. */
  const lines = [["أنا ساكن بالبيت", "I live in the house"], ["مش عارف شو بدي", "I don't know what I want"]];
  /** @param {boolean[]} known @param {Record<string, any>} [over] */
  const deck = (known, over = {}) => [
    text({
      lines: lines.map(([ar, en], i) => ({ id: `t${i}`, who: 0, ar, en, lat: "", recs: [], uses: [], s: {} })),
      ...over,
    }),
    word("w1", "أنا", "I", known[0]),
    word("w2", "ساكن", "living", known[1]),
    word("w3", "بيت", "house", known[2]),
  ];
  const quiet = (/** @type {any[]} */ items) => {
    installIndexes(items, settings);
    return quietUnits(items, settings);
  };
  assert.ok(quiet(deck([false, false, false])).has("t0"), "none of its words known: it waits");
  assert.ok(!quiet(deck([false, false, false])).has("t1"), "a sentence of words nobody teaches does not wait for ever");
  assert.ok(quiet(deck([true, true, false])).has("t0"), "two of three is not enough: three or fewer wants every one");
  assert.ok(!quiet(deck([true, true, true])).has("t0"), "every word known: it is met");

  /* A sentence asked in its own right keeps going. */
  const asked = deck([false, false, false]);
  asked[0].lines[0].s = { sen2en: { ...solidState(), hist: [0], right: 0, wrong: 1, phase: "learning" } };
  assert.ok(!quiet(asked).has("t0"), "a sentence already asked is not held back");

  /* A text begun before sentences were asked on their own is held like
     any other (0.437): its read-through, and the progress it handed down,
     are the text's and not the sentence's. */
  const begun = deck([false, false, false], {
    forms: [{ id: "T", ar: "", en: "At home", lat: "", lang: "ar-PS", s: { dlgwhole: solidState(), sen2en: solidState() } }],
  });
  const handed = carryToSentences(begun[0]);
  assert.equal(handed.lines[0].s.sen2en.phase, "review", "the sentence carries the text's progress");
  const carried = [handed, ...begun.slice(1)];
  const held = quiet(carried);
  assert.ok(held.has("t0"), "a sentence whose words are unknown waits, whatever the text had made");
  assert.ok(held.has("T"), "and the whole text waits with it");
  assert.ok(!held.has("t1"), "a sentence of words with no card still does not");

  /* Answered since, the sentence's record is its own and it keeps going. */
  const since = { ...handed, lines: handed.lines.map((/** @type {any} */ l, /** @type {number} */ i) =>
    (i === 0 ? { ...l, s: { ...l.s, sen2en: { ...l.s.sen2en, reps: 3, updated: 2 } } } : l)) };
  assert.ok(!quiet([since, ...begun.slice(1)]).has("t0"), "practised on its own, it is not held back");
});

test("eight words in ten known is enough", () => {
  const ar = ["كتاب", "قلم", "باب", "شباك", "طاولة"];
  const items = [
    text({ lines: [{ id: "t0", who: 0, ar: ar.join(" "), en: "things", lat: "", recs: [], uses: [], s: {} }] }),
    ...ar.map((w, i) => word(`w${i}`, w, `thing ${i}`, i > 0)),
  ];
  installIndexes(items, settings);
  assert.ok(!quietUnits(items, settings).has("t0"), "four of five known: met");
  const fewer = items.map((/** @type {any} */ c, /** @type {number} */ i) => (i === 2 ? word("w1", "قلم", "thing 1", false) : c));
  installIndexes(fewer, settings);
  assert.ok(quietUnits(fewer, settings).has("t0"), "three of five: it waits");
});

/* ---- a sentence that reads as two answers (0.438) ---- */

test("every question about a sentence is asked of the whole sentence", () => {
  /* Reported: a sentence with a slash in it was split into two accepted
     answers, the second was asked as a question of its own that nothing
     recognised as being about a sentence, and it went up with no answers
     to choose — "I don't know" the only way past it. */
  const items = [text({ lines: [{
    id: "t0", who: 0, ar: "لو بينفع/ ممكن تخلي بس 3 تطبيقات", en: "If it were possible / you could only keep 3 apps",
    lat: "", recs: [], uses: [], s: {},
  }] })];
  installIndexes(items, settings);
  const got = buildSession({ items, settings, inDeck: anyDeck });
  const about = got.exercises.filter((/** @type {any} */ e) => /^(sen2en|en2sen)/.test(e.type));
  assert.ok(about.length > 0, "the sentence is asked about");
  for (const e of about) {
    assert.ok(!e.type.includes("@"), `${e.type} is one question, not one per answer`);
    const r = resolveQuestion(items, e, false, []);
    assert.equal(r.unit.sentenceAt, 0, "it knows which sentence it is about");
    assert.equal(r.unit.en, "If it were possible / you could only keep 3 apps", "and asks it whole");
  }
  /* Progress kept under a per-answer key before this is still read as a
     sentence question. */
  const r = resolveQuestion(items, { ...about[0], type: `${about[0].type.split("@")[0]}@1` }, false, []);
  assert.equal(r.unit.sentenceAt, 0);
});

test("a question with nothing to choose between gives way to a backup", () => {
  const items = [text()];
  installIndexes(items, settings);
  const got = buildSession({ items, settings, inDeck: anyDeck });
  const queue = got.exercises;
  const at = queue.findIndex((/** @type {any} */ e) => e.type === "sen2en");
  assert.ok(at >= 0);
  const backup = { ...queue[at], subId: "t2", type: "sen2en" };
  const next = withoutQuestionAt(queue, at, items, settings, [backup]);
  assert.equal(next.length, queue.length, "the session keeps its length");
  assert.equal(next[at], backup, "a backup stands in");
  assert.deepEqual(next.slice(0, at), queue.slice(0, at), "nothing already answered moves");
  const none = withoutQuestionAt(queue, at, items, settings, []);
  assert.equal(none.length, queue.length - 1, "with no backup, the session is one shorter");
  assert.equal(none[at], queue[at + 1]);
});

/* ---- what the editor says about a sentence (0.436) ---- */

test("a sentence is long by its own language's count", () => {
  const ar = LANGUAGES["ar-PS"];
  const vi = LANGUAGES["vi-Hue"];
  assert.equal(longSentenceOf(ar), LONG_SENTENCE);
  assert.ok(longSentenceOf(vi) > LONG_SENTENCE, "a language that writes each syllable apart counts more words");
  assert.equal(wordCount("أنا ساكن بالبيت — مع {{name}}.", ar), 5, "a dash is not a word, and a blank is one");
  assert.equal(wordCount("", ar), 0);
});

/** The same card as a conversation. @param {any} card */
function talkOf(card) {
  return TALKS.get(card) || TALKS.set(card, { ...card, sceneKind: undefined }).get(card);
}
const TALKS = new Map();
