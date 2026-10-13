/*
 * The missing word: a word taken out of a scene's own text, chosen back
 * and then typed.
 *
 * What is held here is what a teacher with nothing but the text can rely
 * on: which words are hidden and in what order, that the short ones are
 * left alone, that the wrong answers come from the same text first, that a
 * text — which is asked nothing else beyond being read — is asked these,
 * and that the typed one is marked by the language's own rule.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { build } from "esbuild";
import { must } from "./helpers.mjs";

import {
  GAP_BLANK,
  GAP_MIN_LETTERS,
  dialogNeedMet,
  gapAt,
  gapOptions,
  gapTokens,
  gappedLine,
  gapsOf,
  hideable,
  setTaughtShort,
  taughtShortGaps,
} from "../src/dialogs.ts";
import { offersFor } from "../src/offers.ts";
import { EX, LANGUAGES, arTokenIsWord, checkAnswer, levelOf } from "../src/languages.ts";

const vi = LANGUAGES["vi-Hue"];

/** @param {string[]} said @param {Record<string, any>} [over] @returns {any} */
const text = (said, over = {}) => ({
  id: "T", lang: "vi-Hue", kind: "dialog", sceneKind: "text", tags: [], created: 1,
  forms: [{ id: "T", ar: "", en: "", lat: "", lang: "vi-Hue", s: {} }],
  lines: said.map((ar, i) => ({ id: `t${i}`, who: 0, ar, en: "", lat: "", recs: [], s: {} })),
  ...over,
});

test("a sentence is its words, with the punctuation kept out of the gap", () => {
  assert.deepEqual(gapTokens("Mai, đi học!"), [
    { lead: "", word: "Mai", trail: "," },
    { lead: "", word: "đi", trail: "" },
    { lead: "", word: "học", trail: "!" },
  ]);
  assert.deepEqual(gapTokens("«مرحبا»"), [{ lead: "«", word: "مرحبا", trail: "»" }]);
});

test("short words are never hidden, and a blank still to be filled is not a word", () => {
  assert.equal(GAP_MIN_LETTERS, 3);
  assert.equal(hideable("đi"), false, "two letters");
  assert.equal(hideable("học"), true, "a tone mark is not a letter of its own, but ọ is a letter");
  assert.equal(hideable("في"), false);
  /* Harakat are marks, not letters: كَتَبَ is three letters. */
  assert.equal(hideable("كَتَبَ"), true);
  assert.equal(hideable("بِ"), false);
  assert.equal(hideable("{{name}}"), false);
  assert.equal(hideable(""), false);
});

test("each word worth hiding gets its turn, in reading order, then round again", () => {
  const card = text(["Tôi đi học.", "Mai ở nhà."]);
  assert.deepEqual(gapsOf(card).map((g) => g.word), ["Tôi", "học", "Mai", "nhà"]);
  assert.deepEqual([0, 1, 2, 3, 4].map((n) => must(gapAt(card, n), "a gap").word), ["Tôi", "học", "Mai", "nhà", "Tôi"]);
  assert.equal(gapAt(text(["ở đi"]), 0), null, "nothing long enough, nothing hidden");
});

/* A short word is small change unless the course teaches it: one with a
   card of its own is asked in a scene like any other. */
test("a short word with a card of its own takes its turn too", () => {
  const card = text(["أنا بس بدي في البيت", "بك"], { lang: "ar-PS" });
  /* Marks aside it is the card's word; a prefix peeled is not: بك is not
     the card for بِ, and في with no card stays out. */
  const found = taughtShortGaps([card], ["بَس", "بِ", "كتاب"], arTokenIsWord);
  assert.deepEqual([...must(found.get("T"), "the scene's short words")], ["0 1"]);
  assert.deepEqual(gapsOf(card).map((g) => g.word), ["أنا", "بدي", "البيت"], "not until the cards are known");
  setTaughtShort(found);
  try {
    assert.deepEqual(gapsOf(card).map((g) => g.word), ["أنا", "بس", "بدي", "البيت"]);
    assert.equal(must(gapAt(card, 1), "the short word").word, "بس");
  } finally {
    setTaughtShort(null);
  }
  assert.deepEqual(taughtShortGaps([card], ["كتاب"], arTokenIsWord).size, 0, "no short cards, nothing added");
});

test("only the sentence with the gap is shown, and the word goes back once answered", () => {
  const card = text(["Tôi đi học.", "Mai, ở nhà!"]);
  const gap = must(gapAt(card, 2), "Mai");
  assert.equal(gappedLine(card, gap), `${GAP_BLANK}, ở nhà!`);
  assert.equal(gappedLine(card, gap, null), "Mai, ở nhà!");
});

