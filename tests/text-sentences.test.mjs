/*
 * A text is learnt a sentence at a time.
 *
 * Since 0.433 each sentence of a text is asked its own questions — what it
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
const { buildSession, installIndexes, quietUnits, carryToSentences, laddered } = await import(path.join(out, "trainer.js"));

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

/** The same card as a conversation. @param {any} card */
function talkOf(card) {
  return TALKS.get(card) || TALKS.set(card, { ...card, sceneKind: undefined }).get(card);
}
const TALKS = new Map();
