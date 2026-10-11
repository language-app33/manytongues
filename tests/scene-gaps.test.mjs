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
} from "../src/dialogs.ts";
import { offersFor } from "../src/offers.ts";
import { EX, LANGUAGES, checkAnswer, levelOf } from "../src/languages.ts";

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

test("a text is asked both, and choosing comes before typing", () => {
  const card = text(["Tôi đi học."]);
  assert.equal(dialogNeedMet("gap", null, card), true, "a text of one sentence is enough");
  assert.equal(dialogNeedMet("gap", null, text(["ở đi"])), false);
  assert.equal(dialogNeedMet("order", null, card), false, "and still nothing else a text is not asked");

  const list = offersFor({ units: [{ unit: card, isSub: false, scene: null }], lang: vi });
  const find = (/** @type {string} */ type) => list.find((o) => o.type === type);
  assert.equal(must(find("gap2pick"), "choose").ready, true);
  assert.equal(must(find("gap2ar"), "type").ready, true);
  assert.ok(levelOf("gap2pick") < levelOf("gap2ar"), "choose opens first");
  assert.equal(EX.gap2pick.dialog, "card");
  assert.equal(EX.gap2ar.dialog, "card");
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
  const card = text(["Tôi đi học.", "Mai ở nhà."]);
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
  const card = text(["Tôi đi học.", "Mai ở nhà."]);
  installIndexes([card], settings);
  const q = { id: "T", subId: null, type: "gap2pick" };
  assert.equal(must(resolveQuestion([card], q, false, []), "first").unit.ar, "Tôi");
  /* Answered once: the same question, read again for its answer screen,
     is still about the same word. */
  const answered = text(["Tôi đi học.", "Mai ở nhà."], {
    forms: [{ id: "T", ar: "", en: "", lat: "", lang: "vi-Hue", s: { gap2pick: { right: 1, wrong: 0, near: 0, skips: 0 } } }],
  });
  installIndexes([answered], settings);
  assert.equal(must(resolveQuestion([answered], q, false, []), "same question").unit.ar, "Tôi");
  /* The next time it is asked, the next word. */
  const next = { id: "T", subId: null, type: "gap2pick" };
  assert.equal(must(resolveQuestion([answered], next, false, []), "next question").unit.ar, "học");
});