test("the wrong answers come from the same text first, and never read as the answer", () => {
  const card = text(["Tôi đi học.", "Mai ở nhà.", "Nhà Mai đẹp lắm."]);
  const other = text(["Hôm nay trời mưa."], { id: "U" });
  const gap = must(gapAt(card, 0), "Tôi");
  const options = gapOptions({ card, gap, answerId: "T", pool: [card, other] });
  assert.equal(options.length, 4);
  assert.equal(options.filter((o) => o.ar === "Tôi").length, 1, "the answer once");
  const words = options.map((o) => o.ar).filter((w) => w !== "Tôi");
  for (const w of words) assert.ok(["Mai", "nhà", "Nhà", "đẹp", "lắm"].includes(w), `${w} is from this text`);
  assert.ok(!words.includes("học"), "and not from the sentence on screen, where the answer is the odd one out");
  assert.equal(new Set(options.map((o) => o.ar)).size, 4, "no word twice");

  /* Too few words in a text of its own: the others fill the rest. */
  const short = text(["Tôi học.", "Mai ở nhà."]);
  const filled = gapOptions({ card: short, gap: must(gapAt(short, 0), "Tôi"), answerId: "T", pool: [short, other] });
  assert.ok(filled.some((o) => o.ar === "Mai") && filled.some((o) => o.ar === "nhà"), "the text's own words first");
  assert.ok(!filled.some((o) => o.ar === "học"), "but not the one still in the sentence");
  assert.equal(filled.length, 4, "then the other text's");

  /* Worked out, not drawn: the same question offers the same four. */
  assert.deepEqual(gapOptions({ card, gap, answerId: "T", pool: [card, other] }), options);
});

/* A conversation of the same lines: asked about its words as a whole. */
/** @param {string[]} said @param {Record<string, any>} [over] @returns {any} */
const talk = (said, over = {}) => text(said, { sceneKind: undefined, ...over });

/* Every unit of a scene, placed in it, the way the teaching space hands
   them to offersFor. */
/** @param {any} card */
const placedUnits = (card) => [
  { unit: card.forms[0], isSub: false, scene: { card, at: -1 } },
  ...card.lines.map((/** @type {any} */ unit, /** @type {number} */ at) => ({ unit, isSub: true, scene: { card, at } })),
];

test("a text is asked both, and choosing comes before typing", () => {
  const card = text(["Tôi đi học."]);
  assert.equal(dialogNeedMet("gap", null, card), true, "a text of one sentence is enough");
  assert.equal(dialogNeedMet("gap", null, text(["ở đi"])), false);
  assert.equal(dialogNeedMet("order", null, card), false, "and still nothing else a text is not asked");

  const list = offersFor({ units: placedUnits(card), lang: vi });
  const find = (/** @type {string} */ type) => list.find((o) => o.type === type);
  assert.equal(must(find("gap2pick"), "choose").ready, true);
  assert.equal(must(find("gap2ar"), "type").ready, true);
  assert.ok(levelOf("gap2pick") < levelOf("gap2ar"), "choose opens first");
  assert.equal(EX.gap2pick.dialog, "card");
  assert.equal(EX.gap2ar.dialog, "card");
});

test("a text asks them of each sentence, and a conversation of itself", () => {
  const card = text(["Tôi đi học.", "ở đi"]);
  const list = offersFor({ units: placedUnits(card), lang: vi });
  const gap = must(list.find((o) => o.type === "gap2pick"), "choose");
  assert.equal(gap.unit.id, "t0", "a sentence of the text, not the text");
  assert.equal(must(list.find((o) => o.type === "dlgwhole"), "read through").unit.id, "T", "the whole text is still read");

  /* Each sentence by its own words: one with nothing worth hiding is not
     asked for a missing word, whatever the others have. */
  assert.equal(dialogNeedMet("gap", { card, at: 0 }, card.lines[0]), true);
  assert.equal(dialogNeedMet("gap", { card, at: 1 }, card.lines[1]), false);

  const spoken = talk(["Tôi đi học.", "Mai ở nhà."]);
  const said = offersFor({ units: placedUnits(spoken), lang: vi });
  assert.equal(must(said.find((o) => o.type === "gap2pick"), "choose").unit.id, "T", "a conversation is asked as a whole");
});

/* ---- the question, as the trainer casts it ---- */

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".scene-gaps-build");
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
const { installIndexes, resolveQuestion } = await import(path.join(out, "trainer.js"));

const settings = { language: "vi-Hue", strict: false, types: {}, kinds: {} };

test("the scene is asked for the hidden word, and keeps its own schedule", () => {
  const card = talk(["Tôi đi học.", "Mai ở nhà."]);
  installIndexes([card], settings);
  const q = { id: "T", subId: null, type: "gap2ar" };
  const r = must(resolveQuestion([card], q, false, []), "the question");
  assert.equal(r.unit.id, "T", "progress goes to the scene");
  assert.equal(r.unit.ar, "Tôi");
  assert.deepEqual(r.unit.gap, { line: 0, at: 0, word: "Tôi" });
  assert.equal(checkAnswer("Tôi", r.unit, "gap2ar", settings).ok, true);
  assert.equal(checkAnswer("Mai", r.unit, "gap2ar", settings).ok, false);
  assert.equal(checkAnswer("Tôi", r.unit, "gap2pick", settings).ok, true);
});

test("the word moves on with the asking, but not under an answer", () => {
  const card = talk(["Tôi đi học.", "Mai ở nhà."]);
  installIndexes([card], settings);
  const q = { id: "T", subId: null, type: "gap2pick" };
  assert.equal(must(resolveQuestion([card], q, false, []), "first").unit.ar, "Tôi");
  /* Answered once: the same question, read again for its answer screen,
     is still about the same word. */
  const answered = talk(["Tôi đi học.", "Mai ở nhà."], {
    forms: [{ id: "T", ar: "", en: "", lat: "", lang: "vi-Hue", s: { gap2pick: { right: 1, wrong: 0, near: 0, skips: 0 } } }],
  });
  installIndexes([answered], settings);
  assert.equal(must(resolveQuestion([answered], q, false, []), "same question").unit.ar, "Tôi");
  /* The next time it is asked, the next word. */
  const next = { id: "T", subId: null, type: "gap2pick" };
  assert.equal(must(resolveQuestion([answered], next, false, []), "next question").unit.ar, "học");
});

test("a sentence of a text is asked for its own words, and keeps its own schedule", () => {
  const card = text(["Tôi đi học.", "Mai ở nhà."]);
  installIndexes([card], settings);
  const r = must(resolveQuestion([card], { id: "T", subId: "t1", type: "gap2ar" }, false, []), "the question");
  assert.equal(r.unit.id, "t1", "progress goes to the sentence");
  assert.deepEqual(r.unit.gap, { line: 1, at: 0, word: "Mai" });
  assert.equal(checkAnswer("Mai", r.unit, "gap2ar", settings).ok, true);

  /* The next asking is the next word of the same sentence, never one of
     another: a sentence missed is the sentence that comes back. */
  const asked = text(["Tôi đi học.", "Mai ở nhà."], {
    lines: card.lines.map((/** @type {any} */ l, /** @type {number} */ i) =>
      i === 1 ? { ...l, s: { gap2pick: { right: 0, wrong: 1, near: 0, skips: 0 } } } : l),
  });
  installIndexes([asked], settings);
  const again = must(resolveQuestion([asked], { id: "T", subId: "t1", type: "gap2pick" }, false, []), "asked again");
  assert.equal(again.unit.ar, "nhà");
  assert.equal(again.unit.gap.line, 1);
});

test("a short word the learner holds a card for is asked in the scene", () => {
  const card = talk(["Tôi đi học."]);
  const word = {
    id: "W", lang: "vi-Hue", kind: "word", tags: [], created: 1,
    forms: [{ id: "W", ar: "đi", en: "to go", lat: "", lang: "vi-Hue", s: {} }],
  };
  installIndexes([card], settings);
  assert.equal(gapsFor(card, 1), "học", "without the card, the short word is passed over");
  installIndexes([card, word], settings);
  assert.equal(gapsFor(card, 1), "đi", "with it, the short word takes its turn");
  assert.equal(gapsFor(card, 2), "học");
  installIndexes([card], settings);
});

/* The gap the trainer casts for a scene's n-th asking. */
function gapsFor(/** @type {any} */ card, /** @type {number} */ n) {
  const asked = { ...card, forms: [{ ...card.forms[0], s: { gap2pick: { right: n, wrong: 0, near: 0, skips: 0 } } }] };
  const items = [asked];
  return must(resolveQuestion(items, { id: card.id, subId: null, type: "gap2pick" }, false, []), "the question").unit.ar;
}

/* ---- a sentence and its meaning ---- */

/** @param {[string, string][]} pairs @param {Record<string, any>} [over] @returns {any} */
const meant = (pairs, over = {}) => text(pairs.map(([ar]) => ar), {
  lines: pairs.map(([ar, en], i) => ({ id: `m${i}`, who: 0, ar, en, lat: "", recs: [], s: {} })),
  ...over,
});

test("only sentences with a meaning are asked about their meaning, each in turn", async () => {
  const { meantLines, meantAt } = await import("../src/dialogs.ts");
  const card = meant([["Tôi đi học.", "I go to school."], ["Mai ở nhà.", ""], ["Trời mưa.", "It is raining."]]);
  assert.deepEqual(meantLines(card), [0, 2]);
  assert.deepEqual([0, 1, 2].map((n) => meantAt(card, n)), [0, 2, 0]);
  assert.equal(meantAt(text(["Tôi đi học."]), 0), null, "a text with no meanings is not asked these");
  assert.equal(dialogNeedMet("meant", null, card), true);
  assert.equal(dialogNeedMet("meant", null, text(["Tôi đi học."])), false);
  /* A line still waiting for a blank is not a sentence yet. */
  assert.deepEqual(meantLines(meant([["Tôi là {{name}}.", "I am {{name}}."]])), []);
});

test("the four on offer are the scene's other sentences first, and never the answer twice", async () => {
  const { sentenceOptions } = await import("../src/dialogs.ts");
  const card = meant([
    ["Tôi đi học.", "I go to school."],
    ["Mai ở nhà.", "Mai is at home."],
    ["Trời mưa.", "It is raining."],
    ["Chào bạn.", "Hello."],
    ["Chào bạn!", "hello"],
  ]);
  const other = meant([["Hôm nay trời đẹp.", "The weather is nice today."]], { id: "U" });
  const meanings = sentenceOptions({ card, at: 3, field: "en", answerId: "T", pool: [card, other] });
  assert.equal(meanings.length, 4);
  assert.equal(meanings.filter((o) => o.en === "Hello.").length, 1, "the answer once");
  assert.ok(!meanings.some((o) => o.en === "hello"), "and not again in other words of the same reading");
  assert.ok(meanings.every((o) => o.en !== "The weather is nice today."), "the scene's own came first");
  const sentences = sentenceOptions({ card, at: 0, field: "ar", answerId: "T", pool: [card, other] });
  assert.equal(sentences.length, 4);
  assert.ok(sentences.some((o) => o.ar === "Tôi đi học."));
  /* Too few in the scene: another scene's make up the four. */
  const short = meant([["Tôi đi học.", "I go to school."]]);
  const filled = sentenceOptions({ card: short, at: 0, field: "en", answerId: "T", pool: [short, other, { ...card, id: "V" }] });
  assert.equal(filled.length, 4);
});

test("a sentence with its meaning is asked both ways, the meaning first", () => {
  const card = meant([["Tôi đi học.", "I go to school."]]);
  const list = offersFor({ units: placedUnits(card), lang: vi });
  const find = (/** @type {string} */ type) => list.find((o) => o.type === type);
  assert.equal(must(find("sen2en"), "meaning").ready, true);
  assert.equal(must(find("en2sen"), "sentence").ready, true);
  assert.ok(levelOf("sen2en") < levelOf("en2sen"));
  const bare = offersFor({ units: placedUnits(text(["Tôi đi học."])), lang: vi });
  assert.equal(must(bare.find((o) => o.type === "sen2en"), "listed").ready, false, "no meaning, nothing to choose");
});

test("the scene is cast as one sentence and its meaning, and marked on the one chosen", () => {
  const card = meant([["Tôi đi học.", "I go to school."], ["Trời mưa.", "It is raining."]], { sceneKind: undefined });
  installIndexes([card], settings);
  const r = must(resolveQuestion([card], { id: "T", subId: null, type: "sen2en" }, false, []), "the question");
  assert.equal(r.unit.id, "T");
  assert.equal(r.unit.ar, "Tôi đi học.");
  assert.equal(r.unit.en, "I go to school.");
  assert.equal(checkAnswer("I go to school.", r.unit, "sen2en", settings).ok, true);
  assert.equal(checkAnswer("It is raining.", r.unit, "sen2en", settings).ok, false);
  const back = must(resolveQuestion([card], { id: "T", subId: null, type: "en2sen" }, false, []), "the other way");
  assert.equal(checkAnswer("Tôi đi học.", back.unit, "en2sen", settings).ok, true);
  assert.equal(checkAnswer("Trời mưa.", back.unit, "en2sen", settings).ok, false);
});

test("a sentence of a text is asked its own meaning, whichever time round it is", () => {
  const card = meant([["Tôi đi học.", "I go to school."], ["Trời mưa.", "It is raining."]]);
  installIndexes([card], settings);
  const r = must(resolveQuestion([card], { id: "T", subId: "m1", type: "sen2en" }, false, []), "the question");
  assert.equal(r.unit.id, "m1", "progress goes to the sentence");
  assert.equal(r.unit.ar, "Trời mưa.");
  assert.equal(r.unit.sentenceAt, 1);
  assert.equal(checkAnswer("It is raining.", r.unit, "sen2en", settings).ok, true);
  const back = must(resolveQuestion([card], { id: "T", subId: "m1", type: "en2sen" }, false, []), "the other way");
  assert.equal(checkAnswer("Trời mưa.", back.unit, "en2sen", settings).ok, true);
});
